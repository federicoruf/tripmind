# TripMind: herramientas de IA integradas

TripMind es un planificador de viajes conversacional. El usuario describe un viaje en lenguaje natural y recibe un itinerario día a día que combina sus documentos, guías de viaje, datos en vivo (clima y lugares) y el conocimiento del modelo. Este documento resume cada herramienta o técnica de IA del proyecto: qué es y para qué la uso aquí.

## Resumen

| Herramienta / técnica | Categoría | Uso en TripMind |
| --- | --- | --- |
| Google Gemini (`@google/genai`) | LLM | Genera itinerarios, valida, resume, actualiza la memoria e identifica imágenes |
| Gemini Embeddings | Embeddings | Convierte guías, documentos y consultas en vectores |
| RAG | Técnica | Aporta al prompt contexto de guías públicas y documentos privados |
| ChromaDB | Base vectorial | Guarda y busca los vectores de guías y documentos de usuario |
| LangGraph | Orquestación | Grafo planificador → validador con reintentos |
| Function calling (tools) | Técnica | El modelo decide cuándo pedir clima (`get_weather`) y lugares (`get_places`) |
| Structured output + Zod | Validación | Obliga a devolver JSON con un esquema fijo y lo valida |
| LLM-as-judge | Evaluación | Juzga la calidad del itinerario en el validador y en las evals |
| Golden dataset (evals) | Evaluación | Mide la calidad del pipeline con casos de referencia |
| Langfuse + OpenTelemetry | Observabilidad | Traza cada llamada al LLM: prompts, tokens, latencia, usuario |
| Memoria de usuario | Personalización | Resumen de preferencias de viaje que persiste entre peticiones |
| Visión multimodal | Visión | Identifica el lugar de una foto para proponer un viaje |
| Streaming SSE + JSON parcial | Entrega | Muestra los días del itinerario a medida que se generan |
| `pdf-parse` | Ingesta | Extrae el texto de PDFs para indexarlos en el RAG |
| Control de costes y reintentos | Fiabilidad | Presupuesto máximo, límites de tokens y backoff ante errores |

## Google Gemini (LLM)

**Qué es:** la familia de modelos de lenguaje de Google, usada mediante el SDK `@google/genai`. El modelo se configura con la variable `GEMINI_MODEL`.

**Para qué lo uso:** es el motor de todas las tareas de IA del backend:

- Generar el itinerario (nodo planificador).
- Decidir qué herramientas llamar en el bucle de tools.
- Validar el itinerario como juez (nodo validador).
- Actualizar el perfil de preferencias del usuario.
- Generar el resumen corto que se guarda en el historial.
- Identificar lugares a partir de imágenes.

## Gemini Embeddings

**Qué es:** un modelo que convierte texto en un vector numérico; textos con significado parecido quedan cerca en ese espacio. Uso `gemini-embedding-2-preview`.

**Para qué lo uso:** vectorizar los fragmentos de guías y de documentos de usuario al indexarlos (`RETRIEVAL_DOCUMENT`) y vectorizar el pedido del usuario al buscar (`RETRIEVAL_QUERY`). Los vectores se calculan a mano en `rag/embed.ts`, no con la función de embeddings de Chroma.

## RAG (Retrieval-Augmented Generation)

**Qué es:** una técnica que, antes de llamar al LLM, busca información relevante en una base de conocimiento y la añade al prompt. Así el modelo responde con datos concretos en lugar de solo con lo que sabe de memoria.

**Para qué lo uso:** tengo dos fuentes de RAG:

- **RAG público:** guías de viaje ingeridas con `npm run ingest` en la colección `tripmind_guides`.
- **RAG privado:** documentos `.pdf`, `.md` o `.txt` que sube cada usuario (máximo 10 MB y 5 por usuario), en la colección `tripmind_user_docs`.

El pipeline es: extraer el texto → trocearlo en fragmentos de unos 1.600 caracteres con 200 de solapamiento → generar embeddings → guardarlos en Chroma. Al consultar, se recuperan los fragmentos más cercanos, se filtran por umbral de distancia coseno, se eliminan duplicados y se inyectan en el prompt. Cada actividad del itinerario lleva un campo `source` que indica si vino de una guía, de un documento del usuario, de una tool o del propio modelo.

