import { z } from "zod";
import type { ProcessedData as SharedProcessedData } from "@shared/schema";

// Re-export ProcessedData to avoid breaking other parts of the client-side code
// that might be importing it from this file.
export type ProcessedData = SharedProcessedData;

// Types for the application without database dependencies
export type Invoice = {
  id: string;
  branch: string;
  invoiceNumber: string;
  date: Date;
  value: string;
  supplier?: string;
  weekStart: Date;
  weekEnd: Date;
  documentType: string;
  sourceFile?: string;
};

export type BranchSummary = {
  id: string;
  branch: string;
  invoiceCount: number;
  totalValue: string;
  weekStart: Date;
  weekEnd: Date;
};

export type DailySummary = {
  id: string;
  date: Date;
  dayOfWeek: string;
  totalValue: string;
  invoiceCount: number;
  branch: string | null;
};

// Additional types for API responses
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