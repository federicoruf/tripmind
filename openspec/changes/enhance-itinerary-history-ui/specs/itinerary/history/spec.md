# Spec Delta

## MODIFIED Requirements

### Requirement: Frontend displays history
The frontend SHALL display a history panel/page for authenticated users with structured previews showing day count, activity count, and first day's activities with times for each itinerary.

#### Scenario: History visible to authenticated users
- **WHEN** user has an active session
- **THEN** frontend shows history panel/page

#### Scenario: Each item shows metadata
- **WHEN** history is displayed
- **THEN** each item shows prompt, summary, creation date, and days left before expiry

#### Scenario: Each item shows day count
- **WHEN** history is displayed
- **THEN** each item shows the total number of days in the itinerary

#### Scenario: Each item shows activity count
- **WHEN** history is displayed
- **THEN** each item shows the total number of activities across all days

#### Scenario: Each item shows activity preview
- **WHEN** history is displayed
- **THEN** each item shows a preview of the first day's activities with times (max 3 on desktop, max 2 on mobile)

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
