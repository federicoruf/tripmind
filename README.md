# TripMind

TripMind is a conversational trip planner. You describe a trip in natural language
(*"3 days in Lisbon, relaxed pace, food and architecture"*) and the app builds a
day-by-day itinerary in the browser, combining:

- **Your own travel documents** (private RAG over notes, PDFs, Markdown, or text
  you upload).
- **Shared travel guides** (public RAG over ingested guides).
- **Verified live data** (weather and places from external APIs).
- **The language model's general knowledge**, with an explicit `source` on each
  activity so it is clear what came from a guide, a tool, a user document, or
  the model itself.

The stack is Node.js / TypeScript on the backend and React / Vite on the
frontend. Auth is handled with Auth0. Generation is orchestrated with LangGraph
(planner + validator), streamed to the UI over Server-Sent Events (SSE), and
validated against a Zod schema.

## Purpose

TripMind exists to turn a vague travel request into a structured itinerary
without asking the user to fill a long form.

It is also a practical LLM application: tool calling, retrieval-augmented
generation, structured JSON output, streaming, user memory, private document
ingestion, and cost control (budget cap, retries with backoff, token ceilings).

Typical flows:

- Log in, type a prompt, and watch days appear as the itinerary is assembled.
- Upload a photo of a place so the model can identify it and suggest a trip.
- Upload personal `.pdf`, `.md`, or `.txt` files (max 10 MB, max 5 per user).
  Fragments are encrypted at rest in Chroma and expire after 30 days.
- Delete a document at any time; a daily job also removes expired ones.

## Folder Structure

```
tripmind/
├── backend/
│   ├── Dockerfile                 # Image for Render
│   ├── script_sql/                # Postgres schema (user_documents)
│   ├── bruno/TripMind/            # HTTP collection for local/prod API calls
│   └── src/
│       ├── index.ts               # Express app and route registration
│       ├── db.ts                  # Postgres pool
│       ├── documents.ts           # Document metadata access
│       ├── memory.ts              # Per-user travel memory
│       ├── middleware/            # Auth0 JWT
│       ├── routes/                # itinerary, documents, image, internal
│       ├── services/              # itinerary, RAG prompt, tools, cleanup
│       ├── orchestrator/          # LangGraph planner ↔ validator
│       ├── rag/                   # ingest, retrieve, chunk, embed, Chroma
│       ├── tools/                 # get_weather / get_places declarations
│       ├── schemas/               # Gemini + Zod schemas
│       ├── eval/                  # Golden dataset and LLM-as-judge runner
│       └── utils/                 # SSE, crypto, cost, retries, logging
├── frontend/
│   ├── src/                       # React UI, hooks, and unit tests
│   └── firebase.json              # Firebase Hosting
├── .github/workflows/             # Cleanup cron + Firebase Hosting
├── openspec/                      # Spec-driven change history
├── start.sh                       # Local helper: backend + frontend
└── README.md
```

## Technologies

| Area                    | Technology |
| ----------------------- | ---------- |
| LLM                     | Gemini (`@google/genai`), model via `GEMINI_MODEL` |
| Backend                 | Node.js, Express, TypeScript |
| Orchestration           | LangGraph (planner node + validator node) |
| Streaming               | Server-Sent Events (SSE) |
| Output validation       | Zod + Gemini `responseSchema` |
| RAG                     | ChromaDB (cosine space) + Gemini embeddings |
| Relational data         | PostgreSQL (`pg`) |
| Auth                    | Auth0 (SPA + JWT on the API) |
| Frontend                | React 19, Vite, Auth0 React SDK |
| External APIs           | OpenWeatherMap, Geoapify |
| Observability           | Langfuse + OpenTelemetry |
| Document text           | `pdf-parse` |
| API exploration         | Bruno (`backend/bruno/TripMind`) |
| Unit tests              | Node.js test runner (`tsx --test` / `node --test`) |
| Quality eval            | Golden dataset + LLM-as-judge (`npm run eval`) |
| Deploy                  | Frontend: Firebase Hosting. Backend: Render. Vectors: Chroma Cloud in production |

## Production Deployment

