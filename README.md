# TripMind

Planificador de viajes conversacional. Le contás el viaje que tenés en mente
en lenguaje natural (*"3 días en Lisboa, ritmo relajado, comida y
arquitectura"*) y arma un itinerario día por día, en vivo, combinando:

- **Tus propias guías de viaje** (RAG sobre notas/PDFs subidas al proyecto).
- **Datos reales verificados** (clima y lugares vía APIs externas).
- **Conocimiento general del modelo**, marcando siempre de dónde salió cada dato.

Proyecto hecho para practicar LLMs en un caso real: tool use, RAG, streaming
y salida estructurada, sobre un stack Node/TypeScript + React.

## Cómo funciona

```
Usuario escribe el pedido
        │
        ▼
┌─────────────────────┐      1. Gemini decide qué tools llamar
│  Backend (Express)  │ ───► get_weather (OpenWeather)
│                     │ ───► get_places (Geoapify)
└─────────────────────┘
        │
        │ 2. Se arma un prompt aumentado:
        │    guías de viaje (RAG, ChromaDB) + datos de tools + pedido
        ▼
┌─────────────────────┐
│   Gemini (JSON      │  3. Devuelve el itinerario validado
│   estructurado)     │     contra un schema (Zod)
└─────────────────────┘
        │
        │ 4. Streaming día por día (SSE)
        ▼
┌─────────────────────┐
│  Frontend (React)   │  El itinerario se arma en vivo, tarjeta por tarjeta
└─────────────────────┘
```

Cada actividad del itinerario incluye un campo `source` que indica si el dato salió de una guía de viaje, de una API verificada, o del conocimiento general del modelo — para que quede claro qué es "inventado" y qué no.

## Stack técnico


| Parte                | Tecnología                                                 |
| -------------------- | ---------------------------------------------------------- |
| LLM                  | Gemini (`@google/genai`) — modelo configurable por env var |
| Backend              | Node.js, Express, TypeScript                               |
| Streaming            | Server-Sent Events (SSE)                                   |
| RAG                  | ChromaDB (vectores) + embeddings de Gemini                 |
| Validación de salida | Zod, contra `responseSchema` de Gemini                     |
| Frontend             | React + Vite                                               |
| APIs externas        | OpenWeatherMap (clima), Geoapify (lugares)                 |




## Decisiones técnicas que vale la pena mencionar

- **Salida estructurada con** `responseSchema`, no parseo de texto libre: el modelo devuelve JSON validado contra un schema Zod, reduciendo alucinaciones de formato.
- **Streaming con parseo parcial**: el JSON se va armando en el cliente día por día a medida que llegan chunks, sin esperar la respuesta completa (`utils/partialJson.ts`).
- **Mitigación de prompt injection**: el system prompt separa explícitamente "contexto de referencia" (guías, no confiable como instrucción) de "datos verificados" (tools), y le pide al modelo ignorar cualquier instrucción encontrada dentro de las guías. Hay un documento de prueba (`backend/src/rag/docs/`) usado justamente para verificar esto.
- **Control de costos**: cada llamada a Gemini se loguea con su costo estimado y hay un presupuesto máximo configurable (`GEMINI_MAX_BUDGET_USD`) que corta las llamadas si se supera.
- **Reintentos con backoff**: diferencia entre error recuperable (rate limit, servicio saturado) y no recuperable (cuota diaria agotada), para no reintentar cuando no tiene sentido.

## Tool use
- Como se mencionó anteriormente, el modelo usar 2 herramientas externas para obtener datos:
        * get_weather (OpenWeather)
        * get_places (Geoapify)
- Lo que ocurre aquí es que el modelo analiza el texto que envia el usuario y en base a la lista de tools que hay, decide a cual de ellas invocar. 
- Una vez que se obtiene este listado filtrado, el backend llama a estas APIS

### Codigo
* Ver el el service/itinerary.ts, se tiene una variable llamada tripDeclarations con la lista de funciones posibles a invocar, junto con su descripcion y parametros.
* con la variable ```functionCallingConfig``` se le indica al modelo como debe ejeuctar las tool, en este caso el mismo tiene el poder de decidir si ejecutarlas o no.

## Extraction
* Como se planteo también la posibilidad de inyectar pdf, estos no puedes ser partidos en chucks directamente, por lo que se utiliza una funcion llamada extractText, que recibe el path del pdf y devuelve el texto en un string.
* Recordar que los pdfs tienen un formato binario, por lo que no se puede leer directamente, se utiliza la libreria pdf-parse para parsear el pdf y obtener el texto.

## Requisitos

- Node.js 18+
- Una API key de [Gemini](https://ai.google.dev/), [OpenWeatherMap](https://openweathermap.org/api) y [Geoapify](https://www.geoapify.com/)
- ChromaDB corriendo localmente (ver abajo)



## Puesta en marcha



### 1. Variables de entorno

```bash
cd backend
cp .env.example .env
# completar GEMINI_API_KEY, OPENWEATHER_API_KEY, GEOAPIFY_API_KEY
```



### 2. Base de datos vectorial (ChromaDB)

Elegí una opción:

```bash
# Opción A: vía Python (la más estable)
pip install chromadb
chroma run --host localhost --port 8000 --path ./chroma-data

# Opción B: Docker
docker run -d -p 8000:8000 -v ./chroma-data:/data chromadb/chroma:1.5.3
```

Verificar que está arriba:

```bash
curl http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections
```



### 3. Ingesta de las guías de viaje

```bash
cd backend
npm install
npm run ingest
```



### 4. Backend

```bash
cd backend
npm run dev   # http://localhost:3000
```



### 5. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```



## Probar el endpoint sin frontend

```bash
curl -N -X POST http://localhost:3000/api/itinerary/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "3 días en Lisboa en octubre, ¿hace frío?"}'
```



## Evaluación automática

El proyecto incluye un set de 16 casos de prueba (`backend/src/eval/`) que evalúan cada itinerario generado con chequeos determinísticos (estructura, sin días duplicados) y un LLM-as-judge que da un score de 1 a 5.

```bash
cd backend
npm run eval
```

Un promedio por debajo del umbral configurado (`UMBRAL_MINIMO`) hace fallar el script — pensado para poder engancharlo a un CI y bloquear un deploy si la calidad del itinerario baja.

## Estado del proyecto / próximos pasos

- [ ] Exportar itinerario a PDF
- [ ] Mostrar el itinerario en un mapa
- [ ] Correr el eval en GitHub Actions en cada PR
- [ ] Recibir desde el front archivos a ser ingestados para que luego el usuario cuando realize la solicitud del cronograma, tenga también como referencia los archivos ingestados
- [ ] Deploy (frontend en Google Cloud, backend en Render/Railway)

## Licencia

MIT