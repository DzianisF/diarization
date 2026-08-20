import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobStageEnum = mysqlEnum("jobStage", [
  "uploading",
  "preparing_source",
  "extracting_audio",
  "transcribing",
  "diarizing",
  "complete",
  "failed",
]);

export const transcriptionJobs = mysqlTable("transcriptionJobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  sourceType: mysqlEnum("sourceType", ["upload", "url"]).notNull(),
  sourceUrl: text("sourceUrl"),
  sourceKey: varchar("sourceKey", { length: 512 }),
  audioKey: varchar("audioKey", { length: 512 }),
  sourceName: varchar("sourceName", { length: 255 }),
  sourceMimeType: varchar("sourceMimeType", { length: 127 }),
  sourceBytes: int("sourceBytes"),
  stage: jobStageEnum.notNull().default("uploading"),
  progress: int("progress").notNull().default(0),
  transcriptText: text("transcriptText"),
  detectedLanguage: varchar("detectedLanguage", { length: 16 }),
  errorMessage: text("errorMessage"),
  providerMetadata: json("providerMetadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("transcriptionJobs_session_created_idx").on(table.sessionId, table.createdAt),
]);

export const transcriptTurns = mysqlTable("transcriptTurns", {
  id: int("id").autoincrement().primaryKey(),
  jobId: varchar("jobId", { length: 36 }).notNull(),
  position: int("position").notNull(),
  speakerKey: varchar("speakerKey", { length: 64 }).notNull(),
  startMs: int("startMs").notNull(),
  endMs: int("endMs").notNull(),
  text: text("text").notNull(),
  confidence: int("confidence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("transcriptTurns_job_position_uq").on(table.jobId, table.position),
  index("transcriptTurns_job_idx").on(table.jobId),
]);

export const speakerProfiles = mysqlTable("speakerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  jobId: varchar("jobId", { length: 36 }).notNull(),
  speakerKey: varchar("speakerKey", { length: 64 }).notNull(),
  defaultName: varchar("defaultName", { length: 64 }).notNull(),
  displayName: varchar("displayName", { length: 64 }),
  suggestion: json("suggestion"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("speakerProfiles_job_key_uq").on(table.jobId, table.speakerKey),
  index("speakerProfiles_job_idx").on(table.jobId),
]);

export type TranscriptionJob = typeof transcriptionJobs.$inferSelect;
export type InsertTranscriptionJob = typeof transcriptionJobs.$inferInsert;
export type TranscriptTurnRow = typeof transcriptTurns.$inferSelect;
export type SpeakerProfile = typeof speakerProfiles.$inferSelect;