## ChromaDB

**Qué es:** una base de datos vectorial de código abierto, que guarda embeddings y permite búsquedas por similitud.

**Para qué lo uso:** es el almacén del RAG. En local uso un Chroma en `localhost:8000`; en producción, Chroma Cloud (se elige según exista `CHROMA_API_KEY`). Ambas colecciones usan distancia coseno. En la colección privada:

- El texto de cada fragmento se guarda **cifrado**, así que Chroma no ve contenido legible.
- Cada fragmento lleva `user_id`, `document_id` y `expires_at` para filtrar por usuario.
- Los documentos caducan a los 30 días; un job diario los borra.

## LangGraph

**Qué es:** un framework del ecosistema LangChain para orquestar flujos de LLM como un grafo de estados, con nodos, aristas y condiciones.

**Para qué lo uso:** orquestar la generación del itinerario en `orchestrator/graph.ts`:

1. **Planificador:** genera el itinerario (con tools y RAG).
2. **Validador:** lo revisa.
3. **Arista condicional:** si es válido, termina. Si no lo es y quedan intentos (máximo 2), vuelve al planificador con los motivos del rechazo. Si se agotan los intentos, entrega el último resultado y lo marca como no validado del todo.

Al final del grafo se actualiza la memoria del usuario, una sola vez y con el prompt original.

## Function calling (tools)

**Qué es:** la capacidad del LLM de pedir que se ejecute una función externa, con argumentos estructurados, cuando necesita datos que no tiene.

**Para qué lo uso:** en `services/toolLoop.ts`, Gemini decide en modo `AUTO` si llama a:

- `get_weather`: previsión del clima (OpenWeatherMap).
- `get_places`: lugares de interés (Geoapify).

El bucle tiene un máximo de 5 iteraciones y los resultados se recortan a 3.000 caracteres para controlar el coste y el tamaño del contexto. El prompt de sistema incluye la fecha de hoy para que las fechas relativas ("en octubre") se resuelvan hacia el futuro.

## Structured output + Zod

**Qué es:** *structured output* obliga al modelo a responder con JSON que cumpla un esquema (`responseSchema` de Gemini). Zod es una librería de TypeScript que valida datos en tiempo de ejecución.

**Para qué lo uso:** el itinerario, la identificación de imágenes y la respuesta del juez tienen esquemas definidos en `schemas/`. Gemini genera JSON con esa forma y Zod lo valida antes de usarlo, para que el frontend reciba siempre datos con estructura correcta.

## LLM-as-judge

**Qué es:** usar un LLM para evaluar la salida de otro LLM según criterios en lenguaje natural, por ejemplo coherencia con el pedido o con el presupuesto.

**Para qué lo uso:** en dos lugares:

- **Validador del grafo:** primero aplica reglas deterministas gratuitas (días duplicados o no consecutivos, actividades repetidas). Solo si pasan, llama al LLM para juzgar la coherencia con lo que pidió el usuario. Devuelve `{ valido, motivos }`.
- **Evals:** puntúa de 1 a 5 cada itinerario del golden dataset.

## Golden dataset (evaluación)

**Qué es:** un conjunto fijo de casos de prueba con su entrada y los criterios esperados, que sirve para medir la calidad de un sistema de IA a lo largo del tiempo.

**Para qué lo uso:** `npm run eval` ejecuta `eval/eval-runner.ts` sobre `golden-dataset.json`. Para cada caso, genera el itinerario con el pipeline real, hace chequeos deterministas y pide al juez (`gemini-3.1-flash-lite`) una nota de 1 a 5. Falla si el promedio es menor de 3,5, si algún caso queda por debajo de 3 o si más del 20 % de los casos queda bajo el umbral. Sirve para detectar regresiones al cambiar prompts o modelos.

## Langfuse + OpenTelemetry

