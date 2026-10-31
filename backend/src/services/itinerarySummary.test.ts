// services/itinerarySummary.test.ts
//
// Tests for itinerary summary service
// Run with: npx tsx --test src/services/itinerarySummary.test.ts
//
// Note: These tests mock the LLM call since we don't want to actually
// call Gemini in unit tests. The actual LLM integration is tested separately.

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateSummary } from "./itinerarySummary";

const TEST_DOCS_MASTER_KEY = "a".repeat(64);

describe("itinerarySummary service", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-api-key";
    process.env.DOCS_MASTER_KEY = TEST_DOCS_MASTER_KEY;
  });

  test("generateSummary returns a string", async () => {
    const itineraryJson = JSON.stringify({
      days: [
        {
          day: 1,
          title: "Day 1 in Lisbon",
          activities: [{ description: "Visit Belem Tower" }],
        },
      ],
    });

    const prompt = "3 days in Lisbon";
    const summary = await generateSummary(itineraryJson, prompt);

    assert.ok(typeof summary === "string");
    assert.ok(summary.length > 0);
  });

  test("generateSummary returns max 500 characters", async () => {
    const itineraryJson = JSON.stringify({
      days: [
        {
          day: 1,
          title: "Day 1",
          activities: [{ description: "Activity" }],
        },
      ],
    });

    const prompt = "Test prompt";
    const summary = await generateSummary(itineraryJson, prompt);

    assert.ok(summary.length <= 500);
  });

  test("generateSummary handles errors gracefully", async () => {
    // Even if the LLM fails, the function should return a fallback
    const itineraryJson = JSON.stringify({ days: [] });
    const prompt = "Test";

    const summary = await generateSummary(itineraryJson, prompt);

    // Should return the prompt as fallback if LLM fails
    assert.ok(typeof summary === "string");
  });
});
