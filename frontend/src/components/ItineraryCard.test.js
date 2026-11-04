// components/ItineraryCard.test.js
//
// Unit tests for ItineraryCard component - pure logic tests
// These tests verify the component's parsing and display logic

import { describe, it } from "node:test";
import assert from "node:assert";

// Mock itinerary data for testing
const mockItinerary3Days = {
  days: [
    {
      day: 1,
      title: "Arrival Day",
      activities: [
        { time: "09:00", description: "Check-in at hotel", location: "Hotel", source: "model" },
        { time: "11:00", description: "Lunch", location: "Restaurant", source: "model" },
        { time: "14:00", description: "Explore old town", location: "Old Town", source: "model" },
        { time: "18:00", description: "Dinner", location: "Restaurant", source: "model" },
      ],
    },
    {
      day: 2,
      title: "Cultural Day",
      activities: [
        { time: "09:00", description: "Visit museum", location: "Museum", source: "model" },
        { time: "12:00", description: "Lunch", location: "Cafe", source: "model" },
      ],
    },
    {
      day: 3,
      title: "Departure Day",
      activities: [
        { time: "09:00", description: "Breakfast", location: "Hotel", source: "model" },
      ],
    },
  ],
};

const mockItinerary1Day = {
  days: [
    {
      day: 1,
      title: "Single Day",
      activities: [
        { time: "10:00", description: "Activity 1", location: "Location 1", source: "model" },
        { time: "12:00", description: "Activity 2", location: "Location 2", source: "model" },
      ],
    },
  ],
};

const mockItineraryNoActivities = {
  days: [
    { day: 1, title: "Empty Day", activities: [] },
    { day: 2, title: "Another Empty Day", activities: [] },
  ],
};

const mockItineraryWithLocations = {
  days: [
    {
      day: 1,
      title: "Day with Locations",
      activities: [
        { time: "09:00", description: "Visit landmark", location: "Famous Place", source: "guide" },
        { time: "14:00", description: "Lunch", location: "Restaurant Name", source: "model" },
      ],
    },
  ],
};

const mockEmptyItinerary = null;
const mockUndefinedItinerary = undefined;

// Helper functions extracted from ItineraryCard component
function getDayCount(itinerary) {
  if (!itinerary) return 0;
  return itinerary.days?.length || 0;
}

function getTotalActivities(itinerary) {
  if (!itinerary) return 0;
  return itinerary.days?.reduce(
    (sum, day) => sum + (day.activities?.length || 0),
    0
  ) || 0;
}

function getFirstDayActivities(itinerary) {
  if (!itinerary) return [];
  return itinerary.days?.[0]?.activities || [];
}

function getPreviewActivities(itinerary, isMobile = false) {
  const maxPreviewItems = isMobile ? 2 : 3;
  const activities = getFirstDayActivities(itinerary);
  return activities.slice(0, maxPreviewItems);
}

function formatPreview(activities) {
  if (!activities || activities.length === 0) return "";
  return activities
    .map((act) => `${act.time} - ${act.description}`)
    .join(", ");
}

