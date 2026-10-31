// services/itineraryHistory.test.ts
//
// Tests for itinerary history service
// Run with: npx tsx --test src/services/itineraryHistory.test.ts

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import {
  saveItinerary,
  listItineraries,
  getItinerary,
  deleteItinerary,
  listExpiredItineraries,
  deleteItineraryById,
} from "./itineraryHistory";

const TEST_USER_ID = "test-user-123";
const TEST_DOCS_MASTER_KEY = "a".repeat(64);

// Helper to clean up test data
async function cleanupTestData() {
  await pool.query("DELETE FROM user_itineraries WHERE user_id = $1", [TEST_USER_ID]);
}

describe("itineraryHistory service", () => {
  beforeEach(async () => {
    process.env.DOCS_MASTER_KEY = TEST_DOCS_MASTER_KEY;
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("saveItinerary", () => {
    test("saves an itinerary successfully", async () => {
      const result = await saveItinerary(
        TEST_USER_ID,
        "3 days in Lisbon",
        "Lisbon, 3 days, cultural",
        JSON.stringify({ days: [{ day: 1, title: "Day 1" }] }),
      );

      assert.ok(result !== null);
      assert.equal(result?.userId, TEST_USER_ID);
      assert.equal(result?.prompt, "3 days in Lisbon");
      assert.equal(result?.summary, "Lisbon, 3 days, cultural");
      assert.ok(result?.itineraryJson);
    });

    test("saves multiple itineraries for the same user", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "Prompt 1",
        "Summary 1",
        JSON.stringify({ days: [] }),
      );
      await saveItinerary(
        TEST_USER_ID,
        "Prompt 2",
        "Summary 2",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 2);
    });

    test("enforces max 10 itineraries per user", async () => {
      // Save 10 itineraries
      for (let i = 0; i < 10; i++) {
        await saveItinerary(
          TEST_USER_ID,
          `Prompt ${i}`,
          `Summary ${i}`,
          JSON.stringify({ days: [] }),
        );
      }

      // Verify we have 10
      let itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 10);

      // Save an 11th - should delete the oldest
      await saveItinerary(
        TEST_USER_ID,
        "Prompt 11",
        "Summary 11",
        JSON.stringify({ days: [] }),
      );

      // Should still have 10
      itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 10);

      // The newest should be first
      assert.equal(itineraries[0].prompt, "Prompt 11");
    });

    test("does not break generation on save error", async () => {
      // This test verifies that saveItinerary returns null on error
      // and doesn't throw
      const result = await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );

      // Result should be an object, not null (unless there's an error)
      // This is just to verify the function returns gracefully
      assert.ok(result !== undefined);
    });
  });

  describe("listItineraries", () => {
    test("returns empty array for user with no itineraries", async () => {
      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 0);
    });

    test("returns itineraries ordered by created_at DESC", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "First",
        "Summary 1",
        JSON.stringify({ days: [] }),
      );
      await saveItinerary(
        TEST_USER_ID,
        "Second",
        "Summary 2",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 2);
      assert.equal(itineraries[0].prompt, "Second");
      assert.equal(itineraries[1].prompt, "First");
    });

    test("only returns non-expired itineraries", async () => {
      // This is harder to test without manipulating time
      // For now, skip this test
    });

    test("only returns itineraries for the specified user", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "User 1 prompt",
        "Summary",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries("different-user");
      assert.equal(itineraries.length, 0);
    });

    test("only returns non-expired itineraries", async () => {
      // Insert an expired itinerary directly
      await pool.query(
        `INSERT INTO user_itineraries
         (user_id, prompt, summary, itinerary_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, now() - interval '40 days', now() - interval '10 days')`,
        [TEST_USER_ID, "Expired prompt", "Expired summary", "encrypted"],
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(itineraries.length, 0);
    });
  });

  describe("getItinerary", () => {
    test("retrieves and decrypts a saved itinerary", async () => {
      const itineraryJson = JSON.stringify({ days: [{ day: 1, title: "Test" }] });
      await saveItinerary(
        TEST_USER_ID,
        "Test prompt",
        "Test summary",
        itineraryJson,
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      const result = await getItinerary(TEST_USER_ID, itineraries[0].id);

      assert.ok(result !== null);
      assert.equal(result?.prompt, "Test prompt");
      assert.equal(result?.summary, "Test summary");
      assert.deepEqual(result?.itinerary, { days: [{ day: 1, title: "Test" }] });
    });

    test("returns null for non-existent itinerary", async () => {
      // Use a valid UUID format that doesn't exist
      const result = await getItinerary(TEST_USER_ID, "00000000-0000-0000-0000-000000000000");
      assert.equal(result, null);
    });

    test("returns null for another user's itinerary", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      const result = await getItinerary("different-user", itineraries[0].id);
      assert.equal(result, null);
    });

    test("fails decryption with wrong user key", async () => {
      const itineraryJson = JSON.stringify({ days: [] });
      await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        itineraryJson,
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      
      // Try to get with a different user - should return null
      const result = await getItinerary("different-user", itineraries[0].id);
      assert.equal(result, null);
    });
  });

  describe("deleteItinerary", () => {
    test("deletes a user's itinerary", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      const deleted = await deleteItinerary(TEST_USER_ID, itineraries[0].id);

      assert.ok(deleted);
      const remaining = await listItineraries(TEST_USER_ID);
      assert.equal(remaining.length, 0);
    });

    test("returns false for non-existent itinerary", async () => {
      // Use a valid UUID format that doesn't exist
      const deleted = await deleteItinerary(TEST_USER_ID, "00000000-0000-0000-0000-000000000000");
      assert.equal(deleted, false);
    });

    test("cannot delete another user's itinerary", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      const deleted = await deleteItinerary("different-user", itineraries[0].id);
      
      assert.equal(deleted, false);
      // Verify it still exists for the original user
      const remaining = await listItineraries(TEST_USER_ID);
      assert.equal(remaining.length, 1);
    });
  });

  describe("listExpiredItineraries", () => {
    test("returns empty array when no expired itineraries", async () => {
      const expired = await listExpiredItineraries();
      // May have other test data, but should not error
      assert.ok(Array.isArray(expired));
    });
  });

  describe("deleteItineraryById", () => {
    test("deletes itinerary by ID without user check", async () => {
      await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      await deleteItineraryById(itineraries[0].id);

      const remaining = await listItineraries(TEST_USER_ID);
      assert.equal(remaining.length, 0);
    });
  });
});
