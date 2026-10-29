# Proposal: Save User History

## Why

Users currently cannot save or revisit previously generated itineraries. This means every session starts fresh, losing the value of past planning efforts. Saving itinerary history allows users to return to and reference their previous trip plans, increasing engagement and the practical value of the application.

Why now: The core itinerary generation is stable. Users have requested this feature to preserve their work across sessions. It aligns with the existing pattern of saving user documents and memory.

## What Changes

- **New database table**: `user_itineraries` to store itinerary metadata and encrypted JSON
- **New backend service**: Itinerary history service with save, list, get, and delete operations
- **New backend routes**: REST endpoints at `/api/itinerary/history` and `/api/itinerary/history/:id`
- **New summary service**: Generate concise summaries (≤500 chars) for saved itineraries
- **Backend integration**: Automatic saving after successful itinerary generation (sync and stream)
- **Cleanup extension**: Daily cleanup job extended to remove expired itineraries
- **New constants**: `MAX_ITINERARIES_PER_USER` (10) and `ITINERARY_RETENTION_DAYS` (30)
- **New frontend hook**: `useItineraryHistory` for history operations
- **New frontend component**: `ItineraryHistory` for list, detail view, and delete functionality
- **Frontend integration**: History panel/page integrated into the UI
- **Documentation updates**: OpenAPI spec, `data.model.md`, and README

## Capabilities

### New Capabilities
- `itinerary/history`: User-facing itinerary history management including save, list, retrieve, delete, encryption, limits, retention, and displaying retention notice. This capability owns the requirements for persisting generated itineraries, accessing saved itineraries, managing the 10-item per-user limit with 30-day retention, and displaying the retention notice "Saved for 30 days, max 10 itineraries" in the History tab.

## Impact

- **Backend**: New routes, services, database table, and cleanup logic
- **Frontend**: New components, hooks, and UI integration
- **Database**: New `user_itineraries` table in Neon (dev and prod)
- **API**: New endpoints requiring authentication via existing `checkJwt` middleware
- **Documentation**: Updates to OpenAPI, data model documentation, and README
- **Testing**: New unit tests for backend services and frontend components
