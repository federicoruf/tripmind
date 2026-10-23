# Frontend Standards

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
  - [Language and Naming](#language-and-naming)
  - [Components, State, and Styling](#components-state-and-styling)
- [API and Authentication Standards](#api-and-authentication-standards)
  - [Auth0](#auth0)
  - [HTTP Requests](#http-requests)
  - [SSE Itinerary Streaming](#sse-itinerary-streaming)
- [Files and User Data](#files-and-user-data)
- [Accessibility and UX](#accessibility-and-ux)
- [Testing Standards](#testing-standards)
- [Configuration and Deployment](#configuration-and-deployment)
- [Tooling and Migration Strategy](#tooling-and-migration-strategy)
- [Development Workflow](#development-workflow)

## Overview

This document defines the engineering standards for TripMind's frontend. It applies to all code in frontend/ and keeps the React application accessible, secure, responsive, and aligned with the backend API contract.

Existing code should improve incrementally when changed. New code must follow these standards. The public API contract is documented in [api-spec.yml](./api-spec.yml); frontend code must not depend on undocumented response fields or event types.

## Technology Stack

| Area | Standard technology |
| --- | --- |
| UI runtime | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript for application code; JavaScript only where an existing test or configuration requires it |
| Authentication | Auth0 React SDK |
| Styling | Component-oriented CSS in App.css and global styles in index.css |
| Client state | React state and custom hooks |
| HTTP | Native fetch with Auth0 bearer tokens |
| Streaming | Fetch ReadableStream and SSE parsing |
| Linting | ESLint with React Hooks and React Refresh rules |
| Tests | Node.js test runner |
| Hosting | Firebase Hosting |

Do not add a state-management framework, UI component library, router, or HTTP client by default. Introduce one only when a documented limitation cannot be addressed with the current stack.

## Project Structure

Keep presentational components, interaction components, and data-access hooks separate. A component owns rendering and user interaction; a hook owns request lifecycle, token retrieval, and operation state. Do not put direct fetch calls  
in App.tsx or reusable presentational components.

When the application grows beyond one screen, group related components, hooks, types, and tests by feature rather than creating a large shared-components directory.

## Coding Standards

### Language and Naming

- Write new documentation, code comments, identifiers, and commit messages in English. Preserve existing Spanish UI copy unless a product copy change is intentionally requested.
- Use PascalCase for component files and component names, camelCase for hooks, functions, variables, and props, and UPPER_SNAKE_CASE for immutable module-level constants.
- A custom hook must start with use and expose a small, typed public contract.
- Prefer type for data shapes and discriminated unions for UI states and API outcomes. Avoid any, including in callback props such as upload handlers.
- Keep browser-visible strings in named constants when they are reused or have product significance. Do not duplicate API fallback messages across hooks.
- Use comments only for non-obvious constraints, such as SSE framing or a backend limit mirrored on the client.

### Components, State, and Styling

- Use function components and hooks only. Extract a component when conditional markup, accessibility behaviour, or state transitions make a view difficult to read.
- Keep state as local as possible. App.tsx may own screen-level state; each asynchronous hook owns loading, error, result, and reset state.
- Derive values during render instead of storing duplicate state.
- Use useCallback only when a stable identity is needed by an effect, memoized child, or hook contract.
- Never trigger callbacks, state resets, requests, or other side effects during render. Use an event handler or useEffect.
- Use stable keys from API identifiers. An array index is acceptable only for immutable, non-reordered generated content with no persistent item state.
- Reuse the existing CSS naming convention: a component block followed by __element and --modifier names.
- Keep styles scoped by class names. Use global CSS only for resets, typography tokens, and deliberate page-wide rules.
- Do not use inline styles for static design decisions. Prefer CSS custom properties for repeated colours, spacing, and typography values.

## API and Authentication Standards

### Auth0

- Configure Auth0 only through VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE in main.tsx.
- Obtain an access token with getAccessTokenSilently immediately before an authenticated request. Never persist, log, or manually parse access tokens.
- Treat unauthenticated and token-acquisition failures as expected UI states; show a useful message or login action rather than leaving a control loading.
- Keep the redirect URI as the current origin unless an Auth0 configuration change is documented and deployed with the frontend.

### HTTP Requests

- Build API URLs from VITE_API_URL, with http://localhost:3000 only as the local-development fallback. Production builds must use **[h**ttps://tripmind-c2dm.onrender.com](http://localhost:3000/).
- Send JSON requests with Content-Type: application/json and an Authorization bearer token when the route requires Auth0.
- Check response.ok before treating a JSON response as successful. Safely handle malformed or empty error bodies and show a product-safe fallback.
- Mirror backend limits in the UI for fast feedback, but treat backend validation as authoritative.
- Centralise repeated request behaviour in a shared API helper if hooks repeat token retrieval, URL construction, and error parsing.
- Do not send user identifiers from the browser. The backend derives identity from the Auth0 token.

### SSE Itinerary Streaming

The itinerary client uses fetch rather than EventSource because it must send a POST body and an Auth0 authorization header. It must:

- Parse frames incrementally and retain incomplete data between chunks.
- Support only documented day, error, and done event types.
- Clear stale itinerary data, errors, and outcomes before each generation.
- Always leave loading state when the stream ends, errors, or closes without a done event.
- Render partial results honestly and display complete, partial, and failed outcomes distinctly.
- Never render server data as HTML or use dangerouslySetInnerHTML for itinerary, document, image, or error content.

## Files and User Data

- Validate type and size before converting files to base64. Current limits are 10 MB for .pdf, .md, and .txt documents, and 5 MB for JPEG, PNG, and WebP images.
- Reset file input values after handling a selection so users can select the same file again.
- Do not log, retain, or expose base64 file data after a request finishes.
- Display document-retention and deletion information wherever users upload or manage personal documents.
- Treat server-side validation errors as the source of truth.

## Accessibility and UX

- Use semantic native controls before introducing ARIA roles.
- Every interactive element must be keyboard reachable, have a visible focus indicator, and use a descriptive accessible name.
- Give meaningful images descriptive alt text. Decorative images must have an empty alt attribute.
- Use polite live regions for asynchronous status and non-critical errors; use an appropriate alert pattern for blocking failures.
- Keep disabled states tied to the actual operation in progress and communicate the outcome when it completes.
- Confirm destructive document deletion, support keyboard dismissal, and return focus to the originating action when the dialog closes.
- Maintain contrast and touch-target size; never convey state through colour alone.

## Testing Standards

- Place unit tests beside the module they cover and name them *.test.js or *.test.ts once TypeScript test execution is configured.
- Use the Node.js test runner for the existing suite. Add React Testing Library and jsdom component tests when a change affects interactive UI, accessibility, or visual state transitions.
- Test public behaviour: accepted/rejected files, request construction, loading/error/success states, Auth0 failures, SSE framing, partial outcomes, and document deletion confirmation.
- Mock Auth0 and network boundaries. Unit tests must not call production services or user data.
- Run the relevant checks before submitting frontend changes

## Configuration and Deployment

- Only variables prefixed with VITE_ are exposed to browser code. Never put API keys, database credentials, CRON_SECRET, or server secrets in a VITE_ variable.
- Required frontend variables are VITE_API_URL, VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE.
- Firebase Hosting deploys Vite's dist/ directory and rewrites unknown paths to index.html for SPA navigation.
- Keep VITE_API_URL synchronized with the production Render URL and backend FRONTEND_URL synchronized with https://mytripmind-io.web.app.
- Auth0 callback, logout, and web-origin changes must be deployed with matching Auth0 dashboard configuration.

## Tooling and Migration Strategy

The application already has TypeScript source, but the current ESLint configuration targets only .js and .jsx. Vite also transpiles TypeScript without performing a type-checking build. Before TypeScript enforcement is considered complete:

1. Add a tsconfig.json suited to the Vite React application.
2. Add typescript-eslint and configure ESLint for .ts and .tsx.
3. Add a typecheck script and run it locally and in CI.
4. Remove remaining any types and type component props, hook results, API payloads, and SSE event payloads.
5. Retire experimental or unused source files only through an explicit, reviewed cleanup change; do not import them into production flows.

Until then, new code must still be written as typed TypeScript and reviewed against these standards. Do not weaken linting or type rules to bypass a build failure.

## Development Workflow

1. Read the affected component, hook, backend API contract, and CSS before changing a user flow.
2. Define request, response, loading, empty, error, and success states before implementing the UI.
3. Keep each change scoped to the relevant component and hook boundary.
4. Update tests, API-contract documentation, and environment notes when observable behaviour changes.
5. Run linting, tests, and a production build.
6. Review the result at narrow and wide viewport sizes and with keyboard-only navigation before submitting the change.

Use focused commits. Do not mix feature changes with unrelated formatting, dependency upgrades, generated output, or environment secrets.
