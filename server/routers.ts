import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import { lessonsRouter } from "./routers/lessons";
import { quizRouter } from "./routers/quiz";
import { flashcardsRouter } from "./routers/flashcards";
import { aiRouter } from "./routers/ai";
import { betaRouter } from "./routers/beta";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { extractDocumentText, inferFileType, MAX_UPLOAD_BYTES, DocumentParseError, SUPPORTED_FILE_TYPES, extractYouTubeVideoId, fetchYouTubeTitle, extractYouTubePlaylistVideoIds, isLikelyEducationalVideo, cleanExtractedText } from "./documentParser";
import { generateLessonFromContent } from "./routers/lessons";

export const appRouter = router({
  system: systemRouter,
  lessons: lessonsRouter,
  quiz: quizRouter,
  flashcards: flashcardsRouter,
  ai: aiRouter,
  beta: betaRouter,
  
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      return user ? { id: user.id, name: user.name, email: user.email } : null;
    }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== Subjects =====
  subjects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserSubjects(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createSubject(
          ctx.user.id,
          input.title,
          input.description,
          input.color
        );
        return { success: true }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updates: any = {};
        if (input.title) updates.title = input.title;
        if (input.description) updates.description = input.description;
        if (input.color) updates.color = input.color;

        await db.updateSubject(input.id, ctx.user.id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteSubject(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ===== Documents =====
  documents: router({
    listBySubject: protectedProcedure
      .input(z.object({ subjectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getSubjectDocuments(input.subjectId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        filename: z.string(),
        fileType: z.enum(["pdf", "docx", "pptx"]),
        fileSize: z.number(),
        storageKey: z.string(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createDocument(
          ctx.user.id,
          input.subjectId,
          input.filename,
          input.fileType,
          input.fileSize,
          input.storageKey,
          input.extractedText
        );
        return { success: true }
      }),

    upload: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        filename: z.string(),
        fileType: z.enum(["pdf", "docx", "pptx"]),
        fileBase64: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > MAX_UPLOAD_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File too large. Maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
          });
        }

        const inferredType = inferFileType(input.filename);
        if (!inferredType || inferredType !== input.fileType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File type does not match filename extension.",
          });
        }

        if (!SUPPORTED_FILE_TYPES.includes(input.fileType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unsupported file type. Supported: ${SUPPORTED_FILE_TYPES.join(", ")}`,
          });
        }

        const storageKey = `uploads/${ctx.user.id}/${Date.now()}-${input.filename}`;
        const { key } = await storagePut(storageKey, buffer);

        let extractedText: string;
        try {
          extractedText = await extractDocumentText(buffer, input.fileType);
        } catch (error) {
          if (error instanceof DocumentParseError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
          throw error;
        }

        const doc = await db.createDocument(
          ctx.user.id,
          input.subjectId,
          input.filename,
          input.fileType,
          buffer.length,
          key,
          extractedText
        );

        return { id: doc.id, extractedText: extractedText.slice(0, 60_000) };
      }),

    uploadYouTube: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        youtubeUrl: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const videoId = extractYouTubeVideoId(input.youtubeUrl);
        if (!videoId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid YouTube URL. Please provide a valid YouTube video link." });
        }

        const storageKey = `youtube/${videoId}`;

        // Transcript caching: reuse a transcript this user already fetched for
        // this video instead of contacting YouTube again.
        const existing = await db.getDocumentByKey(ctx.user.id, storageKey);
        if (existing && existing.extractedText) {
          const cachedTitle = existing.filename || `YouTube - ${videoId}`;
          return {
            id: existing.id,
            title: cachedTitle,
            extractedText: existing.extractedText.slice(0, 60_000),
            cached: true,
          };
        }

        let extractedText: string;
        try {
          extractedText = await extractDocumentText(Buffer.from(""), "youtube", input.youtubeUrl);
        } catch (error) {
          if (error instanceof DocumentParseError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
          throw error;
        }

        const title = (await fetchYouTubeTitle(input.youtubeUrl)) || `YouTube - ${videoId}`;

        const doc = await db.createDocument(
          ctx.user.id,
          input.subjectId,
          title,
          "youtube",
          0,
          storageKey,
          extractedText
        );

        return { id: doc.id, title, extractedText: extractedText.slice(0, 60_000), cached: false };
      }),

    // Manual transcript fallback: when auto-fetch fails (CAPTCHA / rate limit),
    // the user can paste the transcript and it flows through the same
    // transcript -> lesson pipeline.
    uploadYouTubeTranscript: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        transcript: z.string().min(1),
        youtubeUrl: z.string().url().optional(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const videoId = input.youtubeUrl ? extractYouTubeVideoId(input.youtubeUrl) : null;
        const storageKey = videoId ? `youtube/${videoId}` : `youtube-manual/${Date.now()}`;
        const cleaned = cleanExtractedText(input.transcript);
        if (!cleaned) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The pasted transcript is empty." });
        }
        const title = input.title?.trim() || (videoId ? `YouTube - ${videoId}` : "Pasted transcript");
        const doc = await db.createDocument(
          ctx.user.id,
          input.subjectId,
          title,
          "youtube",
          0,
          storageKey,
          cleaned
        );
        return { id: doc.id, title, extractedText: cleaned.slice(0, 60_000), cached: false, manual: true };
      }),

    previewYouTube: protectedProcedure
      .input(z.object({ youtubeUrl: z.string().url() }))
      .query(async ({ input }) => {
        const playlistIds = await extractYouTubePlaylistVideoIds(input.youtubeUrl);
        const directVideoId = extractYouTubeVideoId(input.youtubeUrl);
        if (!playlistIds.length && directVideoId) {
          const url = `https://www.youtube.com/watch?v=${directVideoId}`;
          const title = await fetchYouTubeTitle(url);
          return { kind: "video" as const, videos: [{ id: directVideoId, title, url, educational: true }] };
        }
        if (!playlistIds.length) return { kind: "playlist" as const, videos: [] };
        const videos = [];
        for (const id of playlistIds) {
          const url = `https://www.youtube.com/watch?v=${id}`;
          const title = await fetchYouTubeTitle(url);
          videos.push({ id, title, url, educational: isLikelyEducationalVideo(title) });
        }
        return { kind: "playlist" as const, videos };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), subjectId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocument(input.id, ctx.user.id);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        if (input.subjectId !== undefined && doc.subjectId !== input.subjectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Document does not belong to this subject" });
        }
        await db.deleteDocument(input.id, ctx.user.id);
        return { success: true };
      }),

    generateLesson: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        subjectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocument(input.documentId, ctx.user.id);
        if (!doc) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        if (doc.subjectId !== input.subjectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Document does not belong to this subject" });
        }

        const result = await generateLessonFromContent({
          userId: ctx.user.id,
          subjectId: input.subjectId,
          title: doc.filename,
          content: doc.extractedText ?? "",
          documentId: doc.id,
        });

        return { lessonId: result.id };
      }),
  }),

  // ===== Notes =====
  notes: router({
    listBySubject: protectedProcedure
      .input(z.object({ subjectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getSubjectNotes(input.subjectId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const note = await db.getNote(input.id, ctx.user.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND" });
        return note;
      }),

    create: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        title: z.string(),
        content: z.string(),
        lessonId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createNote(
          ctx.user.id,
          input.subjectId,
          input.title,
          input.content,
          input.lessonId
        );
        return { success: true, id: result.id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateNote(input.id, ctx.user.id, input.content, input.title);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getNote(input.id, ctx.user.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        await db.deleteNote(input.id, ctx.user.id);
        return { success: true };
      }),

    generateForSubject: protectedProcedure
      .input(z.object({ subjectId: z.number(), title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const [subject, documents, lessons] = await Promise.all([
          db.getSubject(input.subjectId, ctx.user.id),
          db.getSubjectDocuments(input.subjectId, ctx.user.id),
          db.getSubjectLessons(input.subjectId, ctx.user.id),
        ]);
        if (!subject) throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found" });
        const source = [
          `Subject: ${subject.title}`,
          ...documents.map((d: any) => `SOURCE: ${d.filename}\n${(d.extractedText ?? "").slice(0, 12000)}`),
          ...lessons.map((l: any) => `LESSON: ${l.title}\n${(l.beginnerExplanation ?? l.excerpt ?? "").slice(0, 8000)}`),
        ].join("\n\n").slice(0, 50000);
        if (!source.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Add study material before generating notes." });

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You write clean study notes for students. Return only simple HTML suitable for a contenteditable editor. Use h2/h3, p, ul, ol, li, strong and code when useful. No markdown, no preamble, no fake enthusiasm. Prioritize the supplied material and do not invent facts." },
            { role: "user", content: `Create concise but useful revision notes for this subject. Cover the important concepts, definitions, examples, formulas or code patterns when present, and common mistakes.\n\n${source}` },
          ],
          maxTokens: 2600,
        });
        const raw = response.choices[0]?.message.content;
        const content = typeof raw === "string" ? raw.replace(/^```html\s*/i, "").replace(/\s*```$/i, "").trim() : "";
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The notes model returned an empty response." });
        const result = await db.createNote(ctx.user.id, input.subjectId, input.title?.trim() || `${subject.title} study notes`, content);
        return { id: result.id };
      }),
  }),

  // ===== Study Sessions =====
  studySessions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserStudySessions(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        subjectId: z.number(),
        title: z.string(),
        scheduledDate: z.date(),
        durationMinutes: z.number().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createStudySession(
          ctx.user.id,
          input.subjectId,
          input.title,
          input.scheduledDate,
          input.durationMinutes,
          input.description
        );
        return { success: true }
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["planned", "in_progress", "completed", "skipped"]),
        actualDurationMinutes: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateStudySessionStatus(
          input.id,
          ctx.user.id,
          input.status,
          input.actualDurationMinutes
        );
        return { success: true };
      }),
  }),

  // ===== Progress & Stats =====
  progress: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrCreateProgressStats(ctx.user.id);
    }),

    updateStats: protectedProcedure
      .input(z.object({
        currentStreak: z.number().optional(),
        longestStreak: z.number().optional(),
        dailyGoalMinutes: z.number().optional(),
        todayStudyMinutes: z.number().optional(),
        totalLessonsCompleted: z.number().optional(),
        totalQuizzesTaken: z.number().optional(),
        totalFlashcardsReviewed: z.number().optional(),
        totalStudyMinutes: z.number().optional(),
        averageQuizScore: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateProgressStats(ctx.user.id, input);
        return { success: true };
      }),

    getHistory: protectedProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getUserProgressHistory(ctx.user.id, input.days);
      }),
  }),
});

export type AppRouter = typeof appRouter;
