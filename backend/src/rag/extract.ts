// src/rag/extract.ts
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function extractText(filePath: string): Promise<string> {
  if (filePath.endsWith(".pdf")) {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy(); // libera memoria — la documentación insiste en esto
    return result.text;
  }
  return readFile(filePath, "utf-8");
}

/**
 * Igual que extractText, pero a partir de un buffer en memoria en vez de una
 * ruta de archivo. Se usa para los documentos que suben los usuarios (Paso 4):
 * el archivo original no se guarda en disco, solo se procesa y se descarta.
 *
 * `filename` se usa únicamente para decidir el formato por su extensión.
 */
export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  if (filename.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy(); // libera memoria — la documentación insiste en esto
    return result.text;
  }
  return buffer.toString("utf-8");
}