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