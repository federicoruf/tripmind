# TripMind

**An AI travel planner that turns one sentence into a day-by-day itinerary, and tells you where every suggestion came from.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)](#tech-stack)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](#tech-stack)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?logo=langchain&logoColor=white)](#tech-stack)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](#tech-stack)
[![Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)](#tech-stack)

**Live demo:** [mytripmind-io.web.app](https://mytripmind-io.web.app)
*(the backend runs on Render's free tier, so the first request may take ~30–60 s while it wakes up)*

---

## What it does

Type something like *"3 days in Lisbon in October, relaxed pace, food and architecture"*. TripMind builds an itinerary and streams it to the browser one day at a time.

To build it, TripMind uses four sources and labels each activity with the one it came from:

| Source | How it's used |
| --- | --- |
| 🗂️ **Your own documents** | Upload PDFs, Markdown or text notes. They're searched with private, encrypted RAG. |
| 📚 **Curated travel guides** | Shared guides, searched with public RAG. |
| 🌦️ **Live data** | Weather (OpenWeatherMap) and places (Geoapify), fetched through LLM tool calling. |
| 🧠 **Model knowledge** | Gemini fills the gaps and says that it did. |

Other features:

- **📷 Plan from a photo.** Upload a picture of a place. The model identifies it and suggests a trip.
- **💾 Itinerary history.** Every itinerary is saved automatically and kept for 30 days (up to 10 per user).
- **🧩 Travel memory.** The app learns your preferences across sessions and uses them in later plans.
- **🔐 Privacy by design.** Original files are never stored. Document fragments are encrypted at rest and expire after 30 days, and you can delete them at any time.

## What this project demonstrates

I built TripMind end to end as a production-style LLM application, not a prompt wrapper. These are the engineering problems it addresses:

**LLM orchestration and reliability**
- A **planner → validator graph** built with LangGraph. A second LLM pass reviews each itinerary and can send it back to the planner with feedback, up to 2 retries. If none passes, the best attempt is returned.
- **Structured output that is checked twice:** Gemini `responseSchema` at generation time, then **Zod** validation before anything reaches the client.
- A **tool-calling loop** (`get_weather`, `get_places`) with a hard cap on iterations, so the model can't chain tool calls without limit.
- **Retries with backoff** for transient Gemini errors.

**Cost control**
- A per-call **output-token ceiling** for each call type (planner, validator, tool loop, memory, image).
- A configurable **USD budget cap** (`GEMINI_MAX_BUDGET_USD`) plus per-request cost logging.
- Character caps on RAG context and tool results, so the prompt can't grow without limit.

**Retrieval-augmented generation**
- Two separate **ChromaDB** collections, one for public guides and one for private user documents, using cosine distance with a calibrated threshold.
- An ingestion pipeline (extract → chunk → embed) with a per-document chunk cap to keep embedding costs predictable.

**Security and privacy**
- Auth0 JWT on every API route. The `userId` always comes from the token (`sub`), never from the request body.
- **AES-256-GCM encryption** of user document chunks, with a key derived per user from a master key.
- Data retention is enforced by a **daily GitHub Actions cron job** that calls a secret-protected internal cleanup endpoint.

**User experience**
- **Server-Sent Events streaming** with partial-JSON parsing, so days appear as soon as they're complete.

**Quality and observability**
- An **LLM-as-judge evaluation** over a golden dataset (`npm run eval`) to catch regressions in itinerary quality.
- **Langfuse + OpenTelemetry** tracing of every generation.
- Unit tests for the backend and the frontend.

**Engineering process**
- **Spec-driven development** with [OpenSpec](openspec/). Each feature starts as a proposal, design and task list, and is archived when complete.
- Versioned SQL migrations with a tracked `schema_migrations` table. Running migrations against production requires manual confirmation.
- AI-assisted PR reviews (CodeRabbit) and CI/CD to Firebase Hosting.

## Architecture

```
  Browser (React 19 + Vite + Auth0)
        │  JWT
        │  POST   /api/itinerary/stream        (SSE)
        │  GET    /api/itinerary/history[/:id]
        │  DELETE /api/itinerary/history/:id
        │  POST   /api/documents/upload
        │  GET    /api/documents
        │  DELETE /api/documents/:id
        │  POST   /api/image/identify
        ▼
┌──────────────────────────────────────┐
│  Backend (Express 5 + TypeScript)    │
│                                      │
│  checkJwt (Auth0)                    │
│        │                             │
│        ▼                             │
│  LangGraph orchestrator              │
│    planner ──► validator             │
│       ▲            │ rejected        │
│       └────────────┘ (max 2 retries) │
│        │                             │
│        ├─ Gemini tool loop           │
│        │    get_weather · get_places │
│        ├─ RAG retrieval              │
│        │    public guides            │
│        │    user docs (decrypted)    │
│        └─ user memory                │
│                                      │
│  Zod-validated itinerary JSON        │
└──────────────────────────────────────┘
        │
        ├── PostgreSQL (Neon)  user_memory, user_documents, user_itineraries
        ├── ChromaDB           embeddings (public guides + encrypted user chunks)
        └── Gemini             generation, embeddings, image identification, eval judge

GitHub Actions (daily) ── POST /internal/cleanup ──► remove expired documents and itineraries
```

### What happens when you ask for an itinerary

1. The request is authenticated, and `userId` is taken from the JWT.
2. The **planner** node builds the prompt from three things: the user's request, retrieved RAG context (public and private), and the user's stored travel memory. Gemini may call the weather and places tools.
3. Gemini returns JSON that must match the itinerary schema. The **validator** node either accepts it or sends it back with reasons.
4. The final itinerary is streamed to the client over SSE, day by day. Each activity has a `source`.
5. The itinerary is saved to history, and the user's travel memory is updated from the original prompt.

### How private documents are handled

The original file is never stored. Its text is extracted, chunked and embedded. Each chunk is encrypted with AES-256-GCM, using a key derived from `DOCS_MASTER_KEY` and the user ID, and written to a dedicated Chroma collection. PostgreSQL keeps only metadata and the expiry date.

## Tech stack

| Area | Technology |
| --- | --- |
| LLM | Google Gemini (`@google/genai`): generation, embeddings, vision |
| Orchestration | LangGraph (planner + validator nodes) |
| Backend | Node.js, Express 5, TypeScript |
| Frontend | React 19, Vite, Auth0 React SDK |
| Validation | Zod + Gemini `responseSchema` |
| Vector store | ChromaDB (Chroma Cloud in production) |
| Relational DB | PostgreSQL on Neon (`pg`) |
| Auth | Auth0 (SPA + JWT-protected API) |
| Streaming | Server-Sent Events |
| External APIs | OpenWeatherMap, Geoapify |
| Observability | Langfuse, OpenTelemetry |
| Testing | Node.js test runner, Testing Library, LLM-as-judge eval |
| CI/CD and hosting | GitHub Actions, Firebase Hosting (frontend), Render (backend) |

## Project structure

```
tripmind/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Express app and route registration
│   │   ├── orchestrator/      # LangGraph graph, state, planner and validator nodes
│   │   ├── routes/            # itinerary, itineraryHistory, documents, image, internal
│   │   ├── services/          # itinerary generation, tool loop, prompts, history, cleanup
│   │   ├── rag/               # ingest, extract, chunk, embed, retrieve (public + private)
│   │   ├── tools/             # get_weather / get_places declarations and implementations
│   │   ├── schemas/           # Gemini response schemas + Zod validators
│   │   ├── middleware/        # Auth0 JWT check
│   │   ├── eval/              # golden dataset + LLM-as-judge runner
│   │   └── utils/             # SSE, crypto, cost logging, retries, logging
│   ├── script_sql/            # numbered SQL migrations
│   ├── scripts/migrate.mjs    # migration runner
│   ├── bruno/                 # Bruno HTTP collection for manual API testing
│   └── Dockerfile
├── frontend/
│   └── src/                   # React components, hooks and unit tests
├── documentation/             # API spec (OpenAPI), data model, standards, deployment
├── openspec/                  # spec-driven change proposals, specs and archive
└── .github/workflows/         # daily cleanup cron + Firebase Hosting deploys
```

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL (local Docker or a free [Neon](https://neon.tech) database)
- ChromaDB (local via Docker or Python, or Chroma Cloud)
- API keys: [Gemini](https://ai.google.dev/), [OpenWeatherMap](https://openweathermap.org/api), [Geoapify](https://www.geoapify.com/)
- An [Auth0](https://auth0.com/) SPA application and an API audience

### 1. Clone

```bash
git clone https://github.com/federicoruf/tripmind.git
cd tripmind
```

### 2. Start the databases

```bash
# PostgreSQL
docker run -d --name tripmind-postgres \
  -e POSTGRES_USER=tripmind -e POSTGRES_PASSWORD=tripmind -e POSTGRES_DB=tripmind \
  -p 5432:5432 postgres:16

# ChromaDB (skip if you use Chroma Cloud)
docker run -d --name tripmind-chroma -p 8000:8000 \
  -v ./chroma-data:/data chromadb/chroma:1.5.3
```

> `backend/src/db.ts` turns on SSL for hosted databases. If your local container rejects SSL, either change that setting for local use or use a free Neon database.

### 3. Configure and run the backend

```bash
cd backend
cp .env.example .env
npm install
```

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | LLM, embeddings, eval judge |
| `OPENWEATHER_API_KEY` | `get_weather` tool |
| `GEOAPIFY_API_KEY` | `get_places` tool |
| `DATABASE_URL` | PostgreSQL connection used by the app |
| `DATABASE_URL_DEV` | PostgreSQL connection used by the migration runner |
| `AUTH0_DOMAIN` | Auth0 tenant host, without `https://` |
| `AUTH0_AUDIENCE` | Auth0 API audience |
| `DOCS_MASTER_KEY` | 32-byte hex key for document encryption |
| `CRON_SECRET` | Protects `POST /internal/cleanup` |
| `FRONTEND_URL` | CORS origin (`http://localhost:5173` locally) |

Optional variables: `PORT` (default `3000`), `GEMINI_MODEL`, `GEMINI_MAX_BUDGET_USD`, `DEBUG_RAG`, the Langfuse keys, and `CHROMA_API_KEY` / `CHROMA_TENANT` / `CHROMA_DATABASE` for Chroma Cloud. Without the Chroma variables, the backend uses `localhost:8000`.

To generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Apply the migrations, load the public guides into Chroma, and start the API:

```bash
npm run db:migrate:dev
npm run ingest
npm run dev          # http://localhost:3000
```

### 4. Configure and run the frontend

Create `frontend/.env`:

```text
VITE_API_URL=http://localhost:3000
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=
```

In Auth0, add `http://localhost:5173` as an allowed callback URL, logout URL and web origin. `VITE_AUTH0_AUDIENCE` must match `AUTH0_AUDIENCE` on the backend.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Testing

```bash
cd backend  && npm test       # backend unit tests (Node test runner + tsx)
cd frontend && npm test       # frontend unit tests
cd backend  && npm run eval   # LLM-as-judge quality eval (calls Gemini and uses quota)
```

For manual API exploration, the Bruno collection in `backend/bruno/TripMind/` has requests for local and production environments.

## Deployment

| Component | Platform |
| --- | --- |
| Frontend | Firebase Hosting, deployed by GitHub Actions on merge to `master` |
| Backend | Render Web Service (`npm install && npm run build`, then `node dist/index.js`) |
| PostgreSQL | Neon: the `main` branch is production, the `dev` branch is development |
| Vectors | Chroma Cloud |
| Scheduled cleanup | GitHub Actions cron job, daily at 03:00 UTC |

See [`documentation/deployment.md`](documentation/deployment.md) for the full production setup.

## Documentation

- [API specification (OpenAPI)](documentation/api-spec.yml)
- [Data model](documentation/data.model.md)
- [Backend standards](documentation/backend-standards.md) · [Frontend standards](documentation/frontend-standards.md) · [Testing standards](documentation/testing-standards.md)
- [Deployment](documentation/deployment.md)
- [OpenSpec specs and change history](openspec/)

## Roadmap

- `/health` endpoint for Render health checks
- End-to-end tests (Playwright or Cypress)
- More public travel guides beyond Lisbon
- Export an itinerary to PDF or a calendar

## Author

**Federico Rufrancos** · [GitHub](https://github.com/federicoruf)
