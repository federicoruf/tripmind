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

// --- Presupuesto ---
// Se lee en cada chequeo (no una sola vez al cargar el módulo) para poder
// testearlo con distintos valores y permitir cambiarlo en runtime sin reiniciar.
function getMaxBudget(): number {
  return Number(process.env.GEMINI_MAX_BUDGET_USD) || 5; // $5 por defecto
}
const WARN_THRESHOLD_RATIO = 0.8; // avisa al llegar al 80% del presupuesto

let avisoYaEmitido = false; // para no spamear el warning en cada llamada

/**
 * Chequea el gasto acumulado contra el presupuesto configurado.
 * - Tira error si ya se superó el presupuesto (para cortar antes de la
 *   siguiente llamada a Gemini y no seguir gastando).
 * - Loguea un warning una sola vez al cruzar el 80%.
 *
 * Llamar ANTES de cada llamada a Gemini (no alcanza con llamarlo después de
 * loguear el costo, porque para entonces la llamada ya se pagó).
 */
export function assertBudgetOk(): void {
  const total = getTotalCost();
  const maxBudget = getMaxBudget();

  if (total >= maxBudget) {
    throw new Error(
      `Presupuesto de Gemini agotado: $${total.toFixed(4)} de $${maxBudget} usados. ` +
        `No se realizan más llamadas.`,
    );
  }

  if (!avisoYaEmitido && total >= maxBudget * WARN_THRESHOLD_RATIO) {
    avisoYaEmitido = true;
    console.warn(
      `[costLogger] Aviso: se alcanzó el ${(WARN_THRESHOLD_RATIO * 100).toFixed(0)}% ` +
        `del presupuesto ($${total.toFixed(4)} de $${maxBudget}).`,
    );
  }
}

// Solo para tests: resetea el estado del aviso entre casos.
export function _resetAvisoParaTests(): void {
  avisoYaEmitido = false;
}

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