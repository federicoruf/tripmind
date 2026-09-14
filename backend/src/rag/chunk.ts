// src/rag/chunk.ts
export interface Chunk {
    content: string;
    source: string;
    index: number;
  }
  
  const CHUNK_SIZE_CHARS = 1600; // ~400 tokens, aprox. 4 chars/token
  const OVERLAP_CHARS = 200;
  
  export function chunkText(text: string, source: string): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;
  
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
      const content = text.slice(start, end).trim();
  
      if (content.length > 0) {
        chunks.push({ content, source, index });
        index++;
      }
  
      start += CHUNK_SIZE_CHARS - OVERLAP_CHARS; // avanza menos que el tamaño → overlap
    }
  
    return chunks;
  }