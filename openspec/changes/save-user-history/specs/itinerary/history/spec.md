# Spec Delta

## Purpose

Enables users to persist, retrieve, and manage their generated itineraries across sessions with encryption, limits, and automatic retention policies.

## ADDED Requirements

### Requirement: System automatically saves generated itineraries
The system SHALL automatically save every successfully generated itinerary after validation.

#### Scenario: Save on sync generation
- **WHEN** `generateItinerary` completes with a valid itinerary JSON
- **THEN** system saves the itinerary with prompt, summary, and encrypted JSON

#### Scenario: Save on stream generation
- **WHEN** `streamItinerary` finishes and the final JSON passes schema validation
- **THEN** system saves the itinerary

#### Scenario: Save failure does not break generation
- **WHEN** saving fails after successful generation
- **THEN** system logs the error and returns the generated itinerary to the user

### Requirement: System generates summary for saved itineraries
The system SHALL generate a summary of max 500 characters for each saved itinerary.

#### Scenario: Summary covers key details
- **WHEN** an itinerary is saved
- **THEN** the summary includes main destination, approximate duration, travel type, and main interests

#### Scenario: Summary length constraint
- **WHEN** an itinerary is saved
- **THEN** the summary is at most 500 characters

### Requirement: System encrypts itinerary JSON
The system SHALL encrypt the full itinerary JSON before storage.

#### Scenario: Encryption with user-specific key
- **WHEN** saving an itinerary
- **THEN** system encrypts the JSON using AES-256-GCM with a key derived from DOCS_MASTER_KEY and user_id

#### Scenario: JSON validation before encryption
- **WHEN** saving an itinerary
- **THEN** system validates the itinerary against the itinerary schema before stringifying and encrypting

### Requirement: System enforces 10 itineraries per user limit
The system SHALL enforce a maximum of 10 non-expired itineraries per user.

#### Scenario: Save succeeds under limit
- **WHEN** a user with 9 saved itineraries generates a new one
- **THEN** system saves the 10th itinerary successfully

#### Scenario: Save triggers cleanup at limit
- **WHEN** a user with 10 saved itineraries generates an 11th
- **THEN** system deletes the oldest non-expired itinerary and saves the new one

#### Scenario: Concurrent saves respect limit
- **WHEN** multiple saves occur simultaneously for a user at the limit
- **THEN** system uses transaction with row lock to ensure never more than 10 non-expired itineraries

### Requirement: System saves exactly one itinerary per generation request
The system SHALL save exactly ONE itinerary per generation request, even if the LLM makes multiple internal attempts. Orchestrator retries MUST NOT generate additional entries in the history.

#### Scenario: Single itinerary saved per user request
- **WHEN** a user requests an itinerary generation
- **THEN** the system saves exactly one entry in user_itineraries table, regardless of internal LLM retries or orchestrator validation loops

#### Scenario: Retry does not duplicate entries
- **WHEN** the orchestrator retries generation due to validation issues
- **THEN** the system updates the same itinerary entry or saves only the final successful result, not intermediate attempts

### Requirement: System applies 30-day retention
The system SHALL set a 30-day expiration on each saved itinerary.

#### Scenario: Expires_at set on creation
- **WHEN** an itinerary is saved
- **THEN** system sets expires_at to created_at + 30 days

#### Scenario: Expired itineraries excluded from list
- **WHEN** user lists their itineraries
- **THEN** system returns only non-expired itineraries (expires_at > now())

### Requirement: User can list their itineraries
The system SHALL provide an endpoint for users to list their saved itineraries.

#### Scenario: List returns user's itineraries
- **WHEN** user calls GET /api/itinerary/history with valid JWT
- **THEN** system returns itineraries array with id, prompt, summary, created_at, expires_at for that user only

#### Scenario: List ordered newest first
- **WHEN** user lists their itineraries
- **THEN** system returns results ordered by created_at DESC

#### Scenario: List performance
- **WHEN** user lists their itineraries
- **THEN** system responds in under 200ms for up to 10 items