The production backend runs as a free Render Web Service at
[`https://tripmind-c2dm.onrender.com`](https://tripmind-c2dm.onrender.com).
PostgreSQL runs on Neon: the Neon `main` branch is production and its `dev`
branch is used for development. Chroma remains on Chroma Cloud. Firebase,
Auth0, and Langfuse were not changed as part of this deployment migration.

The Render service uses Node.js, builds with `npm install && npm run build`,
and starts with `node dist/index.js`. The application must listen on the port
provided by `process.env.PORT` and on `0.0.0.0`.

Render is configured to check `/health`. **The current backend source does not
yet register this endpoint**, so it must be implemented before this health
check can be relied upon. It should return `200` without querying external
services.

Production configuration includes `DATABASE_URL` (Neon), Auth0 variables,
Gemini variables, `DOCS_MASTER_KEY`, `CRON_SECRET`, Langfuse variables, Chroma
Cloud credentials, and the weather/place API keys. `FRONTEND_URL` must be set
to `https://mytripmind-io.web.app` so CORS permits its `GET`, `POST`, and
`DELETE` requests. The frontend `VITE_API_URL` and GitHub Actions
`BACKEND_URL` must both use the Render URL; GitHub Actions `CRON_SECRET` must
match Render's value.

Render's free service can sleep after approximately 15 minutes without traffic.
The first request after it wakes up can therefore be slower than usual.

## Architecture

```
  Browser (React + Vite + Auth0)
        │  JWT
        │  POST /api/itinerary/stream   (SSE)
        │  POST /api/documents/upload
        │  GET  /api/documents
        │  DELETE /api/documents/:id
        │  POST /api/image/...
        ▼
┌───────────────────────────────────┐
│  Backend (Express)                │
│                                   │
│  checkJwt (Auth0)                 │
│           │                       │
│           ▼                       │
│  LangGraph orchestrator           │
│    planificador → validador       │
│    (retry until valid or cap)     │
│           │                       │
│           ├─ Gemini tool loop     │
│           │    get_weather        │
│           │    get_places         │
│           ├─ RAG retrieve         │
│           │    public guides      │
│           │    user docs (decrypt)│
│           └─ user memory (PG)     │
│                                   │
│  Zod-validated itinerary JSON     │
└───────────────────────────────────┘
        │
        ├── PostgreSQL     metadata, user_memory, user_documents
        ├── ChromaDB       embeddings (public guides + encrypted user chunks)
        └── Gemini         generation, embeddings, image identify, eval judge

GitHub Actions (daily) ──POST /internal/cleanup──► drop expired user documents
```

Request path for an itinerary:

1. The user sends a natural-language prompt. The route authenticates the JWT
   and takes `userId` from the token (`sub`), never from the body.
2. The orchestrator runs the planner. Gemini may call `get_weather` and
   `get_places`. The prompt is augmented with RAG context and user memory.
3. Gemini returns JSON that must match the itinerary schema. The validator
   node can send the planner back with feedback (up to two attempts).
4. The final itinerary is sent to the client over SSE, day by day. Each
   activity includes `source`.
5. User memory is updated once, from the original prompt (not from retry
   prompts).

Private documents: the original file is not stored. Text is chunked, embedded,
encrypted (AES-256-GCM with a key derived from `DOCS_MASTER_KEY` + `user_id`),
and written to a separate Chroma collection. Postgres keeps only metadata and
expiry.

## Setup Instructions

### Prerequisites

- Node.js 18+ (20 recommended; the backend Docker image uses Node 20)
- npm
- Docker (PostgreSQL and, optionally, local Chroma)
- API keys:
  [Gemini](https://ai.google.dev/),
  [OpenWeatherMap](https://openweathermap.org/api),
  [Geoapify](https://www.geoapify.com/)
- An Auth0 application (SPA) and API audience
- Python + Chroma **or** Docker, if you run Chroma locally instead of Chroma Cloud

Clone the repository and stay at the repo root for the steps below.

```bash
git clone <repository-url>
cd tripmind
```

### PostgreSQL via Docker

Postgres stores user-document metadata and per-user memory. Production uses
Neon; its `main` branch is production and its `dev` branch is for development.
For local development you can
run PostgreSQL in Docker:

```bash
docker run -d \
  --name tripmind-postgres \
  -e POSTGRES_USER=tripmind \
  -e POSTGRES_PASSWORD=tripmind \
  -e POSTGRES_DB=tripmind \
  -p 5432:5432 \
  postgres:16
```

Apply the document schema:

```bash
docker exec -i tripmind-postgres \
  psql -U tripmind -d tripmind < backend/script_sql/001_user_documents.sql
```

You also need a `user_memory` table (`user_id`, `resumen_texto`, `updated_at`)
if it is not already present on that database.

Point the backend at this instance:

```text
DATABASE_URL=postgresql://tripmind:tripmind@localhost:5432/tripmind
```

`backend/src/db.ts` enables SSL for hosted PostgreSQL. If a local container rejects SSL,
adjust that client config for local use, or use a hosted database that
supports SSL.

Stop and remove the container when you no longer need it:

```bash
docker stop tripmind-postgres
docker rm tripmind-postgres
```

### Backend

```bash
cd backend
cp .env.example .env
```

Fill at least:

| Variable | Role |
| -------- | ---- |
| `GEMINI_API_KEY` | LLM, embeddings, eval judge |
| `OPENWEATHER_API_KEY` | `get_weather` |
| `GEOAPIFY_API_KEY` | `get_places` |
| `DATABASE_URL` | Postgres (see previous section) |
| `AUTH0_DOMAIN` | JWT issuer host, without `https://` |
| `AUTH0_AUDIENCE` | API audience |
| `DOCS_MASTER_KEY` | 32-byte hex key for user-document encryption |
| `CRON_SECRET` | Protects `POST /internal/cleanup` |
| `FRONTEND_URL` | CORS origin (`http://localhost:5173` locally) |
| `PORT` | Defaults to `3000` |

Optional: `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` for Chroma Cloud.
If those are empty, the backend uses Chroma on `localhost:8000`.

Optional: `GEMINI_MODEL`, `GEMINI_MAX_BUDGET_USD`, `DEBUG_RAG`, Langfuse keys.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start Chroma locally (pick one):

```bash
# Option A — Python
pip install chromadb
chroma run --host localhost --port 8000 --path ./chroma-data

# Option B — Docker
docker run -d -p 8000:8000 -v ./chroma-data:/data chromadb/chroma:1.5.3
```

Install, ingest public guides, and run the API:

```bash
cd backend
npm install
npm run ingest
npm run dev
```

The API listens on [http://localhost:3000](http://localhost:3000).

Smoke-test streaming (replace the token with a valid Auth0 access token):

```bash
curl -N -X POST http://localhost:3000/api/itinerary/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "3 days in Lisbon in October, is it cold?"}'
```

Bruno requests live under `backend/bruno/TripMind/` (local and prod
environments). Do not commit live tokens.

Backend unit tests:

```bash
cd backend
npm test
```

Semantic eval of generated itineraries (calls Gemini; uses quota):

```bash
cd backend
npm run eval
```

### Frontend

Create `frontend/.env` (Vite only exposes variables prefixed with `VITE_`):

```text
VITE_API_URL=http://localhost:3000
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=
```

Auth0 must allow `http://localhost:5173` as a callback, logout, and web origin.
The SPA audience must match `AUTH0_AUDIENCE` on the backend.

```bash
cd frontend
npm install
npm run dev
```

The UI is at [http://localhost:5173](http://localhost:5173).

Frontend unit tests:

```bash
cd frontend
npm test
```

From the repo root, `./start.sh` opens backend and frontend in separate
terminals on Git Bash / MSYS (Windows).

### Cypress Testing Suite

This repository does **not** currently include a Cypress project (`cypress/`
folder, `cypress.config` file, or `cypress` npm dependency). End-to-end
coverage is not run with Cypress today.

Use the suites that *are* in the repo:

```bash
# Backend unit tests (Node test runner via tsx)
cd backend && npm test

# Frontend unit tests (Node test runner)
cd frontend && npm test

# LLM quality eval (golden dataset + judge)
cd backend && npm run eval
```

Manual / API checks: Bruno collection in `backend/bruno/TripMind/`.

If you add Cypress later, the usual local pattern would be: start Postgres,
Chroma, backend, and frontend, then from the folder that owns the Cypress
config:

```bash
npx cypress open    # interactive
npx cypress run     # headless
```

Those commands will fail until Cypress is installed and specs are added.

## License

MIT
