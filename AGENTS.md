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

## Project structure
See the "Folder Structure" section in `README.md`.