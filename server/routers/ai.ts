import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { quizAttempts, quizQuestions } from "../../drizzle/schema";
import { getWeakTopics } from "../db";
import { extractDocumentText, inferFileType } from "../documentParser";
import { ENV } from "../_core/env";

const TEACHING_MODE_PROMPTS = {
  teacher: `You are a patient, encouraging teacher. Explain concepts clearly with examples, analogies, and step-by-step breakdowns. Check for understanding. Be warm and supportive. Never sound robotic.`,
  eli10: `You are explaining to a 10-year-old. Use simple language, everyday analogies, and fun examples. Avoid jargon. Make it engaging and relatable. Be playful and curious.`,
  exam: `You are an exam prep coach. Focus on key concepts, common exam questions, marking schemes, and efficient study strategies. Be concise and strategic. Sound focused and confident.`,
  interview: `You are an interview coach. Explain concepts as if preparing for a technical/academic interview. Cover fundamentals, edge cases, and "why" questions. Be precise and professional.`,
  quick: `You are a quick revision buddy. Give ultra-concise summaries, key formulas, mnemonics, and bullet-point takeaways. No fluff. Sound energetic and efficient.`,
};

const LOADING_MESSAGES = {
  teacher: [
    "Let me think about how to explain this best...",
    "Breaking this down into bite-sized pieces...",
    "Finding the right analogy for you...",
  ],
  eli10: [
    "Let me put this in simple terms...",
    "Thinking of a fun way to explain this...",
    "Making this easy to understand...",
  ],
  exam: [
    "Focusing on what matters for your exam...",
    "Pulling up key concepts and patterns...",
    "Structuring this for maximum retention...",
  ],
  interview: [
    "Preparing a thorough, interview-ready answer...",
    "Covering fundamentals and edge cases...",
    "Structuring this for clarity and depth...",
  ],
  quick: [
    "Condensing this to the essentials...",
    "Grabbing the key points for you...",
    "Stripping away the fluff...",
  ],
};

function getRandomLoadingMessage(mode: string): string {
  const messages = LOADING_MESSAGES[mode as keyof typeof LOADING_MESSAGES] || LOADING_MESSAGES.teacher;
  return messages[Math.floor(Math.random() * messages.length)];
}

export function referencesStudyMaterial(text: string): boolean {
  return /\b(this|that|the)\s+(document|doc|pdf|file|notes?|transcript|video|lecture|slides?|deck|reading|material|chapter|paper)\b/i.test(
    text
  );
}

/**
 * Finds which uploaded document (PDF/DOCX/PPTX, or a YouTube video — those
 * are stored as documents too, with their transcript in extractedText) the
 * student is most likely referring to, so "explain this document" or
 * "teach me what was in that lecture" can actually be grounded in the real
 * content instead of just a filename list.
 */
export function resolveReferencedDocument(
  message: string,
  docs: Array<{ id: number; filename: string; fileType: string; extractedText: string | null }>,
  lessonDocumentId?: number | null
) {
  if (!docs.length) return null;

  // Named directly, e.g. "explain calculus-notes.pdf"
  const named = docs.find(
    (d) => d.filename && message.toLowerCase().includes(d.filename.toLowerCase().replace(/\.[a-z0-9]+$/i, ""))
  );
  if (named) return named;

  // The lesson currently open was generated from a specific document.
  if (lessonDocumentId) {
    const fromLesson = docs.find((d) => d.id === lessonDocumentId);
    if (fromLesson) return fromLesson;
  }

  if (docs.length === 1) return docs[0];

  // Multiple candidates and a generic reference ("this document") — the
  // most recently uploaded one is the most likely referent.
  if (referencesStudyMaterial(message)) return docs[0];

  return null;
}

