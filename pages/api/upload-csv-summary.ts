import type { NextApiRequest, NextApiResponse } from "next";
import * as formidable from "formidable";
import * as fs from "fs";
import * as path from "path";
import { processarResumoFiliais, DadosResumo } from "../../lib/resumo-processor";

const storage: { [key: string]: any } = {};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Metodo nao permitido" });
  }

  try {
    console.log("=== INICIANDO PROCESSAMENTO DE RESUMO ===");
    
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const form = formidable.default({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 10,
      multiples: true,
      filename: (name: string, ext: string) => {
        return `upload_${Date.now()}_${Math.random().toString(36).substring(2)}${ext}`;
      }
    });

    const [fields, files] = await form.parse(req);
    
    let allFiles: formidable.File[] = [];
    
    Object.values(files).forEach(fileArray => {
      if (Array.isArray(fileArray)) {
        allFiles = allFiles.concat(fileArray);
      } else if (fileArray) {
        allFiles.push(fileArray as any);
      }
    });

    const csvFiles = allFiles.filter(file => {
      if (!file || !file.originalFilename) return false;
      const ext = path.extname(file.originalFilename).toLowerCase();
      return ext === ".csv";
    });

    if (csvFiles.length === 0) {
      allFiles.forEach(file => {
        if (file && file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      });
      
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo CSV foi encontrado"
      });
    }

    const multerFiles: Express.Multer.File[] = csvFiles.map(file => ({
      fieldname: "files",
      originalname: file.originalFilename || "arquivo.csv",
      encoding: "7bit",
      mimetype: file.mimetype || "text/csv",
      size: file.size,
      destination: tempDir,
      filename: path.basename(file.filepath),
      path: file.filepath,
      stream: {} as any,
      buffer: Buffer.alloc(0)
    }));

    const summaryData: DadosResumo = processarResumoFiliais(multerFiles);

    storage["summaryData"] = summaryData;

    try {
      const cachePath = path.join(tempDir, "last_summary.json");
      fs.writeFileSync(cachePath, JSON.stringify(summaryData, null, 2), "utf8");
    } catch (cacheError) {
      console.warn("Nao foi possivel salvar cache:", cacheError);
    }

    multerFiles.forEach(file => {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    res.json({
      success: true,
      message: `${csvFiles.length} arquivo(s) processado(s) com sucesso`,
      data: summaryData
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Erro ao processar arquivos: " + (error instanceof Error ? error.message : String(error))
    });
  }
}

export function getSummaryData(): DadosResumo | null {
  return storage["summaryData"] || null;
}
