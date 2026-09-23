export const MAX_OUTPUT_TOKENS_MEMORY = 150;
export const MAX_OUTPUT_TOKENS_ITINERARY = 4096;  // itinerario completo en JSON
// Evita que un loop de tool-calling encadenado (o un modelo que insiste en
// pedir tools) genere llamadas ilimitadas y dispare el costo.
export const MAX_TOOL_LOOP_ITERATIONS = 5;
// Techo de tokens de output para cada tipo de llamada. Ajustar si el
// itinerario se corta (finishReason "MAX_TOKENS") o sobra margen.
export const MAX_OUTPUT_TOKENS_TOOL_LOOP = 512;   // solo decide qué tool llamar

// Igual criterio que MAX_CONTEXT_CHARS en buildAugmentedPrompt: cap duro
// para que los resultados de tools no inflen el contexto sin límite.
export const MAX_TOOL_DATA_CHARS = 3000;

// --- Orquestador (Paso 10: planificador + validador con LangGraph) ---
// El validador solo devuelve un JSON chico ({ valido, motivos }), no un
// itinerario completo, por eso el techo es bajo comparado con el resto.
export const MAX_OUTPUT_TOKENS_VALIDATOR = 512;
// Cuántas veces el planificador puede volver a intentar tras un rechazo del
// validador antes de rendirse y devolver el mejor intento disponible.
export const ORCHESTRATOR_MAX_INTENTOS = 2;

// Distancia máxima aceptada. La colección usa coseno explícito (ver
// ingest.ts y el getOrCreateCollection de acá abajo) — 0.6 es el valor
// calibrado con datos reales en promptBuilder.ts (que además siempre pasa
// su propio maxDistance, así que este default solo aplica a otros
// llamadores de retrieveContext que no lo especifiquen).
export const DEFAULT_MAX_DISTANCE = 0.6;

// --- Paso 11: identificación de lugar a partir de una imagen ---
// El resultado es un JSON chico ({ esLugarPuntual, lugar, pais, sugerencias }),
// no hace falta mucho margen.
export const MAX_OUTPUT_TOKENS_IMAGE_IDENTIFY = 256;
// Límite de tamaño de archivo subido (antes de pasar a base64, que pesa ~33% más).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
