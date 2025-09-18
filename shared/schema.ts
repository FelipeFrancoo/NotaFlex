import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branch: text("branch").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  date: timestamp("date").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier"), // Added supplier field
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  documentType: text("document_type").notNull().default("A_PAGAR"),
  sourceFile: text("source_file"), // Track which file this invoice came from
});

export const branchSummaries = pgTable("branch_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branch: text("branch").notNull(),
  invoiceCount: integer("invoice_count").notNull().default(0),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull().default("0"),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
});

export const dailySummaries = pgTable("daily_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull().default("0"),
  invoiceCount: integer("invoice_count").notNull().default(0),
  branch: text("branch"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
});

export const insertBranchSummarySchema = createInsertSchema(branchSummaries).omit({
  id: true,
});

export const insertDailySummarySchema = createInsertSchema(dailySummaries).omit({
  id: true,
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type BranchSummary = typeof branchSummaries.$inferSelect;
export type InsertBranchSummary = z.infer<typeof insertBranchSummarySchema>;
export type DailySummary = typeof dailySummaries.$inferSelect;
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;

// Additional types for API responses
export type ProcessedData = {
  branchTotals: BranchSummary[];
  dailyTotals: DailySummary[];
  weeklyTotals: {
    workingDaysTotal: string;
    weekendTotal: string;
    weekTotal: string;
    workingDays: number;
    weekendDays: number;
    weekPeriod: string;
    totalPayable: number;
    totalReceivable: number;
  };
  grandTotal: string;
  totalInvoices: number;
};

export type FileUploadResponse = {
  success: boolean;
  message: string;
  fileName?: string;
  fileSize?: number;
  processedData?: ProcessedData;
  allFilesData?: Array<{
    fileName: string;
    period: string;
    data: ProcessedData;
    documentTypes: string[];
  }>;
};

export interface UploadRequest {
  files: File[];
  documentTypes?: Record<number, string>;
}

export const WeeklyTotalsSchema = z.object({
  grandTotal: z.number(),
  totalInvoices: z.number(),
  workingDaysTotal: z.number(),
  weekendTotal: z.number(),
  weekTotal: z.number(),
  weekPeriod: z.string(),
  totalPayable: z.number(),
  totalReceivable: z.number(),
});