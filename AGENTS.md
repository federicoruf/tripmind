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

## PR Review
When I ask "review the PR":
1. Get the diff of the branch against main.
2. Launch review-security, review-performance, and review-docs-api in parallel,
   passing the full diff to each one.
3. Combine the results without changing the [AGENT][RULE] labels.
4. Remove duplicates (if two agents report the same thing, keep both with their label
   and mark it as "reported by 2 agents").
5. Sort them by severity: high, medium, low.
6. Do not edit any file; only report.