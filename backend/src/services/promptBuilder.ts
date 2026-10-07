import { LangfuseObservation } from "@langfuse/tracing";
import { retrieveContext } from "../rag/retrieve";
import { retrieveUserContext } from "../rag/retrieveUserDocs";
import { buildAugmentedPrompt, type PromptChunk } from "../utils/buildAugmentedPrompt";
import { resolveToolData } from "./toolLoop";
import { DEFAULT_MAX_DISTANCE } from "../constans";

/**
 * Arma el prompt final (RAG + tool data) listo para pasarle a generateContent
 * o generateContentStream. Lo comparten la versión streaming y la no-streaming.
 *
 * Busca en paralelo en las guías públicas (retrieveContext) y en los
 * documentos propios del usuario (retrieveUserContext, Paso 6) y los mezcla.
 * Los del usuario van primero: son más específicos a su viaje que las guías
 * genéricas, y buildAugmentedPrompt trunca por caracteres, así que lo más
 * relevante para el usuario no es lo primero que se corta si el contexto
 * combinado no entra completo.
 *
 * Devuelve DOS versiones del prompt:
 * - `prompt`: la real, con los fragmentos del usuario ya descifrados. Es la
 *   única que se manda a Gemini.
 * - `tracePrompt`: idéntica en estructura, pero con los fragmentos del
 *   usuario reemplazados por un marcador. Es la que se guarda en Langfuse.
 */
export interface FinalPrompt {
  prompt: string;
  tracePrompt: string;
  usedPrivate: boolean;
}

export async function buildFinalPrompt(
  prompt: string,
  trace: LangfuseObservation,
  userId: string,
): Promise<FinalPrompt> {
    const toolData = await resolveToolData(prompt, trace);
    const [userRaw, guideChunks] = await Promise.all([
      retrieveUserContext(userId, prompt, { topK: 4, maxDistance: DEFAULT_MAX_DISTANCE }),
      retrieveContext(prompt, { topK: 4, maxDistance: DEFAULT_MAX_DISTANCE }),
    ]);
    const userChunks: PromptChunk[] = userRaw.map((c) => ({ ...c, privado: true }));
    const chunks: PromptChunk[] = [...userChunks, ...guideChunks];
    return {
      prompt: buildAugmentedPrompt(prompt, chunks, toolData),
      tracePrompt: buildAugmentedPrompt(prompt, chunks, toolData, { redactPrivate: true }),
      usedPrivate: userChunks.length > 0,
    };
  }