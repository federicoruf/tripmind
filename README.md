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
| RAG                  | ChromaDB (vectores) + embeddings de Gemini — Chroma Cloud en producción, Chroma local en desarrollo |
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
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{"prompt": "3 días en Lisboa en octubre, ¿hace frío?"}'
```



## Evaluación automática

El proyecto incluye un set de 16 casos de prueba (`backend/src/eval/`) que evalúan cada itinerario generado con chequeos determinísticos (estructura, sin días duplicados) y un LLM-as-judge que da un score de 1 a 5.

```bash
cd backend
npm run eval
```

Un promedio por debajo del umbral configurado (`UMBRAL_MINIMO`) hace fallar el script — pensado para poder engancharlo a un CI y bloquear un deploy si la calidad del itinerario baja.

## Deploy

| Parte    | Dónde                              |
| -------- | ----------------------------------- |
| Frontend | Firebase Hosting                    |
| Backend  | Railway                             |
| Base de datos vectorial | Chroma Cloud (producción) |


## RAG — Métrica de distancia en Chroma (coseno vs L2²)

### El problema

`backend/src/rag/ingest.ts` (script que carga los documentos a Chroma) creaba la colección sin especificar `hnsw:space`, así que Chroma usaba su métrica por defecto: **L2 al cuadrado** (distancia euclidiana al cuadrado).
`backend/src/rag/retrieve.ts`, en cambio, asumía **similitud coseno** al calcular el umbral de relevancia (`maxDistance`).

La métrica de distancia de una colección de Chroma se fija **al crearla** y no se puede cambiar después: pedirle "coseno" a `getOrCreateCollection` sobre una colección que ya existe con otra métrica no tiene efecto, Chroma simplemente ignora esa parte de la metadata.

Como los embeddings de Gemini vienen normalizados (vector unitario), para vectores normalizados se cumple `L2² = 2 × distancia_coseno`. Un umbral pensado en escala coseno (`maxDistance = 0.5`, pensado como "aceptar similitud ≥ 0.5") terminaba exigiendo, en la métrica real (L2²), una similitud ≥ 0.75 — mucho más estricto de lo previsto. Resultado: **0 chunks recuperados en consultas reales, siempre, sin ningún error visible.**

### La solución

1. `rag/ingest.ts` ahora crea la colección con `metadata: { "hnsw:space": "cosine" }` explícito, igual que `rag/retrieve.ts`.
2. Como el espacio de una colección existente no se puede migrar in-place, hubo que **borrar y recrear** la colección:
   ```bash
   npx tsx backend/scripts/reset-rag-collection.ts   # borra la colección vieja
   npx tsx backend/src/rag/ingest.ts                 # la recrea con coseno y la repuebla
   ```
3. Con la métrica ya corregida, se recalibró `maxDistance` en `backend/src/services/promptBuilder.ts` usando distancias reales (obtenidas con `DEBUG_RAG=true`): los chunks relevantes de este corpus rondan 0.48–0.56, y los no relevantes arrancan recién en ~0.62. Se dejó `maxDistance = 0.6`.

### Cómo recalibrar en el futuro

Si se agregan nuevos documentos al RAG y deja de traer contexto (o trae contexto irrelevante), activar `DEBUG_RAG=true` en el `.env` del backend.
`rag/retrieve.ts` loguea, en cada consulta, las distancias crudas de **todos** los candidatos —no solo los que pasan el filtro— bajo `[rag:retrieve] Distancias crudas de los candidatos`. Con esos números reales, ajustar `maxDistance` en `services/promptBuilder.ts` en consecuencia — nunca a ciegas.

# Actualización de variables de ambiente
## Backend
1- Estas se listan en el archivo `.env` del backend
2- Al desplegar a prod, se deben actualizar las variables en Railway

## Frontend
1- Hay que cargar las variables dentro de la sección **Actions secrets and variables**

## Estado del proyecto / próximos pasos

- [ ] Exportar itinerario a PDF
- [ ] Mostrar el itinerario en un mapa
- [ ] Correr el eval en GitHub Actions en cada PR
- [ ] Recibir desde el front archivos a ser ingestados para que luego el usuario cuando realize la solicitud del cronograma, tenga también como referencia los archivos ingestados

## Limpieza automática de documentos vencidos

Los documentos que suben los usuarios (RAG privado) se conservan **30 días**.
Un job diario borra los vencidos, tanto los fragmentos cifrados en Chroma como
el registro en Postgres.

### Cómo funciona

```
GitHub Actions (cron diario)
        │  POST /internal/cleanup
        │  header: x-cron-secret
        ▼
