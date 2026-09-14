import { GenerateContentResponseUsageMetadata } from "@google/genai";

type ModelPricing = {
  input: number; // $ por 1M tokens de input
  cachedInput?: number; // $ por 1M tokens cacheados
  output: number; // $ por 1M tokens de output
};

// Precios oficiales: https://ai.google.dev/gemini-api/docs/pricing
// (verificar de tanto en tanto, cambian)
const PRICING: Record<string, ModelPricing> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-2.5-flash": { input: 0.3, cachedInput: 0.075, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
};

export interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

export interface RequestCostLog {
  timestamp: string;
  model: string;
  route: string; // ej: "generate-itinerary", "stream-itinerary"
  usage: GenerateContentResponseUsageMetadata;
  costUsd: number;
}

const logs: RequestCostLog[] = [];

export function logRequestCost(
  model: string,
  route: string,
  usage: GenerateContentResponseUsageMetadata,
): RequestCostLog {
  const p = PRICING[model];
  if (!p) {
    console.warn(
      `[costLogger] Modelo desconocido: ${model}, no se calcula costo.`,
    );
  }

  const promptTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  const inputCost = p ? (promptTokens / 1_000_000) * p.input : 0;
  const outputCost = p ? (outputTokens / 1_000_000) * p.output : 0;

  const costUsd = inputCost + outputCost;

  const entry: RequestCostLog = {
    timestamp: new Date().toISOString(),
    model,
    route,
    usage,
    costUsd,
  };

  logs.push(entry);
  console.log(
    `[cost] ${route} | ${model} | in=${promptTokens} out=${outputTokens} | $${costUsd.toFixed(6)}`,
  );

  return entry;
}

export function getTotalCost(): number {
  return logs.reduce((sum, l) => sum + l.costUsd, 0);
}

export function getLogs(): RequestCostLog[] {
  return logs;
}
