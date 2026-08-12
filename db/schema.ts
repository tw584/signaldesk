import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  audience: text("audience").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  category: text("category").notNull(),
  score: integer("score").notNull(),
  confidence: text("confidence").notNull(),
  evidenceCount: integer("evidence_count").notNull().default(1),
  effort: text("effort").notNull().default("7‑10 days"),
  monetization: text("monetization").notNull().default("Validate with users"),
  status: text("status").notNull().default("review"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
