import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

const QUIZ_SYSTEM_PROMPT = `You are an expert educator creating quiz questions for StudyOS, a second-brain study app. Generate multiple-choice questions that test understanding of the provided lesson material.

Return ONLY a JSON array (no markdown fences, no commentary) with this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Why this answer is correct and others are not",
    "difficulty": "easy" | "medium" | "hard"
  },
  ...
]

Generate 6 questions covering different aspects of the material. Mix difficulties: 2 easy, 2 medium, 2 hard.`;

export type GeneratedQuizQuestion = {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
};

export async function generateQuizFromLesson(params: {
  userId: number;
  lessonId: number;
}): Promise<{ count: number }> {
  const { userId, lessonId } = params;

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
      message: "This lesson doesn't have enough content to generate a quiz.",
    });
  }

  let generatedQuestions: GeneratedQuizQuestion[];

  try {
    const response = await invokeLLM({
      model: "meta/llama-3.1-8b-instruct",
      maxTokens: 1800,
      messages: [
        { role: "system", content: QUIZ_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate 6 quiz questions from this lesson material:\n\n${content.slice(0, 60_000)}`,
        },
      ],
    });

    const messageContent = response.choices[0]?.message.content;
    const contentStr = typeof messageContent === "string" ? messageContent : "";
    const jsonMatch = contentStr.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        generatedQuestions = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Failed to parse LLM quiz JSON:", parseError);
        generatedQuestions = [];
      }
    } else {
      generatedQuestions = [];
    }
  } catch (error) {
    console.error("Quiz generation error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI couldn't generate a quiz right now. Please try again in a moment.",
    });
  }

  if (!generatedQuestions.length) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI returned an invalid quiz format. Please try again.",
    });
  }

  for (const q of generatedQuestions) {
    await db.createQuizQuestion(
      userId,
      lessonId,
      q.question,
      q.options,
      q.correctAnswerIndex,
      q.explanation,
      q.difficulty
    );
  }

  return { count: generatedQuestions.length };
}

export const quizRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const questions = await db.getLessonQuizQuestions(input.id, ctx.user.id);
      return questions;
    }),

  listByLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getLessonQuizQuestions(input.lessonId, ctx.user.id);
    }),

  createQuestion: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      question: z.string(),
      options: z.array(z.string()),
      correctAnswerIndex: z.number(),
      explanation: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createQuizQuestion(
        ctx.user.id,
        input.lessonId,
        input.question,
        input.options,
        input.correctAnswerIndex,
        input.explanation,
        input.difficulty
      );
      return { id: result.id };
    }),

  recordAttempt: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      questionId: z.number(),
      selectedAnswerIndex: z.number(),
      isCorrect: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.recordQuizAttempt(
        ctx.user.id,
        input.lessonId,
        input.questionId,
        input.selectedAnswerIndex,
        input.isCorrect
      );
      return { success: true };
    }),

  getScore: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getLessonQuizScore(input.lessonId, ctx.user.id);
    }),

  generateFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateQuizFromLesson({
        userId: ctx.user.id,
        lessonId: input.lessonId,
      });
      return { count: result.count };
    }),
});