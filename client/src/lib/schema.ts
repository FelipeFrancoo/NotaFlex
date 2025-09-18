import { z } from "zod";

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
  branch?: string;
};

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