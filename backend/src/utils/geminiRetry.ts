// utils/geminiRetry.ts
// Retry centralizado para llamadas a Gemini. Usado por services/itinerary.ts
// en las 3 llamadas al modelo (tool loop, generación no-streaming y streaming).

import { logStep, logWarn, logError } from "./logger";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  function getErrorInfo(error: any) {
    const status = error?.status ?? error?.error?.code;
    const details = error?.error?.details ?? [];
  
    const reason = details.find((d: any) => d["@type"]?.includes("ErrorInfo"))
      ?.reason;
  
    const retryDelayStr = details.find((d: any) =>
      d["@type"]?.includes("RetryInfo"),
    )?.retryDelay;
    const retryDelaySec = retryDelayStr ? parseInt(retryDelayStr, 10) : null;
  
    return { status, reason, retryDelaySec };
  }
  
  export async function conReintento<T>(
    fn: () => Promise<T>,
    intentos = 3,
  ): Promise<T> {
    for (let i = 0; i < intentos; i++) {
        logStep("service:geminiRetry", `Llamando a Gemini (intento ${i + 1}/${intentos})`);
      try {
        // Si todo marcha bien, devuelve el resultado.
        return await fn();
      } catch (error: any) {
        const { status, reason, retryDelaySec } = getErrorInfo(error);
  
        // Cuota diaria agotada: reintentar no sirve, cortar ya.
        if (status === 429 && reason === "quota_exceeded") {
          throw new Error(
            "Cuota diaria de Gemini agotada. No reintentar, avisar al usuario.",
          );
        }
  
        // Rate limit por minuto (429) o servicio saturado (503): sí conviene reintentar.
        const esReintentable = status === 429 || status === 503;
        const esUltimoIntento = i === intentos - 1;
  
        if (!esReintentable || esUltimoIntento) {
          logError("service:geminiRetry", "Error no recuperable", error);
          throw error;
        }
  
        // Preferí el retryDelay que sugiere Gemini; si no viene, backoff exponencial.
        const segundos = retryDelaySec ?? 2 ** i;
        logWarn("service:geminiRetry", `${status}: reintentando en ${segundos}s`, {
          intento: i + 1,
          intentos,
        });
        await sleep(segundos * 1000 + 500); // margen extra
      }
    }
    throw new Error("No se pudo completar la llamada a Gemini tras varios reintentos.");
  }