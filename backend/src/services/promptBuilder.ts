import { LangfuseObservation } from "@langfuse/tracing";
import { retrieveContext } from "../rag/retrieve";
import { retrieveUserContext } from "../rag/retrieveUserDocs";
import { buildAugmentedPrompt } from "../utils/buildAugmentedPrompt";
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
 */
export async function buildFinalPrompt(
  prompt: string,
  trace: LangfuseObservation,
  userId: string,
): Promise<string> {
    const toolData = await resolveToolData(prompt, trace);
    const [userChunks, guideChunks] = await Promise.all([
      retrieveUserContext(userId, prompt, { topK: 4, maxDistance: DEFAULT_MAX_DISTANCE }),
      retrieveContext(prompt, { topK: 4, maxDistance: DEFAULT_MAX_DISTANCE }),
    ]);
    const chunks = [...userChunks, ...guideChunks];
    return buildAugmentedPrompt(prompt, chunks, toolData);
  }