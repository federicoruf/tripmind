import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { Auth0Context } from "@auth0/auth0-react";

let server, dom, render, screen, fireEvent, waitFor, cleanup, ItineraryCard, ItineraryHistory;
const originalFetch = globalThis.fetch;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  ({ render, screen, fireEvent, waitFor, cleanup } = await import("@testing-library/react"));
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  ({ ItineraryCard } = await server.ssrLoadModule("/src/components/ItineraryCard.tsx"));
  ({ ItineraryHistory } = await server.ssrLoadModule("/src/components/ItineraryHistory.tsx"));
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

after(async () => {
  await server?.close();
  dom?.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
});

describe("itinerary card interactions", () => {
  for (const [name, itinerary] of [
    ["fallback", null],
    ["structured", { days: [{ day: 1, title: "Day", activities: [] }] }],
  ]) {
    it(`${name} card handles keyboard activation and isolates delete`, () => {
      let opened = 0;
      let deleted = 0;
      render(React.createElement(ItineraryCard, {
        id: "1", prompt: "Trip", summary: "* **Destino:** Rome", itinerary,
        createdAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z",
        onClick: () => opened++, onDelete: () => deleted++, deletingId: null,
      }));
      const card = screen.getByRole("button", { name: /^Itinerario: Trip/ });
      const deleteButton = screen.getByRole("button", { name: "Eliminar itinerario: Trip" });
      assert.equal(card.tabIndex, 0);
      fireEvent.keyDown(card, { key: "Enter" });
      fireEvent.keyDown(card, { key: " " });
      assert.equal(opened, 2);
      fireEvent.keyDown(deleteButton, { key: "Enter" });
      fireEvent.keyDown(deleteButton, { key: " " });
      fireEvent.click(deleteButton);
      assert.equal(deleted, 1);
      assert.equal(opened, 2);
      if (name === "fallback") {
        fireEvent.click(card.querySelector(".itinerary-history__item-content"));
        assert.equal(opened, 2);
        fireEvent.click(card);
        assert.equal(opened, 3);
      }
    });
  }
});

it("keeps preview failures silent and reports detail network failures", async () => {
  const item = { id: "1", prompt: "Trip", summary: "* **Destino:** Rome", createdAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" };
  let detailRequests = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/history")) return { ok: true, json: async () => ({ itineraries: [item] }) };
    detailRequests++;
    throw new Error("network failure");
  };
  const auth = { isAuthenticated: true, getAccessTokenSilently: async () => "token" };
  render(React.createElement(Auth0Context.Provider, { value: auth }, React.createElement(ItineraryHistory)));
  const card = await screen.findByRole("button", { name: /^Itinerario: Trip/ });
  await waitFor(() => assert.equal(detailRequests, 1));
  assert.equal(screen.queryByText("Error de conexión al obtener el itinerario."), null);
  fireEvent.keyDown(card, { key: "Enter" });
  await screen.findByText("Error al cargar el itinerario.");
  assert.equal(detailRequests, 2);
  fireEvent.click(screen.getByRole("button", { name: /Volver al listado/ }));
  await screen.findByText("Error de conexión al obtener el itinerario.");
});
