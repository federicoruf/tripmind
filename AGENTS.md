# TripMind

## Stack
- Backend: Node.js, Express, TypeScript, Postgres (Neon)
- Frontend: Vite + React

## Commands (from `backend/`)
- `npm run db:migrate:dev` - apply SQL migrations to dev

## Database rules
- After creating a file in `backend/script_sql/`, run `npm run db:migrate:dev`.
- Never run `npm run db:migrate:prod`. The user runs it manually.
- Never edit an applied SQL file. Create a new numbered one.

## Code style rules
- ALL production code (variables, functions, types, classes, files) MUST be written in English.
- Comments must be in English.
- Exception: Test files (e.g., `*.test.ts`, `*.spec.ts`) may contain Spanish descriptions if matching existing project conventions.

## Project structure
See the "Folder Structure" section in `README.md`.