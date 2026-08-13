import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

const FLASHCARD_SYSTEM_PROMPT = `You are an expert educator creating flashcards for StudyOS, a second-brain study app. Generate question-answer pairs that help students remember key concepts from the provided lesson material.

Return ONLY a JSON array (no markdown fences, no commentary) with this exact structure:
[
  {
    "front": "Question or term to recall",
    "back": "Answer or explanation"
  },
  ...
]

Generate ~8 flashcards covering the most important concepts, key terms, definitions, and relationships from the material. Keep fronts concise, backs clear but thorough.`;

export type GeneratedFlashcard = {
  front: string;
  back: string;
};

export async function generateFlashcardsFromLesson(params: {
  userId: number;
  lessonId: number;
  subjectId: number;
}): Promise<{ count: number }> {
  const { userId, lessonId, subjectId } = params;

  const lesson = await db.getLesson(lessonId, userId);
  if (!lesson) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  }

  const contentParts: string[] = [];
  if (lesson.excerpt) contentParts.push(`Overview: ${lesson.excerpt}`);
  if (lesson.beginnerExplanation) contentParts.push(`Simple Explanation: ${lesson.beginnerExplanation}`);
  if (lesson.collegeExplanation) contentParts.push(`Detailed Explanation: ${lesson.collegeExplanation}`);
  if (lesson.keyTerms?.length) contentParts.push(`Key Terms: ${lesson.keyTerms.join(", ")}`);
  if (lesson.analogies?.length) contentParts.push(`Analogies: ${lesson.analogies.map((a: { title: string; body: string }) => `${a.title}: ${a.body}`).join("; ")}`);
  if (lesson.takeaways?.length) contentParts.push(`Key Takeaways: ${lesson.takeaways.join("; ")}`);
  if (lesson.examples?.length) contentParts.push(`Examples: ${lesson.examples.join("; ")}`);
  if (lesson.misconceptions?.length) contentParts.push(`Common Misconceptions: ${lesson.misconceptions.join("; ")}`);

  const content = contentParts.join("\n\n");
  if (!content.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This lesson doesn't have enough content to generate flashcards.",
    });
  }

  let generatedFlashcards: GeneratedFlashcard[];

  try {
    const response = await invokeLLM({
      model: "meta/llama-3.1-8b-instruct",
      maxTokens: 1400,
      messages: [
        { role: "system", content: FLASHCARD_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate ~8 flashcards from this lesson material:\n\n${content.slice(0, 60_000)}`,
        },
      ],
    });

    const messageContent = response.choices[0]?.message.content;
    const contentStr = typeof messageContent === "string" ? messageContent : "";
    const jsonMatch = contentStr.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        generatedFlashcards = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Failed to parse LLM flashcard JSON:", parseError);
        generatedFlashcards = [];
      }
    } else {
      generatedFlashcards = [];
    }
  } catch (error) {
    console.error("Flashcard generation error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI couldn't generate flashcards right now. Please try again in a moment.",
    });
  }

  if (!generatedFlashcards.length) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI returned an invalid flashcard format. Please try again.",
    });
  }

  for (const fc of generatedFlashcards) {
    await db.createFlashcard(userId, subjectId, fc.front, fc.back, lessonId);
  }

  return { count: generatedFlashcards.length };
}

export const flashcardsRouter = router({
  listBySubject: protectedProcedure
    .input(z.object({ subjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getSubjectFlashcards(input.subjectId, ctx.user.id);
    }),

  getForReview: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getFlashcardsForReview(ctx.user.id, input.limit);
    }),

  create: protectedProcedure
    .input(z.object({
      subjectId: z.number(),
      front: z.string(),
      back: z.string(),
      lessonId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createFlashcard(
        ctx.user.id,
        input.subjectId,
        input.front,
        input.back,
        input.lessonId
      );
      return { id: result.id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), front: z.string().min(1), back: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => { await db.updateFlashcard(input.id, ctx.user.id, input.front, input.back); return { success: true }; }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await db.deleteFlashcard(input.id, ctx.user.id); return { success: true }; }),

  recordReview: protectedProcedure
    .input(z.object({
      flashcardId: z.number(),
      quality: z.number().min(0).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateFlashcardAfterReview(input.flashcardId, input.quality, ctx.user.id);
      return { success: true };
    }),

  generateFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      subjectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateFlashcardsFromLesson({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        subjectId: input.subjectId,
      });
      return { count: result.count };
    }),
});