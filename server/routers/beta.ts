import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const betaRouter = router({
  feedback: protectedProcedure
    .input(z.object({ rating: z.number().int().min(1).max(5), category: z.enum(["ux", "ai", "bug", "idea", "other"]), message: z.string().trim().min(3).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createBetaFeedback(ctx.user.id, input.rating, input.category, input.message);
      return { success: true, id: result.id };
    }),
  exportData: protectedProcedure.query(async ({ ctx }) => db.exportUserStudyData(ctx.user.id)),
});
