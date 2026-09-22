// utils/logger.ts
//
// Logger mínimo para ver por consola, en vivo, en qué etapa del flujo
// planificador ⇄ validador está un pedido — complementa a Langfuse (que
// guarda todo para análisis posterior) con algo legible de un vistazo
// mientras se prueba con curl/Postman.
//
// Formato fijo en las tres funciones, para que sea fácil de grep-ear:
//   [HH:MM:SS.mmm] [scope] mensaje {data}

function timestamp(): string {
  // "12:34:56.789" — se descarta la fecha, no hace falta para logs en vivo.
  return new Date().toISOString().split("T")[1].replace("Z", "");
}

export function logStep(
  scope: string,
  mensaje: string,
  data?: Record<string, unknown>,
): void {
  const sufijo = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp()}] [${scope}] ${mensaje}${sufijo}`);
}

export function logWarn(
  scope: string,
  mensaje: string,
  data?: Record<string, unknown>,
): void {
  const sufijo = data ? ` ${JSON.stringify(data)}` : "";
  console.warn(`[${timestamp()}] [${scope}] ${mensaje}${sufijo}`);
}

export function logError(scope: string, mensaje: string, err?: unknown): void {
  console.error(`[${timestamp()}] [${scope}] ${mensaje}`, err);
}

/**
 * Recorta un texto largo (prompts, itinerarios completos) para que no
 * inunde la consola. Solo para logging — nunca usar sobre datos que
 * después se vuelven a parsear.
 */
export function previewTexto(texto: string, maxChars = 100): string {
  return texto.length > maxChars ? `${texto.slice(0, maxChars)}…` : texto;
}
