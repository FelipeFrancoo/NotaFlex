import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  isVisible: boolean;
  progress: number;
  currentFile?: number;
  totalFiles?: number;
}

export function ProcessingStatus({ isVisible, progress, currentFile = 0, totalFiles = 1 }: ProcessingStatusProps) {
  if (!isVisible) return null;

  return (
    <Card className="shadow-sm fade-in" data-testid="processing-status">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className="animate-spin">
            <Loader2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {totalFiles > 1 ? `Processando arquivo ${currentFile + 1} de ${totalFiles}...` : 'Processando arquivo...'}
            </h3>
            <p className="text-muted-foreground mb-4">Analisando dados e gerando relatórios</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-progress">
            Processando... {progress}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}