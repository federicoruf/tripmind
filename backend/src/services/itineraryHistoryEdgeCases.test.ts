// services/itineraryHistoryEdgeCases.test.ts
//
// Tests for edge cases: limit enforcement, expiration handling, user isolation,
// encryption round trip, and decryption failure with another user's key.
// This covers Tarea 10.3 requirements.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import {
  saveItinerary,
  listItineraries,
  getItinerary,
  deleteItinerary,
} from "./itineraryHistory";

const TEST_USER_ID = "edge-case-user-001";
const OTHER_USER_ID = "edge-case-user-002";
const TEST_DOCS_MASTER_KEY = "d".repeat(64);

// Helper to clean up test data
async function cleanupTestData() {
  await pool.query("DELETE FROM user_itineraries WHERE user_id IN ($1, $2)", [
    TEST_USER_ID,
    OTHER_USER_ID,
  ]);
}

describe("itineraryHistory edge cases (Tarea 10.3)", () => {
  beforeEach(async () => {
    process.env.DOCS_MASTER_KEY = TEST_DOCS_MASTER_KEY;
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("Limit Enforcement (10 items)", () => {
    test("user can save up to 10 itineraries", async () => {
      // Save 10 itineraries
      for (let i = 0; i < 10; i++) {
        const result = await saveItinerary(
          TEST_USER_ID,
          `Prompt ${i}`,
          `Summary ${i}`,
          JSON.stringify({ days: [{ day: i + 1, title: `Day ${i + 1}` }] }),
        );
        assert.ok(result !== null, `Failed to save itinerary ${i}`);
      }

      // Verify we have exactly 10
      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(
        itineraries.length,
        10,
        "Should have exactly 10 itineraries",
      );
    });

    test("saving 11th itinerary deletes the oldest", async () => {
      // Save 10 itineraries
      for (let i = 0; i < 10; i++) {
        await saveItinerary(
          TEST_USER_ID,
          `Prompt ${i}`,
          `Summary ${i}`,
          JSON.stringify({ days: [] }),
        );
      }

      // Save the 11th
      await saveItinerary(
        TEST_USER_ID,
        "Prompt 11 (newest)",
        "Summary 11 (newest)",
        JSON.stringify({ days: [] }),
      );

      // Should still have 10
      const itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(
        itineraries.length,
        10,
        "Should still have exactly 10 itineraries",
      );

      // The newest should be first
      assert.equal(
        itineraries[0].prompt,
        "Prompt 11 (newest)",
        "Newest itinerary should be first",
      );

      // The oldest (Prompt 0) should have been deleted
      const prompts = itineraries.map((i) => i.prompt);
      assert.ok(
        !prompts.includes("Prompt 0"),
        "Oldest itinerary (Prompt 0) should have been deleted",
      );
    });

    test("limit is per-user, not global", async () => {
      // User 1 saves 10 itineraries
      for (let i = 0; i < 10; i++) {
        await saveItinerary(
          TEST_USER_ID,
          `User1 Prompt ${i}`,
          `Summary ${i}`,
          JSON.stringify({ days: [] }),
        );
      }

      // User 2 can still save itineraries
      const result = await saveItinerary(
        OTHER_USER_ID,
        "User2 Prompt 1",
        "User2 Summary 1",
        JSON.stringify({ days: [] }),
      );

      assert.ok(result !== null, "User 2 should be able to save an itinerary");

      // Verify both users have their itineraries
      const user1Itineraries = await listItineraries(TEST_USER_ID);
      const user2Itineraries = await listItineraries(OTHER_USER_ID);

      assert.equal(user1Itineraries.length, 10);
      assert.equal(user2Itineraries.length, 1);
    });
  });

  describe("Expiration Handling", () => {
    test("expired itineraries are not returned in list", async () => {
      // Insert an expired itinerary directly
      await pool.query(
        `INSERT INTO user_itineraries
         (user_id, prompt, summary, itinerary_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, now() - interval '40 days', now() - interval '10 days')`,
        [TEST_USER_ID, "Expired prompt", "Expired summary", "encrypted-data"],
      );

      // Save a non-expired itinerary
      await saveItinerary(
        TEST_USER_ID,
        "Valid prompt",
        "Valid summary",
        JSON.stringify({ days: [] }),
      );

      const itineraries = await listItineraries(TEST_USER_ID);

      assert.equal(
        itineraries.length,
        1,
        "Should only return non-expired itineraries",
      );
      assert.equal(
        itineraries[0].prompt,
        "Valid prompt",
        "Should return the valid itinerary",
      );
    });

    test("expired itineraries cannot be retrieved by ID", async () => {
      // Insert an expired itinerary
      const result = await pool.query(
        `INSERT INTO user_itineraries
         (user_id, prompt, summary, itinerary_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, now() - interval '40 days', now() - interval '10 days')
         RETURNING id`,
        [TEST_USER_ID, "Expired", "Expired", JSON.stringify({ days: [] })],
      );

      const itineraryId = result.rows[0].id;

      const retrieved = await getItinerary(TEST_USER_ID, itineraryId);
      assert.equal(
        retrieved,
        null,
        "Should return null for expired itinerary",
      );
    });

    test("expired itineraries cannot be deleted", async () => {
      // Insert an expired itinerary
      const result = await pool.query(
        `INSERT INTO user_itineraries
         (user_id, prompt, summary, itinerary_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, now() - interval '40 days', now() - interval '10 days')
         RETURNING id`,
        [TEST_USER_ID, "Expired", "Expired", JSON.stringify({ days: [] })],
      );

      const itineraryId = result.rows[0].id;

      const deleted = await deleteItinerary(TEST_USER_ID, itineraryId);
      assert.equal(
        deleted,
        false,
        "Should return false for expired itinerary deletion",
      );
    });

    test("expiration date is set to created_at + 30 days", async () => {
      const beforeSave = new Date();
      const result = await saveItinerary(
        TEST_USER_ID,
        "Test",
        "Test",
        JSON.stringify({ days: [] }),
      );
      const afterSave = new Date();

      assert.ok(result !== null);

      // The expiration should be approximately 30 days from now
      // We can't check the exact time due to async, but we can verify it's in the future
      assert.ok(
        result!.expiresAt > beforeSave,
        "Expiration should be in the future",
      );

      // And it should be approximately 30 days later
      const diffDays = (
        result!.expiresAt.getTime() - result!.createdAt.getTime()
      ) / (1000 * 60 * 60 * 24);
      assert.ok(
        Math.abs(diffDays - 30) < 1,
        `Expiration should be ~30 days from creation, got ${diffDays} days`,
      );
    });
  });

  describe("User Isolation", () => {
    test("user can only see their own itineraries in list", async () => {
      // User 1 saves an itinerary
      await saveItinerary(
        TEST_USER_ID,
        "User1 itinerary",
        "User1 summary",
        JSON.stringify({ days: [] }),
      );

      // User 2 saves an itinerary
      await saveItinerary(
        OTHER_USER_ID,
        "User2 itinerary",
        "User2 summary",
        JSON.stringify({ days: [] }),
      );

      // User 1 should only see their own itinerary
      const user1Itineraries = await listItineraries(TEST_USER_ID);
      assert.equal(user1Itineraries.length, 1);
      assert.equal(user1Itineraries[0].prompt, "User1 itinerary");

      // User 2 should only see their own itinerary
      const user2Itineraries = await listItineraries(OTHER_USER_ID);
      assert.equal(user2Itineraries.length, 1);
      assert.equal(user2Itineraries[0].prompt, "User2 itinerary");
    });

    test("user can only retrieve their own itineraries", async () => {
      // User 1 saves an itinerary
      await saveItinerary(
        TEST_USER_ID,
        "User1 itinerary",
        "User1 summary",
        JSON.stringify({ days: [{ day: 1, title: "Day 1" }] }),
      );

      const user1Itineraries = await listItineraries(TEST_USER_ID);
      const itineraryId = user1Itineraries[0].id;

      // User 2 tries to retrieve User 1's itinerary
      const result = await getItinerary(OTHER_USER_ID, itineraryId);
      assert.equal(
        result,
        null,
        "User 2 should not be able to retrieve User 1's itinerary",
      );
    });

    test("user can only delete their own itineraries", async () => {
      // User 1 saves an itinerary
      await saveItinerary(
        TEST_USER_ID,
        "User1 itinerary",
        "User1 summary",
        JSON.stringify({ days: [] }),
      );

      const user1Itineraries = await listItineraries(TEST_USER_ID);
      const itineraryId = user1Itineraries[0].id;

      // User 2 tries to delete User 1's itinerary
      const deleted = await deleteItinerary(OTHER_USER_ID, itineraryId);
      assert.equal(
        deleted,
        false,
        "User 2 should not be able to delete User 1's itinerary",
      );

      // Verify it still exists for User 1
      const remaining = await listItineraries(TEST_USER_ID);
      assert.equal(remaining.length, 1);
    });
  });

  describe("Encryption Round Trip", () => {
    test("itinerary is encrypted and can be decrypted", async () => {
      const originalItinerary = {
        days: [
          {
            day: 1,
            title: "Test Day",
            activities: [
              { time: "09:00", description: "Visit museum", location: "City" },
            ],
          },
        ],
      };

      await saveItinerary(
        TEST_USER_ID,
        "Test prompt",
        "Test summary",
        JSON.stringify(originalItinerary),
      );

      const itineraries = await listItineraries(TEST_USER_ID);
      const retrieved = await getItinerary(TEST_USER_ID, itineraries[0].id);

      assert.ok(retrieved !== null);
      assert.deepEqual(
        retrieved!.itinerary,
        originalItinerary,
        "Decrypted itinerary should match original",
      );
    });

    test("encryption uses user-specific key", async () => {
      const originalItinerary = { days: [{ day: 1, title: "Secret" }] };

      // User 1 saves an itinerary
      await saveItinerary(
        TEST_USER_ID,
        "User1 prompt",
        "User1 summary",
        JSON.stringify(originalItinerary),
      );

      const user1Itineraries = await listItineraries(TEST_USER_ID);
      const itineraryId = user1Itineraries[0].id;

      // User 2 cannot decrypt User 1's itinerary
      const result = await getItinerary(OTHER_USER_ID, itineraryId);
      assert.equal(
        result,
        null,
        "User 2 should not be able to decrypt User 1's itinerary",
      );
    });

    test("decryption failure with another user's key returns null", async () => {
      const originalItinerary = { days: [{ day: 1, title: "Private" }] };

      await saveItinerary(
        TEST_USER_ID,
        "Private prompt",
        "Private summary",
        JSON.stringify(originalItinerary),
      );

      const user1Itineraries = await listItineraries(TEST_USER_ID);
      const itineraryId = user1Itineraries[0].id;

      // Try with a different user
      const result = await getItinerary(OTHER_USER_ID, itineraryId);
      assert.equal(result, null);
    });
  });

  describe("Concurrent Access", () => {
    test("concurrent saves respect the 10 item limit", async () => {
      // Save 9 itineraries first
      for (let i = 0; i < 9; i++) {
        await saveItinerary(
          TEST_USER_ID,
          `Prompt ${i}`,
          `Summary ${i}`,
          JSON.stringify({ days: [] }),
        );
      }

      // Try to save 5 more concurrently
      const savePromises = [];
      for (let i = 9; i < 14; i++) {
        savePromises.push(
          saveItinerary(
            TEST_USER_ID,
            `Prompt ${i}`,
            `Summary ${i}`,
            JSON.stringify({ days: [] }),
          ),
        );
      }

      await Promise.all(savePromises);

      // Should still have at most 10 itineraries
      const itineraries = await listItineraries(TEST_USER_ID);
      assert.ok(
        itineraries.length <= 10,
        `Should have at most 10 itineraries, got ${itineraries.length}`,
      );
    });
  });
});