Backend (Cloud Run) ──► busca documentos con expires_at vencido
                        ├─ borra sus fragmentos en Chroma
                        └─ borra el registro en Postgres
```

- El endpoint `POST /internal/cleanup` **no usa Auth0**: se protege con un
  secreto propio (`CRON_SECRET`) enviado en el header `x-cron-secret`.
  La comparación es en tiempo constante (`timingSafeEqual`). Si `CRON_SECRET`
  no está configurado, el endpoint responde `503` (falla cerrada).
- Por cada documento se borra primero en Chroma y después en Postgres. Si
  Chroma falla, el registro se conserva y la siguiente ejecución lo reintenta,
  para no dejar fragmentos huérfanos.
- Respuesta: `{ "found": n, "deleted": n, "failed": n }`. Devuelve `500` si
  `failed > 0`, de modo que la ejecución figure como fallida en GitHub.
- Los logs solo registran contadores, nunca nombres de archivo ni contenido.
- Como respaldo, la búsqueda semántica ya ignora fragmentos vencidos
  (`expires_at > now`), así que un documento vencido nunca llega a un
  itinerario aunque el job aún no haya corrido.

### Configuración

**1. Generar el secreto**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**2. Variable de entorno del backend**

Agregar `CRON_SECRET=<secreto>` en el `.env` local, en Railway (dev y prod) y en Cloud Run. Así de esta manera, se valida que el endpoint está protegido con un secreto valido. Github hara el request con el secreto que tiene guardado y este debe coinciden con el que esta guardado en el backend en Railway.

**3. Secrets en GitHub**

En el repo: *Settings → Secrets and variables → Actions → New repository secret*.

| Secret | Valor |
|---|---|
| `BACKEND_URL` | URL del backend en Cloud Run, sin `/` final |
| `CRON_SECRET` | El mismo valor configurado en el backend |


Ambos se guardan como secreto de manera de no exponer en los logs sus valores.

**4. Workflow**

Crear `.github/workflows/cleanup.yml`:

```yaml
name: cleanup-docs

on:
  schedule:
    - cron: "0 3 * * *" # todos los días, 03:00 UTC
  workflow_dispatch: # permite lanzarlo a mano desde la pestaña Actions

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Borrar documentos vencidos
        run: |
          curl -fsS -X POST "${{ secrets.BACKEND_URL }}/internal/cleanup" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

`-f` hace que `curl` falle ante un `4xx/5xx`, y así la ejecución queda en rojo.

### Probarlo

En local (con un documento de prueba cuyo `expires_at` esté en el pasado):

```bash
curl -X POST http://localhost:3000/internal/cleanup \
  -H "x-cron-secret: <tu secreto>"
# {"found":1,"deleted":1,"failed":0}
```

Sin el header, o con uno incorrecto, responde `401`.

En producción: pestaña *Actions → cleanup-docs → Run workflow*.

### Notas

- Los crons de GitHub Actions corren solo desde la rama por defecto y pueden
  retrasarse unos minutos.
- En repos públicos, GitHub desactiva los workflows programados tras 60 días
  sin actividad en el repo (avisa por email y se reactivan con un clic).
- Se eligió GitHub Actions en lugar de Cloud Scheduler porque este último exige
  vincular una cuenta de facturación. El endpoint es el mismo, así que migrar
  más adelante no requiere cambios de código.

## Licencia

MIT