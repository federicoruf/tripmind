# Production Deployment

## Overview

TripMind's production deployment uses Render for the backend, Neon for
PostgreSQL, Chroma Cloud for vector storage, and Firebase Hosting for the
frontend. The backend production URL is:

```text
https://tripmind-c2dm.onrender.com
```

This replaced the former Railway backend and database deployment. The migration
was made because the Railway trial was ending. No data migration was required:
there was no existing production data to move.

## Production Topology

| Component | Service | Notes |
| --- | --- | --- |
| Backend API | Render Web Service, Free instance | Node.js runtime |
| Relational database | Neon PostgreSQL | `main` is production; `dev` is development |
| Vector database | Chroma Cloud | Unchanged by the migration |
| Frontend | Firebase Hosting | Unchanged by the migration |
| Authentication | Auth0 | Unchanged by the migration |
| LLM observability | Langfuse | Unchanged by the migration |
| Scheduled cleanup | GitHub Actions | Calls the backend cleanup endpoint daily |

The Neon databases contain the `user_memory` and `user_documents` tables. They
were created from the repository SQL scripts during the migration.

## Render Service Configuration

Configure the backend service with the following values:

| Setting | Value |
| --- | --- |
| Runtime | Node.js |
| Instance | Free |
| Region | A region close to Neon |
| Build command | `npm install && npm run build` |
| Start command | `node dist/index.js` |
| Public URL | `https://tripmind-c2dm.onrender.com` |
| Health-check path | `/health` |

The server must bind to `0.0.0.0` and the port provided in `process.env.PORT`.

> **Current repository status:** `GET /health` is not registered by the
> backend source at the time of writing. Add it before depending on the Render
> health check. It must return HTTP `200` and must not call external services.

On the Free instance, the service may sleep after roughly 15 minutes without
traffic. The first request after wake-up can be slow; clients and operational
checks should allow for this cold-start behaviour.

## Environment Variables

Set the following variables in Render. Keep their values in the relevant
secret-management systems; do not commit them to the repository.

| Group | Required variables |
| --- | --- |
| Database | `DATABASE_URL` (Neon) |
| Auth | `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Document security | `DOCS_MASTER_KEY`, `CRON_SECRET` |
| Observability | `LANGFUSE_*` |
| Vector storage | Chroma Cloud credentials |
| External data | Weather and places API credentials |
| HTTP | `FRONTEND_URL`, `PORT` |

`DOCS_MASTER_KEY` must retain its established value so previously encrypted
user-document chunks remain decryptable. `FRONTEND_URL` must be
`https://mytripmind-io.web.app` in production.

## Frontend, CORS, and Scheduled Cleanup

The Firebase frontend uses:

```text
VITE_API_URL=https://tripmind-c2dm.onrender.com
```

The backend CORS configuration permits the Firebase origin for `GET`, `POST`,
and `DELETE` requests (and `OPTIONS` for preflight requests). Do not use a
wildcard origin for authenticated API routes.

The daily GitHub Actions cleanup workflow calls:

```text
POST https://tripmind-c2dm.onrender.com/internal/cleanup
```

Set GitHub Actions `BACKEND_URL` to the Render URL and set its `CRON_SECRET`
to exactly the same value configured in Render. The cleanup endpoint is not
protected by Auth0; it uses the `x-cron-secret` header. The workflow is working
after the migration.

## Database Changes

Apply schema changes using versioned scripts in `backend/script_sql/`. Test
them in Neon `dev` before applying them to `main`. Treat a branch promotion or
production schema change as an operational change: confirm the target branch,
the applied script, and rollback or recovery steps before proceeding.