async function buildContextMessages(params: {
  userId: number;
  sessionId: number;
  subjectId?: number;
  lessonId?: number;
  teachingMode: string;
  newMessage: string;
  studentName?: string | null;
}) {
  const { userId, sessionId, subjectId, lessonId, teachingMode, newMessage, studentName } = params;

  const systemPrompt = `${TEACHING_MODE_PROMPTS[teachingMode as keyof typeof TEACHING_MODE_PROMPTS] || TEACHING_MODE_PROMPTS.teacher}

You are the StudyOS AI Tutor. Your job is to teach, not to act as a coding/debugging agent. You can teach coding and technical subjects when the student is learning them, but keep the interaction educational: explain, demonstrate, ask the student to try, and correct their reasoning.

Conversation rules:
- Treat the current subject, lesson, uploaded material and recent messages as context. If the student says “this”, “that”, “the topic”, or “give me another example”, infer the reference from context before asking a question.
- Do not repeatedly ask what the student wants to learn when enough context already exists.
- Teach in manageable steps instead of dumping an entire textbook chapter.
- Prefer a short explanation, one concrete example, then a quick check or next step. Go deeper when the student asks or struggles.
- Use the student’s name occasionally and naturally, never as a label and never in every reply.${studentName ? ` The student’s name is ${studentName}.` : ""}
- Never call the user “Student”.
- Avoid canned AI language, fake excitement, repeated motivational filler, and phrases such as “How can I assist you?” or “I’m excited to dive in”.
- If the student has provided study material, ground the answer in it. If the material does not contain the answer, say that clearly and then offer general knowledge.
- When the student asks to learn a broad subject, start with a useful roadmap and begin teaching the first concept instead of asking them to choose a topic.
- When the student makes a mistake, explain why it is wrong and give them another chance before revealing the full answer when appropriate.`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add context from recent chat history
  const recentMessages = await db.getRecentChatMessages(sessionId, userId, 12);
  const currentSavedMessageId = recentMessages.length ? recentMessages[recentMessages.length - 1].id : null;
  for (const msg of recentMessages) {
    // The newest user message was already persisted. We append an enriched
    // version below so attachment text is present exactly once.
    if (msg.id === currentSavedMessageId && msg.role === "user") continue;
    messages.push({ role: msg.role as "user" | "assistant" | "system", content: msg.content });
    const metadata = msg.metadata && typeof msg.metadata === "object" ? msg.metadata as { studyContext?: unknown } : null;
    if (typeof metadata?.studyContext === "string" && metadata.studyContext.trim()) {
      messages.push({ role: "system", content: `Study material attached earlier in this chat:
${metadata.studyContext.slice(0, 40_000)}` });
    }
  }

  // Add lesson/document context. Keep these lookups parallel so the Tutor feels conversational.
  const [lesson, docs, lessons, weakTopics, quizStats, flashcardStats] = await Promise.all([
    lessonId ? db.getLesson(lessonId, userId) : Promise.resolve(null),
    subjectId ? db.getSubjectDocuments(subjectId, userId) : Promise.resolve([]),
    subjectId ? db.getSubjectLessons(subjectId, userId) : Promise.resolve([]),
    db.getWeakTopics?.(userId, subjectId),
    subjectId ? db.getSubjectQuizStats?.(userId, subjectId) : Promise.resolve(null),
    subjectId ? db.getSubjectFlashcardStats?.(userId, subjectId) : Promise.resolve(null),
  ]);

  const contextParts: string[] = [];
  if (lesson) {
    contextParts.push(`Current Lesson: ${lesson.title}`);
    if (lesson.excerpt) contextParts.push(`Summary: ${lesson.excerpt}`);
    if (lesson.beginnerExplanation) contextParts.push(`Simple Explanation: ${lesson.beginnerExplanation.slice(0, 7000)}`);
    if (lesson.keyTerms?.length) contextParts.push(`Key Terms: ${lesson.keyTerms.join(", ")}`);
    if (lesson.misconceptions?.length) contextParts.push(`Common Misconceptions: ${lesson.misconceptions.join("; ")}`);
  }
  if (docs.length) contextParts.push(`Uploaded Documents: ${docs.map(d => `${d.filename}${d.fileType === "youtube" ? " (YouTube transcript)" : ""}`).join(", ")}`);
  if (lessons.length) contextParts.push(`Available Lessons: ${lessons.map(l => l.title).join(", ")}`);
  if (weakTopics?.length) contextParts.push(`Student's Weak Topics: ${weakTopics.join(", ")}`);
  if (quizStats) contextParts.push(`Quiz Performance: ${quizStats.totalQuizzes} quizzes, ${quizStats.avgScore}% average`);
  if (flashcardStats) contextParts.push(`Flashcards: ${flashcardStats.totalCards} cards, ${flashcardStats.dueForReview} due, ${flashcardStats.masteryPercent}% mastery`);

  if (contextParts.length > 0) {
    messages.push({
      role: "system" as const,
      content: `MEMORY CONTEXT (use this to personalize your response):\n${contextParts.join("\n")}\n\nPrioritize the student's uploaded material. If something isn't in their material, say so and offer to explain from general knowledge.`
    });
  }

  // If the student is referring to a specific document/video ("explain this
  // document", "teach me what was in that lecture"), pull its actual
  // extracted text/transcript in — not just its filename — so the tutor can
  // genuinely ground the answer instead of guessing at what it contains.
  // Resolving (rather than always attaching every document) keeps this from
  // ballooning into the whole subject's document history on every message.
  const referencedDoc = resolveReferencedDocument(newMessage, docs, lesson?.documentId ?? undefined);
  if (referencedDoc) {
    if (referencedDoc.extractedText && referencedDoc.extractedText.trim()) {
      const label = referencedDoc.fileType === "youtube" ? "YouTube video transcript" : `${referencedDoc.fileType.toUpperCase()} document`;
      messages.push({
        role: "system" as const,
        content: `The student is referring to this ${label}: "${referencedDoc.filename}".\nFull content:\n${referencedDoc.extractedText.slice(0, 45_000)}\n\nUse this content directly to answer. Do not claim you can't access it — it is provided above.`,
      });
    } else {
      messages.push({
        role: "system" as const,
        content: `The student is referring to "${referencedDoc.filename}", but no extracted text/transcript is available for it. Tell the student clearly that you can't read that file's content right now (e.g. transcript unavailable or extraction failed) instead of pretending to know what's in it.`,
      });
    }
  } else if (referencesStudyMaterial(newMessage) && docs.length === 0) {
    messages.push({
      role: "system" as const,
      content: `The student referred to a document/video/transcript, but this subject has no uploaded material yet. Tell them clearly that nothing has been uploaded to this subject yet, instead of pretending to have read something.`,
    });
  }

  // Add the new user message
  messages.push({ role: "user" as const, content: newMessage });

  return messages;
}

