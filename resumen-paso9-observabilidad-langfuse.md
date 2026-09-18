# Paso 9 — Evaluación, costos y observabilidad (en curso)

## Qué se implementó

- **Herramienta elegida**: Langfuse Cloud (free tier, sin self-host).
- **Instrumentación con OpenTelemetry**: se usó el SDK JS v5 de Langfuse (`@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`). OpenTelemetry representa el motor de procesamiento del tracing.
- Se instrumentaron las dos funciones principales de generación de itinerario en `services/itinerary.ts`:
  - **`generateItinerary`** (no streaming): usa `startActiveObservation`, que maneja el contexto automáticamente — útil porque toda la lógica vive dentro de una sola función.
  - **`streamItinerary`** (SSE, la que usa la app en producción): usa `startObservation` con cierre manual (`.end()`), porque el stream se consume afuera de la función (en la route) y no se puede usar el patrón de contexto automático.
- Cada trace captura: prompt del usuario, contexto RAG inyectado, tool calls (`get_weather`, `get_places`), output final (JSON del itinerario), tokens (prompt/completion/total) y costo estimado en USD.
- El `userId` (del token de Auth0) se asocia a cada trace para poder filtrar por usuario en el dashboard.
- Se instrumentó también `services/toolLoop.ts` (`resolveToolData`), que antes no tenía visibilidad propia — sus resultados se veían solo como texto embebido dentro del prompt de `gemini-call`. Ahora cada llamada a `get_weather` / `get_places` es un span propio (`asType: "tool"`), y cada decisión de Gemini sobre qué tool llamar es una generation propia (`tool-loop-decision-N`). Para esto, `trace` se pasa explícitamente como parámetro desde `generateItinerary`/`streamItinerary` → `buildFinalPrompt` → `resolveToolData`, usando `trace.startObservation(...)` (child explícito) en vez de depender del contexto automático — así funciona igual en ambas funciones, independientemente de si usan `startActiveObservation` o `startObservation` manual.

## Qué se aprendió / decisiones de instrumentación

- **`startActiveObservation` vs `startObservation`**: el primero es para código síncrono-de-flujo (todo pasa "adentro" de un callback); el segundo es necesario cuando el resultado (como un generator/stream) se consume después, en otro lugar del código.
- **Nombres de campos de uso de tokens**: en esta versión del SDK (`@langfuse/tracing@5.11.1`), `usageDetails` usa las claves genéricas `input` / `output` / `total` — no `promptTokens`/`completionTokens` (nombres que sí existen en otras versiones/otros SDKs y llevaron a un bug inicial de tokens en 0).
- **`userId` (y `sessionId`, `metadata`, `tags`) siempre van con `propagateAttributes`**: en la v5 del SDK, estos son "atributos propagables" — nunca se pasan como campo de `.update()` ni como parte de los atributos al crear un span con `startObservation()` (ambos intentos tiran error de tipos: no existen en `LangfuseSpanAttributes`). La única forma correcta es envolver el código que **crea** los spans dentro de `propagateAttributes({ userId }, callback)`. Esto aplica tanto para `generateItinerary` (contexto activo, con `startActiveObservation`) como para `streamItinerary` (contexto manual, con `startObservation`) — en este último caso, toda la función se envuelve en `propagateAttributes`, y el `userId` queda asociado a los spans desde el momento en que se crean, aunque el stream se termine de consumir después, afuera de la función.

## Infraestructura

- **Langfuse Cloud**: 1 proyecto (`My Project`), plan free.
- Variables de entorno agregadas al backend:
  ```
  LANGFUSE_PUBLIC_KEY=...
  LANGFUSE_SECRET_KEY=...
  LANGFUSE_BASE_URL=https://cloud.langfuse.com
  ```

## Archivos backend relevantes

- `instrumentation.ts` — crea el `LangfuseSpanProcessor` y arranca el `NodeSDK` de OpenTelemetry. Se importa como primera línea de `index.ts`.
- `services/itinerary.ts` — `generateItinerary` y `streamItinerary` instrumentadas con spans/generations de Langfuse.
- `services/promptBuilder.ts` — recibe `trace` y se lo reenvía a `resolveToolData`.
- `services/toolLoop.ts` — `resolveToolData` instrumentado: una generation por cada decisión de tool-use del modelo, y un span `tool` por cada llamada real a `get_weather`/`get_places`.

## Validado

- Traces visibles en el dashboard de Langfuse (Tracing → Table/Tree), con latencia, tokens, costo e input/output completos.
- Latencia total del trace (~11.9s) vs. latencia solo del modelo (~2.4s): permite ver que gran parte del tiempo está en la lógica propia (RAG, tool calls), no en Gemini.
- `userId` visible y filtrable en el dashboard, en ambas funciones. Si se prueba desde el backend solamente con el token de prueba que da Auth0, no se va a listar ningun usuario.

## Roles de librarias dentro del proyecto
- Relativo a este tema, se han instalado 3 librerías, las cuales, cada una tienen su propio rol dentro del proyecto:
  - `@langfuse/tracing`: es la API q se usa en el código con los metodos de startObservation, startActiveObservation, etc.
  - `@langfuse/otel`: traductor que toma los spans generado por OpenTelemetry y se los envia a Langfuse Cloud.
  - `@opentelemetry/sdk-node`: es el SDK de OpenTelemetry que se usa para crear el spans y generar los eventos de telemetria. Es un standard genérico usado por muchas librerias de observabilidad.

## Pendiente / próximo paso

- Revisar el **dashboard agregado** de Langfuse (costo total por día, llamadas más lentas, tasa de error) — no requiere código adicional, ya
  viene armado en Langfuse Cloud.
- Reusar los traces para el **Paso 6 original**: detectar itinerarios
  inconsistentes (fechas que no cierran, actividades repetidas) revisando
  los outputs guardados.