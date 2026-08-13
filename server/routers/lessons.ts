import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

const LESSON_SYSTEM_PROMPT = `You are an expert, endlessly patient educator writing for StudyOS, a second-brain study app. Generate comprehensive lesson content from the provided material so a student can go from confused to confident.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact structure:
{
  "excerpt": "Brief summary (1-2 sentences)",
  "beginnerExplanation": "Simple explanation for someone brand new to the topic (2-3 short paragraphs, plain language)",
  "collegeExplanation": "A more detailed, rigorous explanation for a college-level student (2-3 paragraphs)",
  "keyTerms": ["term1", "term2", ...],
  "analogies": [{"title": "Analogy Title", "body": "Explanation using an everyday comparison"}, ...],
  "takeaways": ["key revision point 1", "key revision point 2", ...],
  "examples": ["real-world example 1", "real-world example 2", ...],
  "misconceptions": ["a common mistake or misconception students have about this topic", ...]
}
Always prioritize understanding before testing. Keep language warm and human, never robotic.`;

export type GeneratedLessonContent = {
  excerpt?: string;
  beginnerExplanation?: string;
  collegeExplanation?: string;
  keyTerms?: string[];
  analogies?: Array<{ title: string; body: string }>;
  takeaways?: string[];
  examples?: string[];
  misconceptions?: string[];
};

// NVIDIA NIM reasoning models (e.g. openai/gpt-oss-120b) can emit raw
// control characters (\n, \t, \r, etc.) inside JSON string literals, which
// make JSON.parse throw and previously dumped raw JSON into the lesson body.
// This strips them from within quoted string values only (not from JSON
// structure), so structured fields survive.
function sanitizeControlCharsInJsonStrings(json: string): string {
  return json.replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
    m.replace(/[\u0000-\u001f]/g, (c) => {
      switch (c) {
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\t": return "\\t";
        case "\b": return "\\b";
        case "\f": return "\\f";
        default: return "";
      }
    })
  );
}

export function parseGeneratedLessonContent(raw: string, fallbackTitle: string): GeneratedLessonContent {
  const trimmed = raw.trim();
  if (!trimmed) return { excerpt: fallbackTitle, beginnerExplanation: "" };

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = withoutFence.indexOf("{");
  const jsonEnd = withoutFence.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return { excerpt: fallbackTitle, beginnerExplanation: withoutFence };
  }

  try {
    const jsonText = sanitizeControlCharsInJsonStrings(withoutFence.slice(jsonStart, jsonEnd + 1));
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt : fallbackTitle,
      beginnerExplanation: typeof parsed.beginnerExplanation === "string" ? parsed.beginnerExplanation : "",
      collegeExplanation: typeof parsed.collegeExplanation === "string" ? parsed.collegeExplanation : undefined,
      keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.filter((item): item is string => typeof item === "string") : [],
      analogies: Array.isArray(parsed.analogies) ? parsed.analogies.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const value = item as Record<string, unknown>;
        return typeof value.title === "string" && typeof value.body === "string"
          ? [{ title: value.title, body: value.body }]
          : [];
      }) : [],
      takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.filter((item): item is string => typeof item === "string") : [],
      examples: Array.isArray(parsed.examples) ? parsed.examples.filter((item): item is string => typeof item === "string") : [],
      misconceptions: Array.isArray(parsed.misconceptions) ? parsed.misconceptions.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    // Never dump raw model JSON into the lesson body. Return a graceful,
    // empty lesson so the caller can show the saved source for a retry.
    return { excerpt: fallbackTitle, beginnerExplanation: "" };
  }
}

/**
 * Calls the LLM to turn raw study material into structured lesson content,
 * then persists it. Shared by lessons.generateFromContent (manual title +
 * pasted content) and documents.upload (auto-generate after a file parses)
 * so the prompt and JSON-parsing fallback only live in one place.
 */
