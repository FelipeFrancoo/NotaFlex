// Types for API responses and data structures
export interface ProcessedData {
  branches: BranchData[];
  totalByDate: Record<string, number>;
  summary: {
    totalDocuments: number;
    totalValue: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

export interface BranchData {
  name: string;
  documents: DocumentData[];
  totalValue: number;
  documentCount: number;
}

export interface DocumentData {
  transacionador: string;
  numeroDocumento: string;
  valor: number;
  dataVencimento: string;
  tipo: 'A_PAGAR' | 'A_RECEBER';
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  processedData?: ProcessedData;
}

export interface SummaryData {
  branches: SummaryBranch[];
  grandTotal: number;
  grandTotalAPagar: number;
  grandTotalAReceber: number;
  dateSpecificTotals: DateTotal[];
}

export interface SummaryBranch {
  name: string;
  total: number;
  totalAPagar: number;
  totalAReceber: number;
}

export interface DateTotal {
  date: string;
  total: number;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
}