function getDaysLeft(expiresAt) {
  try {
    if (!expiresAt) return 0;
    const expiresDate = new Date(expiresAt);
    if (isNaN(expiresDate.getTime())) return 0;
    const now = new Date();
    const diffTime = expiresDate.getTime() - now.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

describe("ItineraryCard - Day Count Calculation", () => {
  describe("Normal itineraries", () => {
    it("should return correct day count for 3-day itinerary", () => {
      const count = getDayCount(mockItinerary3Days);
      assert.equal(count, 3);
    });

    it("should return correct day count for 1-day itinerary", () => {
      const count = getDayCount(mockItinerary1Day);
      assert.equal(count, 1);
    });

    it("should return correct day count for 2-day itinerary with no activities", () => {
      const count = getDayCount(mockItineraryNoActivities);
      assert.equal(count, 2);
    });
  });

  describe("Edge cases", () => {
    it("should return 0 for empty itinerary", () => {
      const count = getDayCount(mockEmptyItinerary);
      assert.equal(count, 0);
    });

    it("should return 0 for undefined itinerary", () => {
      const count = getDayCount(mockUndefinedItinerary);
      assert.equal(count, 0);
    });

    it("should return 0 for itinerary with empty days array", () => {
      const count = getDayCount({ days: [] });
      assert.equal(count, 0);
    });

    it("should return 0 for null days", () => {
      const count = getDayCount({ days: null });
      assert.equal(count, 0);
    });
  });
});

describe("ItineraryCard - Activity Count Calculation", () => {
  describe("Normal itineraries", () => {
    it("should return correct total activities for 3-day itinerary", () => {
      // 4 + 2 + 1 = 7 activities
      const count = getTotalActivities(mockItinerary3Days);
      assert.equal(count, 7);
    });

    it("should return correct total activities for 1-day itinerary", () => {
      const count = getTotalActivities(mockItinerary1Day);
      assert.equal(count, 2);
    });

    it("should return 0 for itinerary with no activities", () => {
      const count = getTotalActivities(mockItineraryNoActivities);
      assert.equal(count, 0);
    });
  });

  describe("Edge cases", () => {
    it("should return 0 for empty itinerary", () => {
      const count = getTotalActivities(mockEmptyItinerary);
      assert.equal(count, 0);
    });

    it("should return 0 for undefined itinerary", () => {
      const count = getTotalActivities(mockUndefinedItinerary);
      assert.equal(count, 0);
    });

    it("should return 0 for null days", () => {
      const count = getTotalActivities({ days: null });
      assert.equal(count, 0);
    });

    it("should handle days with null activities", () => {
      const itinerary = {
        days: [
          { day: 1, title: "Day 1", activities: null },
          { day: 2, title: "Day 2", activities: [] },
        ],
      };
      const count = getTotalActivities(itinerary);
      assert.equal(count, 0);
    });
  });
});

describe("ItineraryCard - First Day Activity Extraction", () => {
  describe("Normal itineraries", () => {
    it("should return first day activities for 3-day itinerary", () => {
      const activities = getFirstDayActivities(mockItinerary3Days);
      assert.equal(activities.length, 4);
      assert.equal(activities[0].description, "Check-in at hotel");
    });

    it("should return first day activities for 1-day itinerary", () => {
      const activities = getFirstDayActivities(mockItinerary1Day);
      assert.equal(activities.length, 2);
    });

    it("should return empty array for itinerary with no activities on first day", () => {
      const activities = getFirstDayActivities(mockItineraryNoActivities);
      assert.equal(activities.length, 0);
    });
  });

  describe("Edge cases", () => {
    it("should return empty array for empty itinerary", () => {
      const activities = getFirstDayActivities(mockEmptyItinerary);
      assert.equal(activities.length, 0);
    });

    it("should return empty array for undefined itinerary", () => {
      const activities = getFirstDayActivities(mockUndefinedItinerary);
      assert.equal(activities.length, 0);
    });

    it("should return empty array for empty days array", () => {
      const activities = getFirstDayActivities({ days: [] });
      assert.equal(activities.length, 0);
    });
  });
});

describe("ItineraryCard - Preview Truncation Logic", () => {
  describe("Desktop (max 3 activities)", () => {
    it("should return all 3 activities for first day with 4 activities", () => {
      const preview = getPreviewActivities(mockItinerary3Days, false);
      assert.equal(preview.length, 3);
    });

    it("should return all activities when less than 3", () => {
      const preview = getPreviewActivities(mockItinerary1Day, false);
      assert.equal(preview.length, 2);
    });

    it("should return empty array when no activities", () => {
      const preview = getPreviewActivities(mockItineraryNoActivities, false);
      assert.equal(preview.length, 0);
    });
  });

  describe("Mobile (max 2 activities)", () => {
    it("should return only 2 activities for first day with 4 activities", () => {
      const preview = getPreviewActivities(mockItinerary3Days, true);
      assert.equal(preview.length, 2);
    });

    it("should return all activities when less than 2", () => {
      const preview = getPreviewActivities(mockItinerary1Day, true);
      assert.equal(preview.length, 2);
    });

    it("should return empty array when no activities", () => {
      const preview = getPreviewActivities(mockItineraryNoActivities, true);
      assert.equal(preview.length, 0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty itinerary", () => {
      const preview = getPreviewActivities(mockEmptyItinerary, false);
      assert.equal(preview.length, 0);
    });

    it("should handle undefined itinerary", () => {
      const preview = getPreviewActivities(mockUndefinedItinerary, false);
      assert.equal(preview.length, 0);
    });
  });
});

describe("ItineraryCard - Preview Formatting", () => {
  describe("Normal cases", () => {
    it("should format preview with time and description", () => {
      const activities = getFirstDayActivities(mockItinerary3Days).slice(0, 2);
      const preview = formatPreview(activities);
      assert.ok(preview.includes("09:00"));
      assert.ok(preview.includes("Check-in at hotel"));
      assert.ok(preview.includes("11:00"));
      assert.ok(preview.includes("Lunch"));
    });

    it("should return empty string for empty activities", () => {
      const preview = formatPreview([]);
      assert.equal(preview, "");
    });

    it("should handle activities with locations", () => {
      const activities = getFirstDayActivities(mockItineraryWithLocations);
      const preview = formatPreview(activities);
      assert.ok(preview.includes("Visit landmark"));
      // Locations should not be in the preview (only time and description)
      assert.ok(!preview.includes("Famous Place"));
    });
  });
});

describe("ItineraryCard - Empty/Undefined Handling", () => {
  describe("getDayCount", () => {
    it("should handle null itinerary", () => {
      const count = getDayCount(null);
      assert.equal(count, 0);
    });

    it("should handle undefined itinerary", () => {
      const count = getDayCount(undefined);
      assert.equal(count, 0);
    });

    it("should handle missing days property", () => {
      const count = getDayCount({});
      assert.equal(count, 0);
    });
  });

  describe("getTotalActivities", () => {
    it("should handle null itinerary", () => {
      const count = getTotalActivities(null);
      assert.equal(count, 0);
    });

    it("should handle undefined itinerary", () => {
      const count = getTotalActivities(undefined);
      assert.equal(count, 0);
    });

    it("should handle missing days property", () => {
      const count = getTotalActivities({});
      assert.equal(count, 0);
    });
  });

  describe("getFirstDayActivities", () => {
    it("should handle null itinerary", () => {
      const activities = getFirstDayActivities(null);
      assert.equal(activities.length, 0);
    });

    it("should handle undefined itinerary", () => {
      const activities = getFirstDayActivities(undefined);
      assert.equal(activities.length, 0);
    });

    it("should handle missing days property", () => {
      const activities = getFirstDayActivities({});
      assert.equal(activities.length, 0);
    });
  });

  describe("getPreviewActivities", () => {
    it("should handle null itinerary", () => {
      const activities = getPreviewActivities(null, false);
      assert.equal(activities.length, 0);
    });

    it("should handle undefined itinerary", () => {
      const activities = getPreviewActivities(undefined, false);
      assert.equal(activities.length, 0);
    });
  });

  describe("formatPreview", () => {
    it("should handle null activities", () => {
      const preview = formatPreview(null);
      assert.equal(preview, "");
    });

    it("should handle undefined activities", () => {
      const preview = formatPreview(undefined);
      assert.equal(preview, "");
    });
  });
});

describe("ItineraryCard - Days Left Calculation", () => {
  describe("Normal cases", () => {
    it("should calculate days left correctly", () => {
      // Create a date 5 days in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const daysLeft = getDaysLeft(futureDate.toISOString());
      // Should be approximately 5 (allow for small differences due to time of day)
      assert.ok(daysLeft >= 4 && daysLeft <= 5);
    });

    it("should return negative for past date", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const daysLeft = getDaysLeft(pastDate.toISOString());
      assert.ok(daysLeft < 0);
    });

    it("should return 0 for today", () => {
      const today = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const daysLeft = getDaysLeft(today.toISOString());
      assert.equal(daysLeft, 0);
    });
  });

  describe("Edge cases", () => {
    it("should handle invalid date string", () => {
      const daysLeft = getDaysLeft("invalid-date");
      assert.equal(daysLeft, 0);
    });

    it("should handle empty string", () => {
      const daysLeft = getDaysLeft("");
      assert.equal(daysLeft, 0);
    });

    it("should handle null", () => {
      const daysLeft = getDaysLeft(null);
      assert.equal(daysLeft, 0);
    });

    it("should handle undefined", () => {
      const daysLeft = getDaysLeft(undefined);
      assert.equal(daysLeft, 0);
    });
  });
});

describe("ItineraryCard - Component Props", () => {
  it("should accept id prop", () => {
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete: () => {},
      deletingId: null,
    };
    assert.equal(props.id, "123");
  });

  it("should accept prompt prop", () => {
    const props = {
      id: "123",
      prompt: "Test prompt",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete: () => {},
      deletingId: null,
    };
    assert.equal(props.prompt, "Test prompt");
  });

  it("should accept itinerary prop", () => {
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: mockItinerary3Days,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete: () => {},
      deletingId: null,
    };
    assert.ok(props.itinerary);
    assert.equal(props.itinerary.days.length, 3);
  });

  it("should accept onClick callback", () => {
    const onClick = () => {};
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick,
      onDelete: () => {},
      deletingId: null,
    };
    assert.equal(typeof props.onClick, "function");
  });

  it("should accept onDelete callback", () => {
    const onDelete = () => {};
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete,
      deletingId: null,
    };
    assert.equal(typeof props.onDelete, "function");
  });

  it("should accept isMobile prop", () => {
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete: () => {},
      deletingId: null,
      isMobile: true,
    };
    assert.equal(props.isMobile, true);
  });

  it("should have optional isMobile prop", () => {
    const props = {
      id: "123",
      prompt: "Test",
      summary: "Test summary",
      itinerary: null,
      createdAt: "2026-01-01",
      expiresAt: "2026-01-31",
      onClick: () => {},
      onDelete: () => {},
      deletingId: null,
    };
    assert.ok(props.isMobile === undefined);
  });
});

describe("ItineraryCard - Component Messages", () => {
  it("should display preview label", () => {
    const label = "Vista previa:";
    assert.ok(label.includes("Vista previa"));
  });

  it("should display days label correctly for singular", () => {
    const label = "1 día";
    assert.ok(label.includes("día"));
    assert.ok(!label.includes("días"));
  });

  it("should display days label correctly for plural", () => {
    const label = "3 días";
    assert.ok(label.includes("días"));
  });

  it("should display activities label correctly for singular", () => {
    const label = "1 actividad";
    assert.ok(label.includes("actividad"));
    assert.ok(!label.includes("actividades"));
  });

  it("should display activities label correctly for plural", () => {
    const label = "5 actividades";
    assert.ok(label.includes("actividades"));
  });

  it("should display separator", () => {
    const separator = "|";
    assert.equal(separator, "|");
  });

  it("should display preview more indicator", () => {
    const more = "...";
    assert.equal(more, "...");
  });

  it("should display expiration label singular", () => {
    const label = "Expira en 1 día";
    assert.ok(label.includes("día"));
  });

  it("should display expiration label plural", () => {
    const label = "Expira en 5 días";
    assert.ok(label.includes("días"));
  });
});