**Qué es:** Langfuse es una plataforma de observabilidad para aplicaciones con LLM: trazas, prompts, respuestas, tokens, costes y latencias. OpenTelemetry es el estándar abierto de trazas sobre el que se apoya.

**Para qué lo uso:** `instrumentation.ts` arranca el SDK de OpenTelemetry con `LangfuseSpanProcessor`. En el código abro trazas (`generate-itinerary`, `identify-place`) y observaciones de tipo *generation* para cada decisión del bucle de tools y cada llamada al modelo. Cada traza lleva el `userId`. Así puedo depurar qué contexto recibió el modelo, qué tools llamó y cuánto costó cada petición.

## Memoria de usuario

**Qué es:** un patrón de memoria a largo plazo: un resumen persistente de lo que se sabe del usuario, que se añade a futuras peticiones.

**Para qué lo uso:** en `services/memoryUpdater.ts`, tras cada itinerario, Gemini combina la memoria anterior con el nuevo mensaje y produce un perfil de preferencias de hasta 3 líneas (ritmo, presupuesto, intereses, restricciones). Se guarda en Postgres y se incluye en el prompt de las siguientes generaciones.

## Visión multimodal (identificación de imágenes)

**Qué es:** la capacidad de un LLM multimodal de interpretar imágenes además de texto.

**Para qué lo uso:** el usuario sube una foto (JPEG, PNG o WebP, hasta 5 MB) y Gemini identifica el lugar y el país. Si no es un lugar concreto (por ejemplo, "una playa"), no inventa uno: sugiere 2 o 3 destinos reales parecidos. El resultado se usa como prompt del flujo normal de itinerario.

## Streaming SSE + parseo de JSON parcial

**Qué es:** Server-Sent Events permite al servidor enviar datos al navegador a medida que se generan. Un parser de JSON parcial (`best-effort-json-parser`) interpreta JSON aún incompleto.

**Para qué lo uso:** el itinerario se genera en streaming y el backend envía cada día en cuanto está completo, así el usuario ve aparecer el viaje progresivamente en vez de esperar a la respuesta entera.

## pdf-parse (ingesta de documentos)

**Qué es:** una librería de Node.js para extraer texto de archivos PDF.

**Para qué lo uso:** extraer el texto de las guías y de los PDFs que sube el usuario antes de trocearlos para el RAG. El archivo original no se guarda en disco: se procesa en memoria y se descarta.

## Control de costes y fiabilidad

**Qué es:** un conjunto de salvaguardas propias para usar un LLM de pago en producción.

**Para qué lo uso:**

- **Presupuesto máximo:** `costLogger.ts` calcula el coste en USD de cada llamada según los tokens y bloquea nuevas llamadas al superar `GEMINI_MAX_BUDGET_USD` (5 USD por defecto).
- **Límites de tokens de salida** por tipo de llamada: 4.096 para el itinerario, 512 para tools y validador, 256 para imágenes, 150 para memoria.
- **Reintentos con backoff** (`geminiRetry.ts`): hasta 3 intentos, respetando el `retryDelay` que indica la API ante errores de cuota.
- **Límite de fragmentos:** máximo 200 por documento, para acotar el coste de embeddings.

## Flujo de una petición

```
Usuario (React) ── prompt o foto ──▶ Backend Express (Auth0 JWT)
                                          │
              (foto) Gemini Vision ───────┤
                                          ▼
                         LangGraph: Planificador
                           ├─ Memoria del usuario (Postgres)
                           ├─ RAG: embeddings Gemini → Chroma (guías + docs privados)
                           ├─ Tools: get_weather / get_places
                           └─ Gemini + responseSchema → JSON del itinerario
                                          │
                         LangGraph: Validador
                           ├─ Reglas deterministas
                           └─ LLM-as-judge ── inválido ──▶ reintento (máx. 2)
                                          │ válido
                                          ▼
                 Streaming SSE al navegador + resumen + historial
                 Actualización de la memoria del usuario

  Todo el recorrido queda trazado en Langfuse (OpenTelemetry).
```
