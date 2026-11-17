# Spec Delta

## Purpose

Enables users to quickly understand and review their saved itineraries through structured previews directly in the list view, without needing to open each itinerary individually.

## ADDED Requirements

### Requirement: Display day count
The frontend SHALL display the total number of days for each itinerary in the list view.

#### Scenario: Itinerary with multiple days
- **WHEN** user views their itinerary history
- **THEN** each itinerary card shows the day count (e.g., "3 days")

### Requirement: Display activity count
The frontend SHALL display the total number of activities across all days for each itinerary in the list view.

#### Scenario: Itinerary with activities
- **WHEN** user views their itinerary history
- **THEN** each itinerary card shows the total activity count (e.g., "12 activities")

### Requirement: Display first day activity preview
The frontend SHALL display a preview of the first day's activities with times for each itinerary in the list view.

#### Scenario: Preview shows activities with times
- **WHEN** user views their itinerary history
- **THEN** each itinerary card shows a preview of first day's activities with times (e.g., "09:00 - Visit Alfama, 11:00 - Coffee")

### Requirement: Truncate preview for compactness
The frontend SHALL truncate the activity preview to a maximum of 3 activities on desktop and 2 on mobile to keep cards compact.

#### Scenario: Desktop preview truncation
- **WHEN** user views itinerary history on desktop (>768px width)
- **THEN** preview shows maximum 3 activities from first day

#### Scenario: Mobile preview truncation
- **WHEN** user views itinerary history on mobile (<=768px width)
- **THEN** preview shows maximum 2 activities from first day

### Requirement: Maintain existing functionality
The frontend SHALL preserve all existing ItineraryHistory functionality including detail view navigation, delete, loading states, and error states.

#### Scenario: Click card opens detail view
- **WHEN** user clicks on an itinerary card
- **THEN** system navigates to the detail view for that itinerary

#### Scenario: Delete button works
- **WHEN** user clicks delete button on an itinerary card
- **THEN** system shows confirmation dialog and deletes the itinerary on confirmation

### Requirement: Responsive design
The frontend SHALL maintain responsive design for itinerary cards across all screen sizes.

#### Scenario: Cards stack on mobile
- **WHEN** user views itinerary history on mobile viewport (375px)
- **THEN** cards stack vertically and remain readable

### Requirement: Accessible keyboard navigation
The frontend SHALL support keyboard navigation for itinerary cards following WCAG 2.1 AA standards.

#### Scenario: Keyboard focus on cards
- **WHEN** user tabs through the itinerary list
- **THEN** each card is focusable and clickable via Enter/Space key

### Requirement: Screen reader support
The frontend SHALL provide appropriate aria-labels for screen readers on all interactive elements.

#### Scenario: Screen reader announces card content
- **WHEN** screen reader user navigates to an itinerary card
- **THEN** screen reader announces itinerary summary, day count, and activity count

### Requirement: Visual consistency
The frontend SHALL use existing TripMind CSS patterns for styling itinerary cards.

#### Scenario: Cards match existing styling
- **WHEN** user views itinerary history
- **THEN** cards use consistent colors, typography, and spacing with existing TripMind UI

### Requirement: Handle missing or malformed data
The frontend SHALL gracefully handle missing or malformed itinerary JSON data by showing fallback content.

#### Scenario: Malformed itinerary JSON
- **WHEN** itinerary JSON is malformed or missing expected fields
- **THEN** system shows fallback content instead of errors

#### Scenario: Missing itinerary data
- **WHEN** itinerary data is null or undefined
- **THEN** system shows empty state or loading state appropriately
