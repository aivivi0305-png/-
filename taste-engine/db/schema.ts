import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const telegramOwners = sqliteTable("telegram_owners", {
  telegramUserId: text("telegram_user_id").primaryKey(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const telegramUpdates = sqliteTable("telegram_updates", {
  updateId: text("update_id").primaryKey(),
  status: text("status").notNull().default("processing"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasteEntries = sqliteTable("taste_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  telegramFileId: text("telegram_file_id"),
  mediaKey: text("media_key"),
  mediaType: text("media_type"),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull().default(""),
  learningMode: text("learning_mode").notNull().default("taste"),
  aspect: text("aspect"),
  intent: text("intent"),
  status: text("status").notNull().default("awaiting_aspect"),
  analysisJson: text("analysis_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const weeklyReports = sqliteTable("weekly_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  weekKey: text("week_key").notNull(),
  status: text("status").notNull().default("generating"),
  profileSummary: text("profile_summary").notNull().default(""),
  observation: text("observation").notNull().default(""),
  question: text("question").notNull().default(""),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sentAt: text("sent_at"),
}, (table) => [
  uniqueIndex("weekly_reports_owner_week_idx").on(table.ownerId, table.weekKey),
]);

export const weeklyRecommendations = sqliteTable("weekly_recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id").notNull(),
  ownerId: text("owner_id").notNull(),
  category: text("category").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  reason: text("reason").notNull(),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("weekly_recommendations_owner_idx").on(table.ownerId),
  index("weekly_recommendations_report_idx").on(table.reportId),
]);