function needsDeeperReasoning(text: string): boolean {
  const normalized = text.toLowerCase();
  return text.length > 900 || /\b(prove|derive|debug|compare|contrast|why does|why is|step[- ]by[- ]step|multi[- ]step|calculate|solve|analyze|reason|trade-?off|edge case|architecture)\b/i.test(normalized);
}

export const aiRouter = router({
  // Create a new chat session
  createSession: protectedProcedure
    .input(z.object({
      subjectId: z.number().optional(),
      lessonId: z.number().optional(),
      title: z.string().optional(),
      pinned: z.boolean().optional(),
      teachingMode: z.enum(["teacher", "eli10", "exam", "interview", "quick"]).default("teacher"),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createChatSession(ctx.user.id, {
        subjectId: input.subjectId,
        lessonId: input.lessonId,
        title: input.title,
        pinned: input.pinned,
        teachingMode: input.teachingMode,
      });
      return { id: result.id };
    }),

  // List user's chat sessions
  listSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getUserChatSessions(ctx.user.id);
    }),

  // Get a specific session with messages
  getSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await db.getChatSession(input.id, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      
      const messages = await db.getChatMessages(input.id, ctx.user.id);
      return { ...session, messages };
    }),

  // Update session (title, teaching mode)
  updateSession: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      pinned: z.boolean().optional(),
      teachingMode: z.enum(["teacher", "eli10", "exam", "interview", "quick"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      await db.updateChatSession(id, ctx.user.id, updates);
      return { success: true };
    }),

  // Delete session
  deleteSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteChatSession(input.id, ctx.user.id);
      return { success: true };
    }),

  // Send message and get AI response
  sendMessage: protectedProcedure
    .input(z.object({
      sessionId: z.number().optional(),
      content: z.string().max(8000).optional(),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        attachments: z.array(z.object({
          id: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
          url: z.string().optional(),
          dataBase64: z.string().max(14_000_000).optional(),
        })).optional(),
      })).optional(),
      attachments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        size: z.number(),
        type: z.string(),
        url: z.string().optional(),
        dataBase64: z.string().max(14_000_000).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let sessionId = input.sessionId;
      let content = input.content;
      let attachments = input.attachments;

      // If messages array is provided (new client format), use the last user message
      if (input.messages && input.messages.length > 0) {
        const lastUserMsg = [...input.messages].reverse().find(m => m.role === "user");
        if (lastUserMsg) {
          content = lastUserMsg.content;
          attachments = lastUserMsg.attachments;
        }
        // Use the last sessionId from messages if not provided
        if (!sessionId) {
          // We'll need to create or get a session - for now, we'll handle this in the client
        }
      }

      if (!sessionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "sessionId is required" });
      }
      if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Add a message or attach study material first." });
      }
      content = content?.trim() ?? "";

      const session = await db.getChatSession(sessionId, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Chat session not found" });

      // Convert temporary client attachments into study context. The raw base64
      // is never persisted to the chat history.
      const persistedAttachments = attachments?.map(({ dataBase64: _dataBase64, ...attachment }) => attachment);
      let enrichedContent = content;
      const extractedParts: string[] = [];

      if (attachments?.length) {
        for (const attachment of attachments) {
          if (!attachment.dataBase64) continue;
          try {
            const filenameType = inferFileType(attachment.name);
            if (filenameType) {
              const buffer = Buffer.from(attachment.dataBase64, "base64");
              const extracted = await extractDocumentText(buffer, filenameType);
              if (extracted.trim()) {
                extractedParts.push(`Attachment: ${attachment.name}\n${extracted.slice(0, 40_000)}`);
              }
            } else if (attachment.type.startsWith("text/")) {
              const text = Buffer.from(attachment.dataBase64, "base64").toString("utf8");
              extractedParts.push(`Attachment: ${attachment.name}\n${text.slice(0, 40_000)}`);
            }
          } catch (error) {
            console.warn(`[AI] Could not extract attachment ${attachment.name}:`, error);
          }
        }
        if (extractedParts.length) {
          enrichedContent = `${content}\n\nSTUDY MATERIAL ATTACHED BY THE STUDENT:\n${extractedParts.join("\n\n")}`;
        }
      }

      await db.createChatMessage(
        ctx.user.id,
        sessionId,
        "user",
        content,
        persistedAttachments?.length || extractedParts.length
          ? {
              ...(persistedAttachments?.length ? { attachments: persistedAttachments } : {}),
              ...(extractedParts.length ? { studyContext: extractedParts.join("\n\n").slice(0, 40_000) } : {}),
            }
          : undefined
      );
      if (!session.title || session.title === "New study chat") {
        await db.updateChatSession(sessionId, ctx.user.id, { title: content.slice(0, 60) });
      }

      // Build context and call LLM
      const messages = await buildContextMessages({
        userId: ctx.user.id,
        sessionId,
        subjectId: session.subjectId ?? undefined,
        lessonId: session.lessonId ?? undefined,
        teachingMode: session.teachingMode ?? "teacher",
        newMessage: enrichedContent,
        studentName: ctx.user.name,
      });

      // Add attachment context to the last user message
      if (attachments && attachments.length > 0) {
        const attachmentSummary = attachments
          .map((att) => `[Attached File: ${att.name} (${att.type}, ${(att.size / 1024).toFixed(1)}KB)]`)
          .join("\n");
        // Find the last user message and append attachment info
        const lastUserMsgIndex = messages.findLastIndex(m => m.role === "user");
        if (lastUserMsgIndex !== -1) {
          messages[lastUserMsgIndex].content = `${messages[lastUserMsgIndex].content}\n\nAttachments:\n${attachmentSummary}`;
        }
      }

      let response: string;
      let thinkingContent: string | undefined;
      const complexQuestion = needsDeeperReasoning(enrichedContent);
      const preferredModel = complexQuestion && ENV.nvidiaNimReasoningModel
        ? ENV.nvidiaNimReasoningModel
        : undefined;
      const fallbackModel = preferredModel ? (ENV.nvidiaNimModel || undefined) : (ENV.nvidiaNimReasoningModel || undefined);
      try {
        const primary = await invokeLLM({ messages, maxTokens: complexQuestion ? 1600 : 1200, ...(preferredModel ? { model: preferredModel } : {}) });
        const message = primary.choices[0]?.message;
        const primaryContent = message?.content;
        if (typeof primaryContent === "string" && primaryContent.trim()) {
          response = primaryContent.trim();
          thinkingContent = message?.reasoning_content || message?.thinking;
        } else if (message?.reasoning_content && typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
          // Reasoning models may return the answer in reasoning_content when content is null
          response = message.reasoning_content.trim();
          thinkingContent = message?.reasoning_content;
          console.log("[AI] Used reasoning_content as response (content was null/empty)");
        } else {
          throw new Error("Primary tutor returned an empty response");
        }
      } catch (primaryError) {
        console.warn("[AI] Primary tutor failed:", primaryError instanceof Error ? primaryError.message : primaryError);
        if (fallbackModel !== preferredModel) {
          try {
            const fallback = await invokeLLM({ messages, maxTokens: 1600, ...(fallbackModel ? { model: fallbackModel } : {}) });
            const message = fallback.choices[0]?.message;
            const fallbackContent = message?.content;
            if (typeof fallbackContent === "string" && fallbackContent.trim()) {
              response = fallbackContent.trim();
              thinkingContent = message?.reasoning_content || message?.thinking;
            } else if (message?.reasoning_content && typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
              response = message.reasoning_content.trim();
              thinkingContent = message?.reasoning_content;
              console.log("[AI] Fallback used reasoning_content as response (content was null/empty)");
            } else throw new Error("Fallback tutor returned an empty response");
          } catch (fallbackError) {
            console.error("[AI] Tutor fallback failed:", fallbackError instanceof Error ? fallbackError.message : fallbackError);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "StudyOS couldn't reach the tutor right now. Your message is safe. Try again in a few seconds." });
          }
        } else {
          console.error("[AI] Tutor request failed:", primaryError instanceof Error ? primaryError.message : primaryError);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "StudyOS couldn't reach the tutor right now. Your message is safe. Try again in a few seconds." });
        }
      }

      // Save assistant response with thinking
      await db.createChatMessage(
        ctx.user.id,
        sessionId,
        "assistant",
        response,
        thinkingContent ? { thinking: thinkingContent } : undefined
      );

      return { content: response, response, thinking: thinkingContent };
    }),

  // Get messages for a session (paginated)
