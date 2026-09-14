import { RetrievedChunk } from "../rag/retrieve";
// utils/buildAugmentedPrompt.ts

// ~4 caracteres por token es una aproximación estándar para español/inglés.
// Ajustá este número según el límite real de tu modelo y cuánto espacio
// querés dejar para el resto del prompt + la respuesta.
const MAX_CONTEXT_CHARS = 6000;

function truncateChunks(chunks: RetrievedChunk[], maxChars: number): string {
  const parts: string[] = [];
  let usedChars = 0;

  for (const c of chunks) {
    const fragmento = `<fragmento fuente="${c.source}">\n${c.content}\n</fragmento>`;

    if (usedChars + fragmento.length > maxChars) {
      // Si ni el primer chunk entra completo, lo cortamos igual
      // para no dejar el contexto totalmente vacío.
      if (parts.length === 0) {
        const espacioRestante = maxChars - usedChars;
        parts.push(fragmento.slice(0, espacioRestante) + "\n[...truncado]");
      }
      break;
    }

    parts.push(fragmento);
    usedChars += fragmento.length;
  }

  return parts.join("\n\n");
}
export function buildAugmentedPrompt(
  userQuestion: string,
  chunks: RetrievedChunk[],
  toolData?: string,
): string {
  const contextBlock = chunks.length
    ? truncateChunks(chunks, MAX_CONTEXT_CHARS)
    : "(sin contexto relevante encontrado)";

  const toolBlock = toolData
    ? `\n\n<datos_tiempo_real>\n${toolData}\n</datos_tiempo_real>`
    : "";

  if (process.env.DEBUG_RAG === "true") {
    console.log('RAG RESULT: ', contextBlock, ',  toolBlock: ',toolBlock);
  }
  return `<contexto_referencia>
${contextBlock}
</contexto_referencia>${toolBlock}

<pregunta_usuario>
${userQuestion}
</pregunta_usuario>`;
}
