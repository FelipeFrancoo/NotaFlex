import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Info, Loader2 } from "lucide-react";
import { ProcessedData } from "@shared/schema";

interface DataPreviewProps {
  data: ProcessedData;
  onGenerateExcel: () => void;
  onReset: () => Promise<void>;
  isGeneratingExcel: boolean;
}

export function DataPreview({ data, onGenerateExcel, onReset, isGeneratingExcel }: DataPreviewProps) {
  const [isResetting, setIsResetting] = React.useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } catch (error) {
      console.error('Error during reset:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-8 fade-in" data-testid="data-preview">
      {/* Actions Section */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Exportar Relatório</h3>
              <p className="text-muted-foreground">Gerar arquivo Excel com formatação personalizada</p>
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={isResetting || isGeneratingExcel}
                data-testid="button-reset"
              >
                {isResetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                {isResetting ? "Limpando..." : "Processar Novamente"}
              </Button>
              
            </div>
          </div>


        </CardContent>
      </Card>
    </div>
  );
}