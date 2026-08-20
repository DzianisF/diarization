import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertTranscriptionJob,
  InsertUser,
  speakerProfiles,
  transcriptionJobs,
  transcriptTurns,
  users,
} from "../drizzle/schema";
import type { SpeakerSuggestion, TranscriptTurn } from "./media/types";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function createTranscriptionJob(job: InsertTranscriptionJob) {
  const db = requireDb(await getDb());
  await db.insert(transcriptionJobs).values(job);
  return getSessionJob(job.id, job.sessionId);
}

export async function getSessionJob(id: string, sessionId: string) {
  const db = requireDb(await getDb());
  const [job] = await db.select().from(transcriptionJobs)
    .where(and(eq(transcriptionJobs.id, id), eq(transcriptionJobs.sessionId, sessionId))).limit(1);
  if (!job) return undefined;

  const [turns, speakers] = await Promise.all([
    db.select().from(transcriptTurns).where(eq(transcriptTurns.jobId, id)).orderBy(asc(transcriptTurns.position)),
    db.select().from(speakerProfiles).where(eq(speakerProfiles.jobId, id)).orderBy(asc(speakerProfiles.id)),
  ]);
  return { job, turns, speakers };
}

export async function listSessionJobs(sessionId: string) {
  const db = requireDb(await getDb());
  return db.select().from(transcriptionJobs)
    .where(eq(transcriptionJobs.sessionId, sessionId))
    .orderBy(desc(transcriptionJobs.createdAt));
}

export async function updateSessionJob(
  id: string,
  sessionId: string,
  patch: Partial<Pick<
    InsertTranscriptionJob,
    "sourceKey" | "sourceUrl" | "audioKey" | "sourceName" | "sourceMimeType" | "sourceBytes" |
    "stage" | "progress" | "transcriptText" | "detectedLanguage" | "errorMessage" | "providerMetadata"
  >>,
) {
  const db = requireDb(await getDb());
  await db.update(transcriptionJobs).set(patch).where(
    and(eq(transcriptionJobs.id, id), eq(transcriptionJobs.sessionId, sessionId)),
  );
  return getSessionJob(id, sessionId);
}

export async function saveCompletedTranscript(
  jobId: string,
  sessionId: string,
  turns: TranscriptTurn[],
  suggestions: SpeakerSuggestion[] = [],
) {
  const db = requireDb(await getDb());
  const existing = await getSessionJob(jobId, sessionId);
  if (!existing) return undefined;
  const preparedNames = existing.speakers
    .filter(speaker => speaker.speakerKey.startsWith("prepared:"))
    .map(speaker => speaker.displayName)
    .filter((name): name is string => Boolean(name));

  await db.delete(transcriptTurns).where(eq(transcriptTurns.jobId, jobId));
  await db.delete(speakerProfiles).where(eq(speakerProfiles.jobId, jobId));
  if (turns.length) {
    await db.insert(transcriptTurns).values(turns.map(turn => ({
      jobId,
      position: turn.position,
      speakerKey: turn.speakerKey,
      startMs: turn.startMs,
      endMs: turn.endMs,
      text: turn.text,
      confidence: turn.confidence ?? null,
    })));
  }

  const knownSpeakers = Array.from(new Map(turns.map(turn => [turn.speakerKey, turn.speakerName])).entries());
  if (knownSpeakers.length) {
    await db.insert(speakerProfiles).values(knownSpeakers.map(([speakerKey, defaultName], index) => ({
      jobId,
      speakerKey,
      defaultName,
      displayName: preparedNames[index] ?? null,
      suggestion: suggestions.find(item => item.speakerKey === speakerKey) ?? null,
    })));
  }
  return getSessionJob(jobId, sessionId);
}

export async function prepareSessionSpeakers(jobId: string, sessionId: string, names: string[]) {
  const db = requireDb(await getDb());
  const existing = await getSessionJob(jobId, sessionId);
  if (!existing || !["uploading", "preparing_source"].includes(existing.job.stage) || !names.length) return existing;
  await db.insert(speakerProfiles).values(names.map((displayName, index) => ({
    jobId,
    speakerKey: `prepared:${index}`,
    defaultName: `Speaker ${index + 1}`,
    displayName,
  })));
  return getSessionJob(jobId, sessionId);
}

export async function renameSessionSpeaker(jobId: string, sessionId: string, speakerKey: string, displayName: string) {
  const db = requireDb(await getDb());
  const existing = await getSessionJob(jobId, sessionId);
  if (!existing?.speakers.some(speaker => speaker.speakerKey === speakerKey)) return undefined;
  await db.update(speakerProfiles).set({ displayName }).where(
    and(eq(speakerProfiles.jobId, jobId), eq(speakerProfiles.speakerKey, speakerKey)),
  );
  return getSessionJob(jobId, sessionId);
}

export async function saveSessionSuggestions(jobId: string, sessionId: string, suggestions: SpeakerSuggestion[]) {
  const db = requireDb(await getDb());
  const existing = await getSessionJob(jobId, sessionId);
  if (!existing) return undefined;
  await Promise.all(suggestions.map(suggestion => db.update(speakerProfiles).set({ suggestion }).where(
    and(eq(speakerProfiles.jobId, jobId), eq(speakerProfiles.speakerKey, suggestion.speakerKey)),
  )));
  return getSessionJob(jobId, sessionId);
}
