# Proposal

## Why

Users cannot quickly understand their saved itineraries from the list view. Currently, the ItineraryHistory component only displays basic metadata (prompt, summary, creation date, expiration), forcing users to click into each itinerary to see the structured day-by-day format with activities and times. This makes it difficult to review and select past itineraries efficiently.

This change addresses the need for a scannable, informative list view that provides immediate value without requiring navigation to detail pages.

## What Changes

- **New frontend component**: ItineraryCard component to replace simple list items in the history view
- **Enhanced list view**: Each itinerary card will display day count, total activity count, and a preview of the first day's activities with times
- **Improved UX**: Hover states, better visual hierarchy, and responsive design for mobile devices
- **Accessibility enhancements**: Keyboard navigation, screen reader labels, and WCAG 2.1 AA compliance

## Capabilities

### New Capabilities
- `frontend/itinerary-history`: Structured preview display of saved itineraries in the list view, including day count, activity count, and first day's activities with times

### Modified Capabilities
- `itinerary/history`: Frontend requirement enhanced to specify structured display capabilities (the existing requirement "Frontend displays history" is expanded with specific display requirements)

## Impact

- **Frontend files modified**:
  - `frontend/src/components/ItineraryHistory.tsx` - Update to use ItineraryCard component
  - `frontend/src/components/ItineraryCard.tsx` - New component for structured preview
  - `frontend/src/components/ItineraryHistory.test.js` - Add tests for new UI elements
- **Backend**: No changes required - uses existing API endpoints
- **Database**: No changes required
- **Dependencies**: No new dependencies

**Documents affected**:
- `documentation/frontend-standards.md` - UI patterns referenced for consistency
