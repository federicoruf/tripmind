import { RetrievedChunk } from "../rag/retrieve";
import { logStep, previewTexto } from "./logger";
// utils/buildAugmentedPrompt.ts

// ~4 caracteres por token es una aproximación estándar para español/inglés.
// Ajustá este número según el límite real de tu modelo y cuánto espacio
// querés dejar para el resto del prompt + la respuesta.
const MAX_CONTEXT_CHARS = 6000;

// Chunk del prompt. `privado: true` marca fragmentos que vienen de documentos
// del usuario (RAG privado): el prompt que va a Gemini los incluye completos,
// pero la versión para logs/Langfuse (`redactPrivate`) los reemplaza por un
// marcador sin contenido.
export type PromptChunk = RetrievedChunk & { privado?: boolean };

export interface BuildPromptOptions {
  redactPrivate?: boolean;
}

function formatFragmento(source: string, content: string): string {
  return `<fragmento fuente="${source}">\n${content}\n</fragmento>`;
}

function truncateChunks(
  chunks: PromptChunk[],
  maxChars: number,
  redactPrivate = false,
): string {
  const parts: string[] = [];
  let usedChars = 0;

  for (const c of chunks) {
    // El largo se mide SIEMPRE con el contenido real, así la versión
    // redactada trunca exactamente igual que la que se manda a Gemini.
    const fragmento = formatFragmento(c.source, c.content);
    const ocultar = redactPrivate && c.privado === true;
    const visible = ocultar
      ? formatFragmento(
          "Tu documento",
          `[contenido privado omitido · ${c.content.length} caracteres]`,
        )
      : fragmento;

    if (usedChars + fragmento.length > maxChars) {
      // Si ni el primer chunk entra completo, lo cortamos igual
      // para no dejar el contexto totalmente vacío.
      if (parts.length === 0) {
        const espacioRestante = maxChars - usedChars;
        parts.push(
          (ocultar ? visible : fragmento.slice(0, espacioRestante)) + "\n[...truncado]",
        );
      }
      break;
    }

    parts.push(visible);
    usedChars += fragmento.length;
  }

  return parts.join("\n\n");
}
export function buildAugmentedPrompt(
  userQuestion: string,
  chunks: PromptChunk[],
  toolData?: string,
  options: BuildPromptOptions = {},
): string {
  const sinContexto = "(sin contexto relevante encontrado)";
  const contextBlock = chunks.length
    ? truncateChunks(chunks, MAX_CONTEXT_CHARS, options.redactPrivate)
    : sinContexto;

  const toolBlock = toolData
    ? `\n\n<datos_tiempo_real>\n${toolData}\n</datos_tiempo_real>`
    : "";

  if (process.env.DEBUG_RAG === "true") {
    logStep("rag:buildAugmentedPrompt", "Prompt aumentado armado", {
      // Siempre la versión redactada: nunca loguear texto de documentos del usuario.
      contexto: previewTexto(
        chunks.length ? truncateChunks(chunks, MAX_CONTEXT_CHARS, true) : sinContexto,
        150,
      ),
      toolData: toolData ? previewTexto(toolData, 150) : null,
    });
  }
  return `<contexto_referencia>
${contextBlock}
</contexto_referencia>${toolBlock}

<pregunta_usuario>
${userQuestion}
</pregunta_usuario>`;
}