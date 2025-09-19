import type { NextPage } from 'next'
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ProcessingStatus } from "@/components/processing-status";
import { DataPreview } from "@/components/data-preview";
import { uploadCSVFile, downloadExcel, uploadCSVSummary, downloadSummaryExcel, SummaryData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, File, X, Download, Loader2, Calendar } from "lucide-react";
import { ProcessedData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Define ReportInfo type for Excel generation
type ReportInfoData = {
  name: string;
  startDate: string;
  endDate: string;
  categories: string[];
  processedData?: any;
};
import { cn } from "@/lib/utils";

// Helper function to format file size
const formatFileSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const Home: NextPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [documentTypes, setDocumentTypes] = useState<Record<number, string[]>>({});
  const [hasUploadedData, setHasUploadedData] = useState(false);

  // Summary states
  const [summaryFiles, setSummaryFiles] = useState<File[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [summaryIsDragOver, setSummaryIsDragOver] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Upload mutation for multiple CSV files
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProcessedData(null);
      const data = await uploadCSVFile(files, true, documentTypes);
      return data;
    },
    onMutate: () => {
      setProcessingProgress(0);
      setCurrentFileIndex(0);
    },
    onSuccess: (data) => {
      setProcessingProgress(100);
      setTimeout(() => {
        if (data.processedData) {
          setProcessedData(data.processedData);
        }
        setHasUploadedData(true);
        toast({
          title: "Sucesso",
          description: data.message,
        });
      }, 500);
    },
    onError: (error: Error) => {
      setProcessingProgress(0);
      setCurrentFileIndex(0);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Excel generation mutation for processed data
  const excelMutation = useMutation({
    mutationFn: (info: ReportInfoData) => downloadExcel(info),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_notas_fiscais_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: "O arquivo Excel foi gerado e o download iniciou automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Summary CSV upload mutation
  const summaryUploadMutation = useMutation({
    mutationFn: uploadCSVSummary,
    onSuccess: (response) => {
      setSummaryData(response.data);
      toast({
        title: "Sucesso",
        description: response.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Summary Excel generation mutation
  const summaryExcelMutation = useMutation({
    mutationFn: downloadSummaryExcel,
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resumo_total_filiais_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: "O arquivo Excel de resumo foi gerado e o download iniciou automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(files);
    files.forEach((_, index) => {
      setDocumentTypes(prev => {
        if (!(index in prev)) {
          return { ...prev, [index]: ['A_PAGAR'] };
        }
        return prev;
      });
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentTypes(prev => {
      const newTypes = { ...prev };
      delete newTypes[index];
      const reindexed: Record<number, string[]> = {};
      Object.entries(newTypes).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      return reindexed;
    });
  };

  const handleDocumentTypeChange = (fileIndex: number, types: string[]) => {
    setDocumentTypes(prev => ({ ...prev, [fileIndex]: types }));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    uploadMutation.mutate(selectedFiles);
  };

  const handleGenerateExcel = () => {
    const reportInfo = {
      name: 'Relatório de Notas Fiscais',
      startDate: '',
      endDate: '',
      categories: [],
      processedData: processedData // Pass the actual processed data
    };
    excelMutation.mutate(reportInfo);
  };

  const handleReset = async () => {
    try {
      const response = await fetch('/api/clear-data', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Erro ao limpar dados');
      }
      setSelectedFiles([]);
      setProcessedData(null);
      setProcessingProgress(0);
      setCurrentFileIndex(0);
      setDocumentTypes({});
      setHasUploadedData(false);
      uploadMutation.reset();
      excelMutation.reset();

      setTimeout(() => {
        toast({
          title: "Dados limpos",
          description: "Os dados anteriores foram removidos. Selecione novos arquivos para processar.",
        });
      }, 100);
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar dados anteriores",
        variant: "destructive",
      });
    }
  };

  // Summary handlers
  const handleSummaryFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const csvFiles = Array.from(files).filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
      setSummaryFiles(prev => [...prev, ...csvFiles]);
    }
    // Reset the file input value to allow selecting the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleSummaryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setSummaryIsDragOver(true);
  };

  const handleSummaryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setSummaryIsDragOver(false);
  };

  const handleSummaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSummaryIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFiles = files.filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (csvFiles.length > 0) {
      setSummaryFiles(prev => [...prev, ...csvFiles]);
    } else {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos CSV",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSummaryFile = (index: number) => {
    setSummaryFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessSummary = () => {
    if (summaryFiles.length === 0) return;
    summaryUploadMutation.mutate(summaryFiles);
  };

  const handleGenerateSummaryExcel = () => {
    summaryExcelMutation.mutate();
  };

  const isProcessing = uploadMutation.isPending && processingProgress < 100;
  const showDataPreview = processedData && !isProcessing;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">NotaFlex</h1>
                <p className="text-sm text-muted-foreground">Processamento de relatórios semanais</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/t014"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                📊 Processador T014
              </a>
              <a
                href="/processar-csv-real"
                className="text-sm text-green-600 hover:text-green-700 hover:underline font-medium"
              >
                🔄 Dados Reais CSV
              </a>
              <span className="text-sm text-muted-foreground">Versão 1.5.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFiles={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onDocumentTypeChange={handleDocumentTypeChange}
            documentTypes={documentTypes}
            isUploading={uploadMutation.isPending}
            onProcessFiles={handleUpload}
            hasUploadedData={hasUploadedData}
            onGenerateExcel={handleGenerateExcel}
            isGeneratingExcel={excelMutation.isPending}
          />
        </div>

        <div className="mb-8">
          <ProcessingStatus
            isVisible={isProcessing}
            progress={processingProgress}
            currentFile={currentFileIndex}
            totalFiles={selectedFiles.length}
          />
        </div>

        {showDataPreview && (
          <div className="mt-8 space-y-6 mb-16">
            <DataPreview data={processedData} onGenerateExcel={handleGenerateExcel} onReset={handleReset} isGeneratingExcel={excelMutation.isPending} />
          </div>
        )}

        {/* Summary Section */}
        <div className="mb-8 mt-16">
          <Card className="shadow-sm border-2">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Resumo Geral de Relatórios</h2>
                <p className="text-muted-foreground">Faça upload dos arquivos CSV gerados a partir dos Excel exportados para criar um resumo consolidado</p>
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-all duration-300",
                  summaryIsDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary hover:bg-primary/2",
                  summaryUploadMutation.isPending && "pointer-events-none opacity-50"
                )}
                onDragOver={handleSummaryDragOver}
                onDragLeave={handleSummaryDragLeave}
                onDrop={handleSummaryDrop}
              >
                <div className="flex flex-col items-center">
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Arraste e solte os arquivos CSV aqui</h3>
                  <p className="text-muted-foreground mb-4">ou clique para selecionar múltiplos arquivos</p>
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    className="hidden"
                    id="summary-file-input"
                    onChange={handleSummaryFileSelect}
                  />
                  <Button
                    onClick={() => document.getElementById('summary-file-input')?.click()}
                    disabled={summaryUploadMutation.isPending}
                  >
                    Selecionar Arquivos CSV para Resumo
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Formatos aceitos: CSV (gerados a partir do Excel)</span>
                <span>Múltiplos arquivos suportados</span>
              </div>

              {summaryFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">Arquivos CSV Selecionados ({summaryFiles.length})</h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSummaryFiles([])}
                        disabled={summaryUploadMutation.isPending}
                      >
                        Remover Todos
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleProcessSummary}
                        disabled={summaryUploadMutation.isPending}
                      >
                        Processar {summaryFiles.length} Arquivo(s)
                      </Button>
                    </div>
                  </div>
                  {summaryFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <File className="h-6 w-6 text-green-600" />
                          <div>
                            <p className="font-medium text-foreground">{file.name}</p>
                            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSummaryFile(index)}
                          disabled={summaryUploadMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {summaryData && (
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Resumo por Filial</h3>
                    <div className="grid gap-4">
                      {summaryData.branches.map((branch, index) => (
                        <div key={index} className="flex justify-between items-center p-4 border rounded-lg bg-card">
                          <span className="font-medium text-card-foreground">{branch.name}</span>
                          <span className="text-lg font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(branch.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 border-2 border-primary rounded-lg bg-primary/5">
                    <span className="font-bold text-primary text-lg">TOTAL GERAL</span>
                    <span className="text-xl font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(summaryData.grandTotal)}
                    </span>
                  </div>

                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={handleGenerateSummaryExcel}
                      disabled={summaryExcelMutation.isPending}
                      className="px-6 py-3"
                    >
                      {summaryExcelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      {summaryExcelMutation.isPending ? "Gerando..." : "Exportar Resumo para Excel"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedFiles.length === 0 && !processedData && !isProcessing && (
          <div className="text-center py-12" data-testid="empty-state">
            <div className="mx-auto max-w-md">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum arquivo carregado</h3>
              <p className="text-muted-foreground mb-6">Faça upload do arquivo CSV para começar o processamento dos dados</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>📊 Processamento automático de relatórios</p>
                <p>📈 Análise por filial e período</p>
                <p>📄 Exportação em formato Excel</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2024 NotaFlex. Desenvolvido para processamento eficiente de relatórios.</p>
            <p className="text-sm text-muted-foreground mt-2 sm:mt-0">Versão 1.5.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;