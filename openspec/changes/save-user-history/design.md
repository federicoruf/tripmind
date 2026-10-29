# Design

## Context

The current system generates itineraries but does not persist them. Existing patterns include: Auth0 JWT validation via `checkJwt` middleware, encryption using `encryptText` with user-specific keys derived from `DOCS_MASTER_KEY`, PostgreSQL for relational data, and React hooks for frontend data access. See proposal.md for motivation and specs/itinerary/history/spec.md for requirements.

## Goals / Non-Goals

**Goals:**
- Implement automatic saving of generated itineraries with encryption
- Provide user-facing history management (list, view, delete)
- Enforce 10 itinerary limit per user with automatic cleanup of oldest
- Apply 30-day retention with daily cleanup integration
- Maintain security and privacy standards (no content in logs/traces)
- Integrate with existing frontend patterns and components

**Non-Goals:**
- Editing saved itineraries (future enhancement)
- Search/filtering of saved itineraries (future enhancement)
- Sharing itineraries between users (future enhancement)
- Regenerating from saved prompts (future ticket)

## Decisions

### Database Schema: Single table with encrypted JSON column
**Decision**: Store itinerary metadata in a `user_itineraries` table with a TEXT column for encrypted JSON.

**Rationale**: Follows the existing pattern from `user_documents` table (metadata in PostgreSQL, encrypted content). This keeps the relational structure simple while leveraging existing encryption utilities. The itinerary JSON is already validated against a Zod schema, so we can safely serialize and encrypt it.

**Alternatives considered**:
- Separate table for itinerary content: Would add complexity without benefit, since the JSON is already self-contained and validated.
- Store in Chroma: Not suitable for structured itinerary data that needs to be retrieved and rendered identically.

### Encryption: Reuse existing encryptText utility
**Decision**: Use the existing `encryptText(userId, json)` utility from backend/src/utils/crypto.ts with AES-256-GCM.

**Rationale**: This utility already handles per-user key derivation from `DOCS_MASTER_KEY` + `user_id`. It's proven in production for user documents. The same `DOCS_MASTER_KEY` is used, consistent with the existing security model.

**Alternatives considered**:
- Separate encryption key: Would add key management complexity without benefit, as the existing key derivation is user-scoped.

### Summary Generation: Use existing LLM (Gemini)
**Decision**: Generate summaries using the same Gemini model already in use for itinerary generation.

**Rationale**: Avoids introducing a new dependency. The existing LLM integration is stable and already configured. Summary generation can be done synchronously (not streamed) since it's a small, well-defined task.

**Alternatives considered**:
- Client-side summary: Not feasible due to model size and the need for consistent summaries.
- Pre-defined templates: Would lack the richness of LLM-generated summaries.

### Limit Enforcement: Transaction with SELECT FOR UPDATE
**Decision**: Enforce the 10 itinerary limit using a PostgreSQL transaction with `SELECT ... FOR UPDATE` to lock the user's rows.

**Rationale**: This prevents race conditions where concurrent saves could temporarily exceed the limit. The existing `user_documents` table uses a similar pattern with application-level enforcement. PostgreSQL's row-level locking ensures atomicity.

**Alternatives considered**:
- Application-level lock: Would add latency and complexity.
- Database trigger: Would be harder to test and maintain.

### Retention: expires_at filter + daily cleanup
**Decision**: Filter expired itineraries at query time using `expires_at > now()` AND run a daily cleanup job.

**Rationale**: Runtime filtering ensures users never see expired items, even between cleanup runs. The daily cleanup (via `POST /internal/cleanup`) removes expired items to free storage. This is the same pattern used for `user_documents`.

**Alternatives considered**:
- Lazy cleanup on access: Could leave orphaned data indefinitely.
- Immediate deletion on expiration: Would require a background job per user, which is inefficient.

### Frontend Integration: New hook + existing components
**Decision**: Create a new `useItineraryHistory` hook for API access, and a new `ItineraryHistory` component that reuses existing itinerary rendering components.

**Rationale**: The existing itinerary components already handle rendering validated itinerary JSON. By reusing them in read-only mode, we maintain consistency and reduce development effort. The new hook follows the existing pattern from `useItineraryStream.ts`.

**Alternatives considered**:
- Extend existing hooks: Would violate single responsibility principle.
- Copy itinerary components: Would create maintenance burden and potential inconsistencies.

### API Design: RESTful with JWT authentication
**Decision**: Use REST endpoints at `/api/itinerary/history` and `/api/itinerary/history/:id` protected by `checkJwt` middleware.

**Rationale**: Matches the existing API patterns (`/api/documents`, `/api/itinerary/stream`). The `checkJwt` middleware already extracts the `userId` from the token, which we use for ownership validation.

**Alternatives considered**:
- GraphQL: Would require adding a new technology to the stack.
- SSE for history: Not needed since history operations are not real-time.

### Error Handling: Consistent 404 for not found/expired/other user
**Decision**: Return the same 404 response for not found, expired, or another user's itinerary.

**Rationale**: Prevents information leakage about whether an itinerary exists or belongs to someone else. This is a security best practice. The frontend doesn't need to distinguish between these cases.

**Alternatives considered**:
- Different error codes: Would leak information about data existence.

## Risks / Trade-offs

[Concurrent saves at limit] → Use transaction with row lock to ensure atomic limit enforcement

[Incomplete cleanup] → Runtime `expires_at` filter ensures expired items are never returned, even before cleanup runs

[Future schema changes breaking old itineraries] → Store a `schema_version` field or validate defensively when rendering. For now, we accept the risk since the itinerary schema is relatively stable.

[Loss of DOCS_MASTER_KEY] → Saved itineraries become unreadable. Mitigation: keep a secure backup of the key. Same risk as existing user documents.

[Large itinerary JSON] → Could impact performance or storage. Mitigation: The existing itinerary schema already limits size. We add no explicit size cap beyond what the schema enforces.

[Performance of list endpoint] → With indexes on `(user_id, created_at DESC)` and `(expires_at)`, queries should be fast. We target <200ms for up to 10 items.

[Size cap on saved JSON] → Implicit via itinerary schema validation. No additional size enforcement needed.

## Migration Plan

1. Create and apply `backend/script_sql/002_user_itineraries.sql` to dev and prod databases
2. Deploy backend changes (new services, routes, constants, integration with itinerary generation)
3. Deploy frontend changes (new hook, component, integration)
4. Update OpenAPI spec, data.model.md, and README

**Rollback**: If issues arise, the changes are additive. Removing the feature would require: stopping the saving logic, removing the new endpoints, and optionally dropping the table (with data loss). No breaking changes to existing functionality.

## Open Questions

- Should we add a `schema_version` field to the `user_itineraries` table to handle future itinerary schema changes? For now, we validate defensively when rendering, but this could be added later.
- Should the summary generation happen in the same transaction as the save, or separately? Currently planned as part of the save operation, but could be separated if performance becomes an issue.
