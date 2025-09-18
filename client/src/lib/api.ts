import { apiRequest } from "./queryClient";
import { ProcessedData, FileUploadResponse } from "./schema";

export async function uploadCSVFile(files: File[], clearData: boolean = false, documentTypes: Record<number, string[]> = {}): Promise<FileUploadResponse> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  // Add document types to form data
  formData.append('documentTypes', JSON.stringify(documentTypes));

  const url = clearData ? '/api/upload-csv?clearData=true' : '/api/upload-csv';

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao fazer upload do arquivo');
  }

  return response.json();
}

export async function getProcessedData(): Promise<{ success: boolean; data: ProcessedData }> {
  const response = await apiRequest('GET', '/api/processed-data');
  return response.json();
}

export async function uploadExcelSummary(files: File[]): Promise<{ success: boolean; message: string; data: any }> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch('/api/upload-csv-summary', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao fazer upload dos arquivos');
  }

  return response.json();
}

export async function downloadSummaryExcel(): Promise<Blob> {
  const response = await fetch('/api/export-summary-excel', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Erro ao gerar arquivo Excel de resumo');
  }

  return response.blob();
}

export async function downloadExcel(reportInfo?: { name: string; startDate: string; endDate: string; categories: string[]; }): Promise<Blob> {
  const response = await fetch('/api/export-excel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportInfo || {}),
  });

  if (!response.ok) {
    throw new Error('Erro ao gerar arquivo Excel');
  }

  return response.blob();
}

export interface SummaryData {
  branches: Array<{
    name: string;
    totalAPagar: number;
    totalAReceber: number;
    total: number;
  }>;
  dailyTotals?: Array<{
    day: string;
    total: number;
  }>;
  weekdayTotals?: Array<{
    day: string;
    total: number;
  }>;
  dateSpecificTotals?: Array<{
    day: string;
    total: number;
  }>;
  documentDates?: Array<{
    day: string;
    dayOfWeek: string;
    total: number;
  }>;
  grandTotal: number;
  grandTotalAPagar: number;
  grandTotalAReceber: number;
}

export async function uploadCSVSummary(files: File[]): Promise<{ success: boolean; message: string; data: SummaryData }> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch('/api/upload-csv-summary', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao processar arquivos CSV');
  }

  return response.json();
}