### Requirement: User can retrieve a saved itinerary
The system SHALL provide an endpoint for users to retrieve a specific saved itinerary.

#### Scenario: Get returns decrypted itinerary
- **WHEN** user calls GET /api/itinerary/history/:id with valid JWT
- **THEN** system returns the decrypted and parsed itinerary JSON with id, prompt, summary, itinerary, created_at, expires_at

#### Scenario: Get validates ownership
- **WHEN** user requests an itinerary belonging to another user
- **THEN** system returns 404

#### Scenario: Get returns 404 for expired
- **WHEN** user requests an expired itinerary
- **THEN** system returns 404

### Requirement: User can delete their itineraries
The system SHALL provide an endpoint for users to delete their saved itineraries.

#### Scenario: Delete removes itinerary
- **WHEN** user calls DELETE /api/itinerary/history/:id with valid JWT
- **THEN** system deletes the itinerary and returns success: true

#### Scenario: Delete validates ownership
- **WHEN** user attempts to delete another user's itinerary
- **THEN** system returns 404

#### Scenario: Delete returns 404 for expired
- **WHEN** user attempts to delete an expired itinerary
- **THEN** system returns 404

### Requirement: All endpoints require authentication
The system SHALL protect all history endpoints with JWT validation.

#### Scenario: Unauthenticated access denied
- **WHEN** unauthenticated user calls any /api/itinerary/history endpoint
- **THEN** system returns 401

#### Scenario: Invalid JWT rejected
- **WHEN** user provides invalid JWT
- **THEN** system returns 401

### Requirement: Cleanup removes expired itineraries
The system SHALL remove expired itineraries through the daily cleanup job.

#### Scenario: Daily cleanup includes itineraries
- **WHEN** POST /internal/cleanup runs
- **THEN** system deletes all expired itineraries (expires_at <= now())

#### Scenario: Runtime filter excludes expired
- **WHEN** user lists or retrieves itineraries
- **THEN** system filters out expired items even before cleanup runs

### Requirement: System ensures user isolation
The system SHALL ensure users can only access their own itineraries.

#### Scenario: Ownership validated on every endpoint
- **WHEN** user accesses any history endpoint
- **THEN** system validates that the user_id from JWT matches the itinerary's user_id

### Requirement: System maintains security and privacy
The system SHALL protect sensitive data in logs and traces.

#### Scenario: No content in logs
- **WHEN** saving or retrieving itineraries
- **THEN** system logs only ids and counts, never prompt, summary, or itinerary content

#### Scenario: No content in Langfuse traces
- **WHEN** saving or retrieving itineraries
- **THEN** system traces only ids and counts in Langfuse, never prompt, summary, or itinerary content

### Requirement: Frontend displays history
The frontend SHALL display a history panel/page for authenticated users.

#### Scenario: History visible to authenticated users
- **WHEN** user has an active session
- **THEN** frontend shows history panel/page

#### Scenario: Each item shows metadata
- **WHEN** history is displayed
- **THEN** each item shows prompt, summary, creation date, and days left before expiry

#### Scenario: Click opens itinerary
- **WHEN** user clicks a history item
- **THEN** frontend opens the saved itinerary in read-only mode using existing itinerary components

#### Scenario: Delete with confirmation
- **WHEN** user clicks delete button
- **THEN** frontend shows confirmation dialog before deleting

#### Scenario: List updates after delete
- **WHEN** user deletes an itinerary
- **THEN** frontend updates the list to remove the deleted item

#### Scenario: Loading state shown
- **WHEN** history data is being fetched
- **THEN** frontend shows loading indicator

#### Scenario: Empty state shown
- **WHEN** user has no saved itineraries
- **THEN** frontend shows empty state message

#### Scenario: Error state shown
- **WHEN** history fetch fails
- **THEN** frontend shows error state

#### Scenario: Retention notice visible
- **WHEN** history is displayed
- **THEN** frontend shows notice "Saved for 30 days, max 10 itineraries"
