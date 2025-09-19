import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, File, X, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onDocumentTypeChange?: (fileIndex: number, types: string[]) => void;
  documentTypes: Record<number, string[]>;
  isUploading: boolean;
  onProcessFiles: () => void;
  hasUploadedData?: boolean;
  onGenerateExcel?: () => void;
  isGeneratingExcel?: boolean;
}

export function FileUpload({ 
  onFileSelect, 
  selectedFiles, 
  onRemoveFile, 
  onDocumentTypeChange,
  documentTypes,
  isUploading,
  onProcessFiles,
  hasUploadedData = false,
  onGenerateExcel,
  isGeneratingExcel = false
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localDocumentTypes, setLocalDocumentTypes] = useState<Record<number, string[]>>(documentTypes || {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFiles = files.filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (csvFiles.length > 0) {
      onFileSelect([...selectedFiles, ...csvFiles]);
    } else {
      alert('Por favor, selecione apenas arquivos CSV');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const csvFiles = Array.from(files).filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
      onFileSelect([...selectedFiles, ...csvFiles]);
    }
    // Reset the file input value to allow selecting the same file again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleReset = () => {
    // Clear the selected files
    onFileSelect([]);
    // Reset document types
    setLocalDocumentTypes({});
    // Reset the file input's value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDocumentTypeChange = (fileIndex: number, type: string, checked: boolean) => {
    setLocalDocumentTypes(prev => {
      const currentTypes = prev[fileIndex] || ['A_PAGAR'];
      let newTypes;

      if (checked) {
        // Add type if not already present
        newTypes = currentTypes.includes(type) ? currentTypes : [...currentTypes, type];
      } else {
        // Remove type, but ensure at least one remains
        newTypes = currentTypes.filter(t => t !== type);
        if (newTypes.length === 0) {
          newTypes = ['A_PAGAR']; // Default fallback
        }
      }

      return { ...prev, [fileIndex]: newTypes };
    });

    // Call parent handler with updated types
    const currentTypes = localDocumentTypes[fileIndex] || ['A_PAGAR'];
    let newTypes;

    if (checked) {
      newTypes = currentTypes.includes(type) ? currentTypes : [...currentTypes, type];
    } else {
      newTypes = currentTypes.filter(t => t !== type);
      if (newTypes.length === 0) {
        newTypes = ['A_PAGAR'];
      }
    }

    onDocumentTypeChange?.(fileIndex, newTypes);
  };


  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Upload do Relatório CSV</h2>
          <p className="text-muted-foreground">Faça upload do arquivo CSV contendo o relatório semanal das notas fiscais</p>
        </div>

        <div 
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-all duration-300",
            isDragOver 
              ? "border-primary bg-primary/5 scale-[1.01]" 
              : "border-border hover:border-primary hover:bg-primary/2",
            isUploading && "pointer-events-none opacity-50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="upload-area"
        >
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Arraste e solte seu arquivo aqui</h3>
            <p className="text-muted-foreground mb-4">ou clique para selecionar</p>
            <Button 
              onClick={handleSelectClick}
              disabled={isUploading}
              data-testid="button-select-file"
            >
              Selecionar Arquivo CSV
            </Button>
          </div>
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv" 
            multiple
            className="hidden" 
            onChange={handleFileInputChange}
            data-testid="input-file"
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Formatos aceitos: CSV</span>
          <span>Tamanho máximo: 10MB</span>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">Arquivos Selecionados ({selectedFiles.length})</h3>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  disabled={isUploading}
                >
                  Remover Todos
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onProcessFiles}
                  disabled={isUploading}
                  data-testid="button-process-file"
                >
                  Processar {selectedFiles.length} Arquivo(s)
                </Button>
              </div>
            </div>
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="p-4 bg-muted rounded-lg fade-in" data-testid="file-info">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <File className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-foreground" data-testid="text-filename">{file.name}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-filesize">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onRemoveFile(index)}
                    disabled={isUploading}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Tipo de documento:</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`a-pagar-${index}`}
                        checked={(localDocumentTypes[index] || ['A_PAGAR']).includes('A_PAGAR')}
                        onCheckedChange={(checked) => handleDocumentTypeChange(index, 'A_PAGAR', checked as boolean)}
                        data-testid={`checkbox-a-pagar-${index}`}
                      />
                      <label 
                        htmlFor={`a-pagar-${index}`} 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        A pagar
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`a-receber-${index}`}
                        checked={(localDocumentTypes[index] || []).includes('A_RECEBER')}
                        onCheckedChange={(checked) => handleDocumentTypeChange(index, 'A_RECEBER', checked as boolean)}
                        data-testid={`checkbox-a-receber-${index}`}
                      />
                      <label 
                        htmlFor={`a-receber-${index}`} 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        A receber
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Excel export button integrated in the card */}
        {hasUploadedData && (
          <div className="flex justify-center mt-6 pt-6 border-t border-border">
            <Button
              onClick={onGenerateExcel}
              disabled={isGeneratingExcel}
              className="px-6 py-3"
            >
              {isGeneratingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isGeneratingExcel ? "Gerando..." : "Exportar Relatório para Excel"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}