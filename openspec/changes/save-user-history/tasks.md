# Tasks

## 1. Database Schema

- [x] 1.1 Create `backend/script_sql/002_user_itineraries.sql` with user_itineraries table definition including id (UUID PK), user_id (TEXT), prompt (TEXT), summary (TEXT, 500 chars max), itinerary_json (TEXT encrypted), created_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ), and indexes on (user_id, created_at DESC) and (expires_at), and verify the SQL file is valid PostgreSQL syntax
- [x] 1.2 Apply migration to dev database using `npm run db:migrate:dev` and verify table exists with correct columns and indexes

## 2. Backend Constants and Configuration

- [x] 2.1 Add `MAX_ITINERARIES_PER_USER = 10` and `ITINERARY_RETENTION_DAYS = 30` to `backend/src/constans.ts` and verify constants are exported correctly

## 3. Backend Services

- [x] 3.1 Create `backend/src/services/itineraryHistory.ts` with saveItinerary (with encryption), listItineraries, getItinerary (with decryption), deleteItinerary, and enforceLimit functions, and verify unit tests pass for all functions
- [x] 3.2 Create `backend/src/services/itinerarySummary.ts` with generateSummary function (max 500 chars using existing LLM) and verify it generates summaries covering destination, duration, travel type, and interests
- [x] 3.3 Modify `backend/src/services/itinerary.ts` to call saveItinerary after successful generation in generateItinerary and streamItinerary (after stream completion and validation), and verify saving works without breaking generation on errors

## 4. Backend Routes

- [x] 4.1 Create `backend/src/routes/itineraryHistory.ts` with GET /api/itinerary/history, GET /api/itinerary/history/:id, and DELETE /api/itinerary/history/:id endpoints using checkJwt middleware, and verify all endpoints return correct responses and status codes

## 5. Backend Integration

- [x] 5.1 Register itineraryHistory routes in `backend/src/index.ts` and verify routes are accessible at the expected paths
- [x] 5.2 Modify `backend/src/services/cleanupExpiredDocuments.ts` to include expired itineraries deletion (where expires_at <= now()) and verify cleanup removes expired items

## 6. Frontend Hook

- [x] 6.1 Create `frontend/src/hooks/useItineraryHistory.ts` with list, get, and delete functions using getAccessTokenSilently() for authentication, and verify hook functions return expected data and handle errors

## 7. Frontend Component

- [x] 7.1 Create `frontend/src/components/ItineraryHistory.tsx` with list view, detail view, delete with confirmation, loading states, empty state, error state, and retention notice, and verify component renders correctly in all states

## 8. Frontend Integration

- [x] 8.1 Integrate ItineraryHistory component into `frontend/src/App.tsx` (or equivalent) with visibility only for authenticated users, and verify history panel is accessible and functional

## 9. Documentation Updates

- [x] 9.1 Update `documentation/api-spec.yml` with new endpoints (GET /api/itinerary/history, GET /api/itinerary/history/:id, DELETE /api/itinerary/history/:id) including request/response schemas, and verify OpenAPI spec is valid
- [x] 9.2 Update `documentation/data.model.md` with user_itineraries table definition, encryption approach, and retention rules, and verify documentation is accurate
- [x] 9.3 Update `README.md` with history feature description and usage, and verify README changes are clear and accurate

## 10. Testing

- [x] 10.1 Write backend unit tests for saveItinerary, listItineraries, getItinerary, deleteItinerary, enforceLimit, and summary generation in their respective test files, and verify all tests pass
- [x] 10.2 Write backend unit tests for itinerary history endpoints with auth mock and verify all endpoint tests pass
- [x] 10.3 Write backend tests for limit enforcement (10 items), expiration handling, user isolation, encryption round trip, and decryption failure with another user's key, and verify all tests pass
- [x] 10.4 Write frontend unit tests for useItineraryHistory hook and verify all hook tests pass
- [x] 10.5 Write frontend unit tests for ItineraryHistory component covering list, open, delete, and all states, and verify all component tests pass
- [x] 10.6 Perform manual frontend testing of list, open, delete, loading, empty, and error states, and verify all manual tests pass

## 11. Production Deployment Preparation

- [ ] 11.1 Apply `backend/script_sql/002_user_itineraries.sql` to production database and verify table exists in Neon prod
- [ ] 11.2 Verify all acceptance criteria from Jira SCRUM-5 are met through manual and automated testing
