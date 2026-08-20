import { COOKIE_NAME } from "@shared/const";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createTranscriptionJob,
  getSessionJob,
  listSessionJobs,
  prepareSessionSpeakers,
  renameSessionSpeaker,
  updateSessionJob,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { advancePersistedJob, suggestPersistedRoles } from "./media/jobs";
import { validatePublicMediaUrl } from "./media/urlSafety";
import { isYouTubeUrl } from "./media/platform";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  jobs: router({
    list: publicProcedure.input(z.object({ sessionId: z.string().min(12).max(64) })).query(({ input }) =>
      listSessionJobs(input.sessionId),
    ),
    get: publicProcedure.input(z.object({ id: z.string().min(8).max(36), sessionId: z.string().min(12).max(64) })).query(async ({ input }) => {
      const job = await getSessionJob(input.id, input.sessionId);
      if (!job) throw new Error("Job not found in this browser session.");
      return job;
    }),
    create: publicProcedure.input(z.object({
      sessionId: z.string().min(12).max(64),
      sourceType: z.enum(["upload", "url"]),
      sourceUrl: z.string().url().optional(),
      sourceName: z.string().trim().min(1).max(255).optional(),
      preparedNames: z.array(z.string().trim().min(1).max(48)).max(8).optional(),
      rightsConfirmed: z.literal(true),
    })).mutation(async ({ input }) => {
      if (input.sourceType === "url" && !input.sourceUrl) throw new Error("A public media URL is required.");
      const isPlatform = Boolean(input.sourceUrl && isYouTubeUrl(input.sourceUrl));
      if (input.sourceUrl && !isPlatform) validatePublicMediaUrl(input.sourceUrl);
      const storedSourceType = isPlatform ? "platform" : input.sourceType;
      const id = nanoid(21);
      const created = await createTranscriptionJob({
        id,
        sessionId: input.sessionId,
        sourceType: storedSourceType,
        sourceUrl: input.sourceUrl ?? null,
        sourceName: input.sourceName ?? null,
        stage: isPlatform ? "getting_platform_media" : input.sourceType === "url" ? "preparing_source" : "uploading",
        progress: isPlatform ? 8 : input.sourceType === "url" ? 12 : 5,
      });

      return prepareSessionSpeakers(id, input.sessionId, input.preparedNames ?? []) ?? created;
    }),
    advance: publicProcedure.input(z.object({ id: z.string().min(8).max(36), sessionId: z.string().min(12).max(64) })).mutation(async ({ input }) => {
      const result = await advancePersistedJob(input.id, input.sessionId);
      if (!result) throw new Error("Job not found in this browser session.");
      return result;
    }),
    renameSpeaker: publicProcedure.input(z.object({
      id: z.string().min(8).max(36),
      sessionId: z.string().min(12).max(64),
      speakerKey: z.string().min(1).max(64),
      displayName: z.string().trim().min(1).max(48),
    })).mutation(async ({ input }) => {
      const result = await renameSessionSpeaker(input.id, input.sessionId, input.speakerKey, input.displayName);
      if (!result) throw new Error("Speaker not found in this browser session.");
      return result;
    }),
    suggestRoles: publicProcedure.input(z.object({ id: z.string().min(8).max(36), sessionId: z.string().min(12).max(64) })).mutation(async ({ input }) => {
      const result = await suggestPersistedRoles(input.id, input.sessionId);
      if (!result) throw new Error("Complete this transcript before requesting role suggestions.");
      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
