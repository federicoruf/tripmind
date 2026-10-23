# Backend Standards

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture and Module Boundaries](#architecture-and-module-boundaries)
- [Project Structure](#project-structure)
- [TypeScript and Coding Standards](#typescript-and-coding-standards)
- [API Design Standards](#api-design-standards)
  - [Endpoint Design](#endpoint-design)
  - [Response and Error Format](#response-and-error-format)
  - [Server-Sent Events](#server-sent-events)
- [Validation, Errors, and Resilience](#validation-errors-and-resilience)
- [Security and Privacy](#security-and-privacy)
- [Data and RAG Standards](#data-and-rag-standards)
- [Logging and Observability](#logging-and-observability)
- [Testing and Quality Gates](#testing-and-quality-gates)
- [Development Workflow](#development-workflow)
- [Deployment and Configuration](#deployment-and-configuration)

## Overview

This document defines the engineering standards for TripMind's backend. Its
purpose is to keep the API secure, maintainable, observable, and predictable
while supporting LLM orchestration, retrieval-augmented generation (RAG), and
streaming responses.

These standards apply to all code under `backend/`. Existing code should be
aligned incrementally whenever it is touched; new code must follow them from
the start. The source of truth for the public HTTP contract is
[`documentation/api-spec.yml`](./api-spec.yml).

## Technology Stack

| Area | Standard technology |
| --- | --- |
| Runtime and language | Node.js 20+ and TypeScript in strict mode |
| HTTP API | Express 5 |
| Authentication | Auth0 access-token validation with `express-oauth2-jwt-bearer` |
| Relational storage | PostgreSQL through `pg` |
| Vector storage | ChromaDB |
| Validation | Zod |
| LLM and embeddings | Gemini through `@google/genai` |
| Workflow orchestration | LangGraph |
| Streaming | Server-Sent Events (SSE) |
| Observability | Structured application logs, OpenTelemetry, and Langfuse |
| Tests | Node.js test runner executed through `tsx --test` |
| API exploration | Bruno collection in `backend/bruno/TripMind` |

Do not introduce an ORM, a second HTTP framework, or a new validation library
without an approved architecture decision. A dependency is justified only when
the platform cannot provide the capability safely and clearly.

## Architecture and Module Boundaries

TripMind follows a pragmatic layered architecture. It is not currently a full
DDD implementation, so do not add DDD abstractions merely for formality.
Instead, protect clear ownership and dependency direction:

```text
route -> service / orchestrator -> persistence, RAG, tools, external providers
                   -> schemas and domain-oriented utilities
```

- `routes/` owns HTTP concerns only: authentication middleware, request
  validation, status codes, response serialization, and SSE headers.
- `services/` owns application use cases and coordinates business rules.
- `orchestrator/` owns LangGraph state, nodes, retry limits, and transitions.
- `rag/` owns extraction, chunking, embedding, retrieval, and Chroma access.
- `tools/` owns declarations and implementations for model-callable tools.
- `schemas/` owns the TypeScript and Zod contracts for structured model output.
- `documents.ts`, `memory.ts`, and `db.ts` own PostgreSQL access. Keep SQL
  parameterized and keep database details out of routes.
- `utils/` contains reusable, side-effect-aware infrastructure helpers. Do not
  turn it into a catch-all for feature-specific business logic.

New features should be organized by responsibility, not by a controller that
directly performs validation, database access, provider calls, and response
formatting in one file. Services must be independently callable outside HTTP
routes where practical.

## Project Structure

```text
backend/
├── src/
│   ├── routes/          # Express endpoints
│   ├── middleware/      # Cross-cutting HTTP middleware
│   ├── services/        # Application use cases
│   ├── orchestrator/    # LangGraph workflow and nodes
│   ├── rag/             # Retrieval and vector-store operations
│   ├── tools/           # LLM tool contracts and implementations
│   ├── schemas/         # Zod and model-output schemas
│   ├── utils/           # Shared infrastructure helpers
│   ├── eval/            # Golden data and quality evaluation runner
│   ├── db.ts            # PostgreSQL pool
│   └── index.ts         # Application composition and startup
├── script_sql/          # Versioned SQL migrations/scripts
├── bruno/TripMind/      # Manual API collection and environments
└── Dockerfile
```

Place each test next to the module it covers using `*.test.ts`. Keep compiled
output in `dist/`; it must never be edited manually or committed unless the
repository policy explicitly changes.

## TypeScript and Coding Standards

- Keep `strict` TypeScript enabled. Do not weaken compiler settings to make a
  change compile.
- Prefer explicit types at public boundaries: route payloads, service inputs
  and outputs, persistence rows, tool arguments, and SSE event payloads.
- Avoid `any`. Use `unknown` for untrusted values and narrow it before use.
- Use `type` for data shapes and `interface` only where declaration merging or
  an extendable contract is genuinely useful.
- Use `camelCase` for values and functions, `PascalCase` for types/classes,
  and `UPPER_SNAKE_CASE` for immutable module-level constants.
- Name files after their responsibility in `camelCase` (for example,
  `cleanupExpiredDocuments.ts`). Keep existing naming untouched unless a
  focused refactor is approved.
- Prefer small, single-purpose functions. Extract repeated business rules into
  a service or utility instead of copying them.
- Use `async`/`await`; always await asynchronous operations that must complete
  before a response is sent. Never use unhandled fire-and-forget promises.
- Comments must explain non-obvious intent, invariants, or trade-offs—not
  restate the code. Write comments and new user-facing backend documentation
  in English.

## API Design Standards

### Endpoint Design

- Register external routes below `/api`; reserve `/internal` for operational
  endpoints that are never called by the SPA.
- Use nouns for resources and HTTP verbs for actions. Preserve the current
  conventions: `GET /api/documents`, `POST /api/documents/upload`, and
  `DELETE /api/documents/:id`.
- Every new or changed public endpoint must update `documentation/api-spec.yml`
  in the same change, including authentication, request/response schemas,
  error responses, and examples.
- Validate input before any provider, database, or model call. Reject invalid
  requests with `400` before starting an SSE response.
- Use the authenticated Auth0 subject (`req.auth?.payload.sub`) as the user
  identity. Never accept a user ID from a request body, query string, or path
  as authorization evidence.
- Return `201` for resource creation, `204` for a successful deletion without
  a body, `401` for missing/invalid credentials, `404` for inaccessible or
  absent resources, and `500` for unexpected failures.

### Response and Error Format

Non-streaming errors use the current JSON contract:

```json
{ "error": "Human-readable message" }
```

Do not return stack traces, secrets, provider payloads, database errors, or
internal implementation details to clients. Log technical context internally.
For new endpoints, use concise English error messages unless maintaining an
existing Spanish client contract; changing existing messages is a breaking API
change and requires frontend coordination.

### Server-Sent Events

The itinerary endpoint streams only validated final results. SSE routes must:

- Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and
  `Connection: keep-alive` before writing frames.
- Use named events and JSON payloads through the shared event helper.
- Emit `error` and then `done` on failures occurring after headers are sent;
  an HTTP JSON error cannot be sent at that point.
- Document every event type and payload in the OpenAPI specification.
- Avoid streaming intermediate LLM attempts, prompts, retrieved document text,
  or sensitive user information.

## Validation, Errors, and Resilience

- Treat all request input, Auth0 claims, LLM output, tool output, file content,
  and retrieved text as untrusted.
- Define or extend a Zod schema before consuming structured LLM output. Gemini
  response schemas complement Zod; Zod remains the application-side gate.
- Enforce explicit limits for request size, prompt length, file size, document
  count, timeouts, retries, and model budget. Limits protect cost and service
  reliability.
- Keep retry logic bounded and centralized. Retrying must be safe; do not
  blindly retry irreversible database writes or deletion operations.
- Preserve partial-result semantics when applicable. For itinerary generation,
  use the documented `complete`, `partial`, and `failed` outcomes.
- Catch errors at the route or job boundary, log the original error with safe
  context, and map it to the documented response.

## Security and Privacy

- Authenticate all user-facing API endpoints with `checkJwt` unless an
  exception is explicitly documented and reviewed.
- Protect internal jobs with their dedicated secret and constant-time
  comparison; never reuse user authentication for scheduler-only endpoints.
- Enforce ownership in every read, update, and delete query by including the
  authenticated `user_id` in the predicate.
- Keep secrets exclusively in environment variables. Never commit `.env`
  files, access tokens, API keys, database URLs, Bruno production credentials,
  or private documents.
- Use parameterized PostgreSQL queries exclusively. Never build SQL through
  string interpolation.
- Follow the existing document privacy model: store only metadata in
  PostgreSQL; encrypt user-document chunks with AES-256-GCM before writing to
  the user Chroma collection; delete vectors before metadata.
- Log opaque identifiers and safe metadata only. Do not log raw prompts,
  document contents, JWTs, base64 files, encryption keys, or full provider
  responses. Use the existing preview helper where prompt observability is
  necessary.
- Keep CORS origins explicit through `FRONTEND_URL`; do not widen CORS to a
  wildcard for authenticated JSON APIs.

## Data and RAG Standards

- Use the shared PostgreSQL pool from `db.ts`; do not create a pool per request.
- Make storage mutations deliberate and ordered. For document deletion, remove
  Chroma chunks first and then the PostgreSQL metadata so retries can recover
  from a partial failure.
- Add SQL changes as ordered, reviewable scripts in `script_sql/`. Scripts must
  be safe to apply once and documented in the relevant change.
- Keep public guides and private user documents isolated in their respective
  Chroma collections. A retrieval query must always be scoped to the current
  user when it accesses private data.
- Preserve source attribution in generated activities. Every activity source
  must be traceable to a guide, tool, user document, or model knowledge.

## Logging and Observability

- Use `logStep`, `logWarn`, and `logError` instead of ad-hoc `console.log` in
  application code. Startup logging in `index.ts` is the current exception.
- Include an operation name and safe correlation fields such as user ID,
  document ID, chunk count, attempt number, outcome, and elapsed time when
  available.
- Log errors once at the boundary that can provide actionable context. Avoid
  logging the same exception in every layer.
- Instrument external LLM calls and workflow execution consistently so that
  Langfuse/OpenTelemetry traces remain useful for cost, latency, and failure
  analysis.
- Treat observability data as production data: it is subject to the same
  privacy rules as the API.

## Testing and Quality Gates

- Add unit tests for every new branch of business logic, validation boundary,
  schema transformation, retry condition, and error mapping.
- Tests must be deterministic and must not call Gemini, Auth0, PostgreSQL,
  Chroma, or external HTTP services unless explicitly marked as an integration
  test with isolated credentials and data.
- Mock provider boundaries, not the business logic being tested. Assert request
  shape, ownership scope, limits, and observable output.
- Cover security-sensitive outcomes: missing/invalid authentication, ownership
  isolation, cron-secret rejection, malformed base64, unsupported MIME types,
  and size/quota limits.
- Run the relevant checks before submitting a change:

```bash
cd backend
npm test
npm run build
```

Run `npm run eval` when changing prompts, LLM tools, orchestration, schemas,
retrieval, or output quality. It calls Gemini and therefore consumes quota.
Use the Bruno collection for manual verification of HTTP and SSE behavior.

## Development Workflow

1. Read the relevant route, service, schema, and OpenAPI contract before
   changing behavior.
2. Define the input/output contract and validation rules first.
3. Implement the smallest change in the appropriate layer.
4. Update tests, the OpenAPI specification, Bruno requests, and README setup
   notes when their public behavior changes.
5. Run tests and the TypeScript build; run the LLM evaluation when applicable.
6. Keep commits focused. Do not combine unrelated formatting, dependency
   upgrades, and functional changes.

For changes that alter externally observable behavior, record the rationale and
acceptance criteria in OpenSpec before implementation. Do not publish a change
whose code, API specification, tests, and operational documentation disagree.

## Deployment and Configuration

- The backend must build with `npm run build` and start with `npm start` from
  the generated `dist/` output.
- Production runs as a Render Web Service; PostgreSQL is hosted by Neon.
  Render builds with `npm install && npm run build` and starts with
  `node dist/index.js`. Its free tier may sleep after about 15 minutes of
  inactivity, so a cold request may take longer.
- Neon `main` is the production database branch and Neon `dev` is the
  development branch. Schema changes must be applied and verified in the
  relevant branch before application deployment.
- Configure runtime behavior through environment variables, including
  `PORT`, `FRONTEND_URL`, `DATABASE_URL`, Auth0 settings, Gemini settings,
  `DOCS_MASTER_KEY`, `CRON_SECRET`, Langfuse settings, Chroma credentials, and
  weather/place API credentials.
- The production CORS origin is `https://mytripmind-io.web.app`. Keep allowed
  methods limited to `GET`, `POST`, `DELETE`, and `OPTIONS` unless a reviewed
  API change requires another method.
- Render is configured to use `/health` as a health check. A `GET /health`
  endpoint must return `200` without depending on external services. This is a
  required deployment invariant; implement and test it before relying on the
  Render health check.
- The frontend `VITE_API_URL` and the GitHub Actions `BACKEND_URL` must point
  to `https://tripmind-c2dm.onrender.com`. The GitHub Actions `CRON_SECRET`
  must exactly match the Render service value.
- Validate required configuration at startup and fail closed when a secret that
  protects a feature is missing. Never silently run a protected feature in an
  insecure mode.
- Maintain compatibility with the existing Render/Neon deployment model and
  the scheduled cleanup workflow. Any new background operation needs a
  documented trigger, authentication method, retry behavior, and monitoring.
