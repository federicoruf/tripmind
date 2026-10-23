# Testing Standards

- [Purpose and Scope](#purpose-and-scope)
- [Testing Strategy](#testing-strategy)
- [Test Location and Naming](#test-location-and-naming)
- [Test Design Rules](#test-design-rules)
- [Isolation and Test Data](#isolation-and-test-data)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [LLM Quality Evaluation](#llm-quality-evaluation)
- [Required Checks](#required-checks)
- [Common Anti-Patterns](#common-anti-patterns)
- [Example Test Structure](#example-test-structure)

## Purpose and Scope

This document defines the testing standards for TripMind. It applies to backend, frontend, and AI-quality changes. Its purpose is to ensure that changes are safe, deterministic, and verifiable without exposing user data, calling production services, or consuming provider quota unintentionally.

Tests are a complement to the public API contract in [api-spec.yml](./api-spec.yml), not a replacement for it. When behaviour  
changes, update the implementation, relevant tests, and the API contract or other source documentation in the same change.

## Testing Strategy

Use the smallest test level that gives confidence in the observable behaviour:

| Test level | Purpose | Current approach |
| --- | --- | --- |
| Unit test | Verify a module's behaviour, edge cases, and error handling in isolation. | Node.js test runner with `node:assert/strict`. |
| Integration test | Verify collaboration between project modules at a controlled boundary. | Add only when the interaction cannot be verified through unit tests. Use isolated credentials and data. |
| Manual API test | Verify HTTP and SSE behaviour against a running environment. | Bruno collection in `backend/bruno/TripMind`. |
| LLM quality evaluation | Detect regressions in generated itinerary quality. | Golden dataset and `npm run eval`; this calls Gemini. |

Prioritise tests for security boundaries, validation, business rules, retry behaviour, failure handling, serialization, and state transitions. A defect in one of these areas is more valuable to test than incidental implementation detail.

## Test Location and Naming

- Co-locate a test with the module it covers.
- Backend tests use the `*.test.ts` suffix under `backend/src/`.
- Frontend tests use the `*.test.js` suffix under `frontend/src/`. Use `*.test.ts` or `*.test.tsx` only after the frontend test command is updated to execute TypeScript tests.
- Name test files after their subject, for example `textCrypto.test.ts` next to `textCrypto.ts`.
- Group related cases with `describe` and give each test a concise English name that states the expected observable outcome.
- Keep fixtures small, local to the test file when possible, and free of personal, production, or proprietary travel content.

## Test Design Rules

- Test behaviour and public contracts, not private implementation details.
- Arrange inputs, perform one meaningful action, and assert observable results.
- Include the successful path, boundary values, invalid input, and relevant failure paths for each changed behaviour.
- Make each test independent: it must pass regardless of execution order and must clean up any state it creates.
- Keep tests deterministic. Control time, randomness, environment variables, and retry delays where they affect an assertion.
- Use strict assertions from `node:assert/strict`. Assert values, error types or messages, call counts, and request shape only when each is part of the contract being tested.
- Use `beforeEach` and `afterEach` for setup and restoration that are necessary for isolation. In particular, restore modified environment variables.
- Do not weaken production validation, retry behaviour, or security controls to make a test easier to write.

## Isolation and Test Data

- Unit tests must not call Gemini, Auth0, PostgreSQL, Chroma, weather or places APIs, or other external HTTP services.
- Mock at provider and infrastructure boundaries, not inside the business logic under test. Prefer dependency injection or a narrow module mock when it makes the boundary explicit.
- Do not use real access tokens, API keys, database URLs, uploaded documents, or production identifiers in tests, fixtures, snapshots, or test output.
- Never connect a test to a production database or Chroma collection.
- Use synthetic user IDs, document IDs, payloads, and encrypted test keys. Do not log raw prompts, base64 uploads, or decrypted document text.
- Avoid sleeps and timing-dependent assertions. For retry logic, supply a zero delay or mock the waiting boundary rather than waiting in real time.

## Backend Testing

The backend suite uses the Node.js test runner through `tsx`:

```bash
cd backend
npm test
```

Run the TypeScript build after backend changes:

```bash
cd backend
npm run build
```

Backend tests must cover, when applicable:

- Zod validation and mapping of malformed request, tool, and model output.
- Ownership isolation in reads, updates, and deletion operations.
- Authentication and internal cron-secret rejection paths.
- File MIME-type, size, quota, and base64 validation.
- Parameterized persistence inputs and the intended mutation order.
- Encryption and decryption invariants, including wrong-user, wrong-key, and tampered-data failures.
- Gemini retry classification, retry limits, and preservation of the original error when attempts are exhausted.
- HTTP status and error mapping, and SSE framing or terminal event behaviour.

Use the Bruno collection for a deliberate manual check of authenticated HTTP and SSE endpoints. Do not treat a Bruno request with live credentials as a replacement for an automated test.

## Frontend Testing

The frontend suite currently uses the Node.js test runner:

```bash
cd frontend
npm test
```

Run linting and a production build with relevant frontend changes:

```bash
cd frontend
npm run lint
npm run build
```

Test hooks and components through user-visible outcomes. For changes affecting interactive UI, accessibility, or visual state transitions, use the installed React Testing Library and jsdom dependencies rather than testing component  
internals.

Frontend tests must cover, when applicable:

- Accepted and rejected file types, sizes, and empty-file states.
- Auth0 token acquisition failures and authenticated request construction.
- Loading, success, empty, error, and retry states visible to the user.
- Safe handling of malformed or empty API error responses.
- Incremental SSE parsing, incomplete frames, `day`, `error`, and `done` events, and complete, partial, or failed outcomes.
- Document deletion confirmation and the resulting success or failure state.
- Keyboard interaction, accessible names, focus behaviour, and live feedback for materially changed interactive flows.

Mock Auth0 and network requests at their boundaries. Component tests must not make real network calls or depend on a running backend.

## LLM Quality Evaluation

`npm run eval` is a quality evaluation, not a unit-test command. It uses the golden dataset and calls Gemini, so it requires valid configuration and consumes quota.

Run it when changing prompts, model configuration, tool definitions, orchestration, retrieval, output schemas, or itinerary-quality rules:

```bash
cd backend
npm run eval
```

Keep evaluation inputs anonymised and representative. Review regressions in source attribution, schema validity, completion outcome, factual tool use, and the acceptance criteria for the changed flow. Do not make a quality claim based  
on a single ad-hoc prompt.

## Required Checks

Before submitting a change, run the checks that match its scope:

| Change scope | Required checks |
| --- | --- |
| Backend code | `cd backend && npm test` and `npm run build` |
| Frontend code | `cd frontend && npm run lint`, `npm test`, and `npm run build` |
| Prompt, RAG, orchestration, tool, or output-quality change | Backend checks plus `cd backend && npm run eval` |
| HTTP or SSE contract change | Relevant automated checks, API specification update, and a Bruno verification where feasible |

All relevant automated tests must pass before merging. Fix a failing test or update it only when the intended behaviour has changed and the corresponding contract documentation has been reviewed.

## Common Anti-Patterns

- Testing a copied constant or locally reimplemented function instead of the production module that owns the behaviour.
- Testing private implementation steps while omitting an observable outcome.
- Creating broad, fragile setup for a case that can be tested with a small fixture.
- Calling real databases, providers, or external services from unit tests.
- Depending on test order, current time, uncontrolled randomness, or network availability.
- Skipping security, invalid-input, or error scenarios because the happy path passes.
- Leaving `.only`, skipped tests, debug logging, or real credentials in the suite.
- Updating snapshots or assertions without understanding the behavioural change they represent.

## Example Test Structure

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isAllowedDocument } from "./documentValidation";

describe("isAllowedDocument", () => {
  test("accepts a supported document within the size limit", () => {
    const result = isAllowedDocument({
      name: "lisbon-notes.md",
      mimeType: "text/markdown",
      sizeBytes: 1_024,
    });

    assert.deepEqual(result, { allowed: true });
  });

  test("rejects a document above the size limit", () => {
    const result = isAllowedDocument({
      name: "large-notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10 * 1024 * 1024 + 1,
    });

    assert.deepEqual(result, {
      allowed: false,
      reason: "FILE_TOO_LARGE",
    });
  });
});
```

The example illustrates the preferred shape: a production module is imported, the input is small and synthetic, and assertions describe externally observable behaviour.