getMessages: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getRecentChatMessages(input.sessionId, ctx.user.id, input.limit ?? 50);
    }),

  // Get loading message for personality
  getLoadingMessage: protectedProcedure
    .input(z.object({
      teachingMode: z.enum(["teacher", "eli10", "exam", "interview", "quick"]).default("teacher"),
    }))
    .query(({ input }) => {
      return { message: getRandomLoadingMessage(input.teachingMode) };
    }),

  // Get weak topics for the user
  getWeakTopics: protectedProcedure
    .input(z.object({
      subjectId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getWeakTopics(ctx.user.id, input.subjectId);
    }),

  // Get AI recommendations for the user
  getRecommendations: protectedProcedure
    .input(z.object({
      subjectId: z.number().optional(),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const recommendations = [];

      // 1. Continue learning - next lesson in most recent subject
      const recentSessions = await db.getRecentStudySessions(userId, input.subjectId, 1);
      if (recentSessions.length > 0) {
        const session = recentSessions[0];
        const lessons = await db.getSubjectLessons(session.subjectId, userId);
        if (lessons.length > 0) {
          recommendations.push({
            type: "continue_lesson",
            title: `Continue: ${lessons[0].title}`,
            description: "Pick up where you left off",
            action: { type: "navigate", path: `/lesson/${lessons[0].id}` },
            priority: 1,
          });
        }
      }

      // 2. Weak topics - recommend revision
      const weakTopics = await db.getWeakTopics(userId, input.subjectId);
      if (weakTopics.length > 0) {
        recommendations.push({
          type: "revise_topic",
          title: `Revise: ${weakTopics[0]}`,
          description: "You struggled with this in recent quizzes",
          action: { type: "chat", prompt: `Help me understand ${weakTopics[0]} better` },
          priority: 2,
        });
      }

      // 3. Flashcards due for review
      if (input.subjectId) {
        const flashcardStats = await db.getSubjectFlashcardStats(userId, input.subjectId);
        if (flashcardStats && flashcardStats.dueForReview > 0) {
          recommendations.push({
            type: "review_flashcards",
            title: `Review ${flashcardStats.dueForReview} flashcards`,
            description: "Spaced repetition cards are due",
            action: { type: "navigate", path: `/flashcards/${input.subjectId}` },
            priority: 3,
          });
        }
      }

      // 4. Retry failed quiz
      const recentAttempts = await (await db.getDb())?.select().from(quizAttempts)
        .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.isCorrect, false)))
        .orderBy(desc(quizAttempts.createdAt))
        .limit(1) ?? [];
      
      if (recentAttempts.length > 0) {
        const attempt = recentAttempts[0];
        const question = await (await db.getDb())?.select().from(quizQuestions)
          .where(eq(quizQuestions.id, attempt.questionId))
          .limit(1) ?? [];
        if (question.length > 0) {
          const lesson = await db.getLesson(question[0].lessonId, userId);
          if (lesson) {
            recommendations.push({
              type: "retry_quiz",
              title: `Retry quiz: ${lesson.title}`,
              description: "You missed a question on this topic",
              action: { type: "navigate", path: `/quiz/${lesson.id}` },
              priority: 4,
            });
          }
        }
      }

      // 5. Watch uploaded video (if YouTube docs exist)
      if (input.subjectId) {
        const docs = await db.getSubjectDocuments(input.subjectId, userId);
        const youtubeDocs = docs.filter(d => d.fileType === "youtube");
        if (youtubeDocs.length > 0) {
          recommendations.push({
            type: "watch_video",
            title: `Watch: ${youtubeDocs[0].filename.replace("YouTube - ", "")}`,
            description: "Re-watch the video for better understanding",
            action: { type: "chat", prompt: `Summarize the key points from ${youtubeDocs[0].filename}` },
            priority: 5,
          });
        }
      }

      // Sort by priority and limit
      return recommendations
        .sort((a, b) => a.priority - b.priority)
        .slice(0, input.limit);
    }),

});