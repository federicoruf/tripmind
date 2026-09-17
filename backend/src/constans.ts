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
