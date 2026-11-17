# Design

## Context

The existing ItineraryHistory component displays only basic metadata (prompt, summary, creation date, expiration) in the list view. The full structured itinerary (days with activities and times) is only visible in the detail view. The API already returns encrypted itinerary JSON in the list response, which can be decrypted and parsed on the frontend.

Current state: ItineraryHistory.tsx uses a simple `<ul>` with `<li>` items showing minimal information.

## Goals / Non-Goals

**Goals:**
- Create a reusable ItineraryCard component for structured display
- Parse existing itinerary JSON to extract day count, activity count, and first day's activities
- Implement responsive design that truncates preview on mobile
- Maintain accessibility standards (WCAG 2.1 AA)
- Reuse existing styling patterns from TripMind

**Non-Goals:**
- Backend API changes (existing endpoints provide all needed data)
- Database schema changes
- Authentication/authorization changes
- Changes to the detail view (ItineraryDetailView)
- Pagination implementation

## Decisions

### 1. Create ItineraryCard Component
**Decision**: Create a new, reusable ItineraryCard component instead of inline rendering in ItineraryHistory.

**Rationale**: 
- Promotes reusability and maintainability
- Clear separation of concerns
- Easier to test in isolation
- Can be used in other contexts if needed

**Alternatives considered**:
- Inline rendering in ItineraryHistory: Would keep logic in one file but reduce reusability
- Extend existing component: Would work but ItineraryHistory is already handling view switching

### 2. Parse Itinerary JSON on Frontend
**Decision**: Parse the itinerary JSON on the frontend to extract structured data for preview.

**Rationale**:
- No backend changes required
- API already returns full itinerary JSON (encrypted, then decrypted)
- Reduces backend load
- Keeps display logic on frontend where it belongs

**Alternatives considered**:
- Backend pre-computation: Would require API changes, which are explicitly out of scope

### 3. Preview from First Day Only
**Decision**: Show activities from the first day only in the preview.

**Rationale**:
- First day's activities are most representative of the trip
- Keeps preview concise and scannable
- Matches user expectation (first impression of the itinerary)
- Reduces complexity of data extraction

**Alternatives considered**:
- Show activities from all days: Would provide more information but make preview too long
- Show most "important" activities: Would require ranking logic which is subjective

### 4. Preview Length: 3 Desktop / 2 Mobile
**Decision**: Show maximum 3 activities on desktop, 2 on mobile.

**Rationale**:
- Balances information density with card compactness
- Matches common design patterns for card-based UIs
- Mobile screens have less horizontal space

**Alternatives considered**:
- Same length on all devices: Would waste space on desktop or overflow on mobile
- Configurable length: Adds unnecessary complexity

### 5. Use React.memo for Performance
**Decision**: Use React.memo for ItineraryCard to optimize rendering.

**Rationale**:
- Max 10 itineraries per user, but parsing JSON could be expensive
- Prevents unnecessary re-renders when parent component updates
- Simple optimization with minimal code change

**Alternatives considered**:
- No memoization: Might cause performance issues with larger itineraries
- Custom memoization logic: More complex than needed

### 6. Error Boundaries for Parsing
**Decision**: Add try-catch blocks around JSON parsing in ItineraryCard.

**Rationale**:
- Old or malformed itinerary JSON might exist
- Prevents entire list from breaking due to one bad entry
- Provides graceful degradation with fallback content

**Alternatives considered**:
- No error handling: Would cause crashes on malformed data
- Global error boundary: Would catch errors but less granular

## Risks / Trade-offs

[Risk: Performance with large itineraries] → Mitigation: Parse only first day for preview, use React.memo, cache counts

[Risk: UI clutter with too much information] → Mitigation: Use clear visual hierarchy, limit preview to 2-3 activities, group related information

[Risk: Breaking changes from future itinerary schema changes] → Mitigation: Add defensive checks (optional chaining, null checks), error boundaries

[Risk: Data consistency issues with malformed JSON] → Mitigation: Try-catch around JSON parsing, show fallback content

[Risk: Accessibility compliance] → Mitigation: Follow WCAG 2.1 AA guidelines, test with screen readers, ensure keyboard navigation

[Risk: Mobile layout issues] → Mitigation: Test at 375px viewport width, truncate preview on mobile, ensure touch targets meet minimum size (44x44px)

## Migration Plan

No migration required - this is a frontend-only enhancement. Deployment steps:
1. Deploy frontend changes (ItineraryCard.tsx, updated ItineraryHistory.tsx)
2. No backend deployment needed
3. No database migration needed
4. No data migration needed

Rollback strategy:
- Simply redeploy the previous frontend version
- No data loss or corruption possible

## Open Questions

None - all technical decisions have been resolved based on existing project patterns and the Jira ticket requirements.
