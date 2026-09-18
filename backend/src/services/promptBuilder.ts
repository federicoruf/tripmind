import { LangfuseObservation } from "@langfuse/tracing";
import { retrieveContext } from "../rag/retrieve";
import { buildAugmentedPrompt } from "../utils/buildAugmentedPrompt";
import { resolveToolData } from "./toolLoop";

/**
 * Arma el prompt final (RAG + tool data) listo para pasarle a generateContent
 * o generateContentStream. Lo comparten la versión streaming y la no-streaming.
 */
export async function buildFinalPrompt(prompt: string, trace: LangfuseObservation): Promise<string> {
    const toolData = await resolveToolData(prompt, trace);
    const chunks = await retrieveContext(prompt, { topK: 4, maxDistance: 0.35 });
    return buildAugmentedPrompt(prompt, chunks, toolData);
  }