export async function generateLessonFromContent(params: {
  userId: number;
  subjectId: number;
  title: string;
  content: string;
  documentId?: number;
}): Promise<{ id: number }> {
  const { userId, subjectId, title, content, documentId } = params;

  if (!content.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "There's no text to generate a lesson from.",
    });
  }

  let generatedContent: GeneratedLessonContent;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: LESSON_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Please generate lesson content for: "${title}"\n\nStudy material:\n${content.slice(0, 50_000)}`,
        },
      ],
      maxTokens: 2200,
    });

    const messageContent = response.choices[0]?.message.content;
    const contentStr = typeof messageContent === "string" ? messageContent.trim() : "";
    if (!contentStr) throw new Error("The lesson model returned an empty response");
    generatedContent = parseGeneratedLessonContent(contentStr, title);
  } catch (error) {
    console.warn("Lesson generation primary attempt failed:", error);
    {
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: LESSON_SYSTEM_PROMPT },
            { role: "user", content: `Generate a clear study lesson for: "${title}"\n\nStudy material:\n${content.slice(0, 45_000)}` },
          ],
          ...(ENV.nvidiaNimReasoningModel && ENV.nvidiaNimReasoningModel !== ENV.nvidiaNimModel
            ? { model: ENV.nvidiaNimReasoningModel }
            : {}),
          maxTokens: 2600,
        });
        const messageContent = response.choices[0]?.message.content;
        const fallbackContent = typeof messageContent === "string" ? messageContent.trim() : "";
        if (!fallbackContent) throw new Error("The fallback lesson model returned an empty response");
        generatedContent = parseGeneratedLessonContent(fallbackContent, title);
      } catch (fallbackError) {
        console.error("Lesson generation fallback failed:", fallbackError);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "StudyOS couldn't turn this source into a lesson right now. The source is saved, so you can retry without uploading it again." });
      }
    }
  }

  return db.createLesson(userId, subjectId, title, {
    excerpt: generatedContent.excerpt,
    beginnerExplanation: generatedContent.beginnerExplanation,
    collegeExplanation: generatedContent.collegeExplanation,
    keyTerms: generatedContent.keyTerms || [],
    analogies: generatedContent.analogies || [],
    takeaways: generatedContent.takeaways || [],
    examples: generatedContent.examples || [],
    misconceptions: generatedContent.misconceptions || [],
    documentId,
  });
}

export type StudyPackage = {
  lessonId: number;
  quizCount: number;
  flashcardCount: number;
  summary: string;
};

export async function generateStudyPackage(params: {
  userId: number;
  subjectId: number;
  title: string;
  content: string;
  documentId?: number;
}): Promise<StudyPackage> {
  const { userId, subjectId, title, content, documentId } = params;

  // 1. Generate lesson
  const lessonResult = await generateLessonFromContent({ userId, subjectId, title, content, documentId });
  const lessonId = lessonResult.id;

  // 2. Generate quiz
  const { generateQuizFromLesson } = await import("../routers/quiz");
  const quizResult = await generateQuizFromLesson({ userId, lessonId });
  
  // 3. Generate flashcards
  const { generateFlashcardsFromLesson } = await import("../routers/flashcards");
  const flashcardResult = await generateFlashcardsFromLesson({ userId, lessonId, subjectId });

  // 4. Generate summary
  const summaryPrompt = `Create a concise 3-4 sentence summary of this lesson for quick revision. Focus on the key takeaways only.`;
  const summaryResponse = await invokeLLM({
    maxTokens: 500,
    messages: [
      { role: "system", content: summaryPrompt },
      { role: "user", content: content.slice(0, 30_000) },
    ],
  });
  const summary = typeof summaryResponse.choices[0]?.message?.content === "string" 
    ? summaryResponse.choices[0].message.content 
    : "Summary generated";

  return {
    lessonId,
    quizCount: quizResult.count,
    flashcardCount: flashcardResult.count,
    summary,
  };
}

export const lessonsRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const lesson = await db.getLesson(input.id, ctx.user.id);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      return lesson;
    }),

  listBySubject: protectedProcedure
    .input(z.object({ subjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getSubjectLessons(input.subjectId, ctx.user.id);
    }),

  create: protectedProcedure
    .input(z.object({
      subjectId: z.number(),
      title: z.string(),
      excerpt: z.string().optional(),
      beginnerExplanation: z.string().optional(),
      collegeExplanation: z.string().optional(),
      keyTerms: z.array(z.string()).optional(),
      analogies: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
      takeaways: z.array(z.string()).optional(),
      examples: z.array(z.string()).optional(),
      misconceptions: z.array(z.string()).optional(),
      visualPrompt: z.string().optional(),
      documentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createLesson(ctx.user.id, input.subjectId, input.title, {
        excerpt: input.excerpt,
        beginnerExplanation: input.beginnerExplanation,
        collegeExplanation: input.collegeExplanation,
        keyTerms: input.keyTerms,
        analogies: input.analogies,
        takeaways: input.takeaways,
        examples: input.examples,
        misconceptions: input.misconceptions,
        visualPrompt: input.visualPrompt,
        documentId: input.documentId,
      });
      return { id: result.id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const lesson = await db.getLesson(input.id, ctx.user.id);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateLesson(input.id, ctx.user.id, { title: input.title.trim() });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteLesson(input.id, ctx.user.id);
      return { success: true };
    }),

  generateFromContent: protectedProcedure
    .input(z.object({
      subjectId: z.number(),
      title: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateLessonFromContent({
        userId: ctx.user.id,
        subjectId: input.subjectId,
        title: input.title,
        content: input.content,
      });
      return { id: result.id };
    }),

  generateStudyPackage: protectedProcedure
    .input(z.object({
      subjectId: z.number(),
      title: z.string(),
      content: z.string(),
      documentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateStudyPackage({
        userId: ctx.user.id,
        subjectId: input.subjectId,
        title: input.title,
        content: input.content,
        documentId: input.documentId,
      });
      return result;
    }),

});
