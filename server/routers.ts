import { z } from "zod";
import { paymentMethodValues, productCategoryValues } from "../drizzle/schema";
import * as db from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const productCategorySchema = z.enum(productCategoryValues);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  menu: router({
    list: publicProcedure
      .input(z.object({ category: productCategorySchema.optional(), search: z.string().max(80).optional() }).optional())
      .query(({ input }) => db.listProducts(input)),
    counts: publicProcedure.query(() => db.getCatalogCounts()),
  }),
  orders: router({
    create: publicProcedure
      .input(
        z.object({
          customerName: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
          tableNumber: z.string().trim().min(1, "Informe o número da mesa.").max(20),
          paymentMethod: z.enum(paymentMethodValues),
          needsChange: z.boolean(),
          cashReceivedCents: z.number().int().positive().nullable().optional(),
          serviceChargeEnabled: z.boolean(),
          items: z
            .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) }))
            .min(1, "Adicione ao menos um produto ao pedido."),
        }),
      )
      .mutation(({ input }) => db.createOrder(input)),
  }),
});

export type AppRouter = typeof appRouter;
