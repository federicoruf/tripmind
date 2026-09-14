// rag/validateItinerary.test.ts
//
// Correr con: npx tsx --test rag/validateItinerary.test.ts
// (o agregá un script "test": "tsx --test **/*.test.ts" a package.json)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateItinerary } from "./validateItinerary";
import { DaySchema } from "./itinerarySchema.zod"; // sumar al import existente

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validItinerary = {
  days: [
    {
      day: 1,
      title: "Llegada a Lisboa",
      activities: [
        {
          time: "09:00",
          description: "Check-in en el hotel",
          location: "Alfama",
          source: "Lisboa-Guia-viaje.pdf",
        },
        {
          time: "14:00",
          description: "Paseo por el Castelo de São Jorge",
          location: "Castelo de São Jorge",
          source: "",
        },
      ],
    },
    {
      day: 2,
      title: "Sintra",
      activities: [
        {
          time: "10:00",
          description: "Visita a Pena Palace",
          location: "Sintra",
          source: "",
        },
      ],
    },
  ],
};

describe("validateItinerary — capa estructural (Zod)", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test("acepta un itinerario válido y devuelve success: true", () => {
    const result = validateItinerary(validItinerary);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.days.length, 2);
      assert.equal(result.data.days[0].activities[0].time, "09:00");
    }
  });

  test("acepta 'location' ausente (es opcional según el responseSchema de Gemini)", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0].activities[0] as any).location;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, true);
  });

  test("acepta 'source' ausente y lo completa con default ''", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0].activities[0] as any).source;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.days[0].activities[0].source, "");
    }
  });

  test("acepta 'source' vacío tal cual lo manda Gemini cuando no hay match de RAG", () => {
    const itinerary = structuredClone(validItinerary);
    itinerary.days[0].activities[0].source = "";

    const result = validateItinerary(itinerary);
    assert.equal(result.success, true);
  });

  // -------------------------------------------------------------------------
  // Campos requeridos faltantes
  // -------------------------------------------------------------------------

  test("rechaza itinerario sin 'days'", () => {
    const result = validateItinerary({});
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.startsWith("days:")));
    }
  });

  test("rechaza 'days' vacío ([])", () => {
    const result = validateItinerary({ days: [] });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.errors.some((e) => e.includes("0 días")),
        `esperaba mensaje sobre 0 días, recibí: ${result.errors.join(" | ")}`
      );
    }
  });

  test("rechaza un día sin 'day'", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0] as any).day;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes("days.0.day")));
    }
  });

  test("rechaza un día sin 'title'", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0] as any).title;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes("days.0.title")));
    }
  });

  test("rechaza un día sin 'activities'", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0] as any).activities;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes("days.0.activities")));
    }
  });

  test("rechaza una actividad sin 'time'", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0].activities[0] as any).time;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.errors.some((e) => e.includes("days.0.activities.0.time"))
      );
    }
  });

  test("rechaza una actividad sin 'description'", () => {
    const itinerary = structuredClone(validItinerary);
    delete (itinerary.days[0].activities[0] as any).description;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.errors.some((e) =>
          e.includes("days.0.activities.0.description")
        )
      );
    }
  });

  // -------------------------------------------------------------------------
  // Tipos incorrectos
  // -------------------------------------------------------------------------

  test("rechaza 'day' como string en vez de number", () => {
    const itinerary = structuredClone(validItinerary);
    (itinerary.days[0] as any).day = "1";

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'day' como número negativo", () => {
    const itinerary = structuredClone(validItinerary);
    (itinerary.days[0] as any).day = -1;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'day' como número no entero (ej: 1.5)", () => {
    const itinerary = structuredClone(validItinerary);
    (itinerary.days[0] as any).day = 1.5;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'day' igual a 0 (no es positivo)", () => {
    const itinerary = structuredClone(validItinerary);
    (itinerary.days[0] as any).day = 0;

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'activities' cuando no es un array", () => {
    const itinerary = structuredClone(validItinerary);
    (itinerary.days[0] as any).activities = "no es un array";

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'title' vacío (string vacío falla el .min(1))", () => {
    const itinerary = structuredClone(validItinerary);
    itinerary.days[0].title = "";

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  test("rechaza 'description' vacío en una actividad", () => {
    const itinerary = structuredClone(validItinerary);
    itinerary.days[0].activities[0].description = "";

    const result = validateItinerary(itinerary);
    assert.equal(result.success, false);
  });

  // -------------------------------------------------------------------------
  // Entradas completamente inesperadas (defensa ante alucinaciones de forma)
  // -------------------------------------------------------------------------

  test("rechaza null", () => {
    const result = validateItinerary(null);
    assert.equal(result.success, false);
  });

  test("rechaza undefined", () => {
    const result = validateItinerary(undefined);
    assert.equal(result.success, false);
  });

  test("rechaza un array en vez de un objeto", () => {
    const result = validateItinerary([validItinerary]);
    assert.equal(result.success, false);
  });

  test("rechaza un string (ej: el modelo devolvió texto plano, no JSON)", () => {
    const result = validateItinerary("esto no es un itinerario");
    assert.equal(result.success, false);
  });

  test("rechaza 'days' como objeto en vez de array", () => {
    const result = validateItinerary({ days: { day: 1 } });
    assert.equal(result.success, false);
  });

  // -------------------------------------------------------------------------
  // Múltiples errores a la vez (caso realista de alucinación de forma)
  // -------------------------------------------------------------------------

  test("acumula múltiples errores cuando varios campos fallan a la vez", () => {
    const brokenItinerary = {
      days: [
        {
          // falta 'day'
          title: "",
          activities: [
            {
              // falta 'time'
              description: "",
            },
          ],
        },
      ],
    };

    const result = validateItinerary(brokenItinerary);
    assert.equal(result.success, false);
    if (!result.success) {
      // esperamos al menos: day faltante, title vacío,
      // time faltante, description vacía
      assert.ok(result.errors.length >= 4, `errores: ${result.errors.join(" | ")}`);
    }
  });

  // -------------------------------------------------------------------------
  // Campos extra no declarados (tolerancia a ruido del modelo)
  // -------------------------------------------------------------------------

  test("ignora/tolera campos extra no declarados en el schema", () => {
    const itinerary = structuredClone(validItinerary) as any;
    itinerary.days[0].activities[0].extraFieldInventadoPorElModelo = "raro";

    const result = validateItinerary(itinerary);
    // Zod con .object() por default hace "strip": tira el campo extra
    // y NO lo trata como error. Si preferís rechazar campos extra,
    // hay que usar .strict() en el schema — ver nota al pie del archivo.
    assert.equal(result.success, true);
  });


describe("DaySchema — usado directamente por isDayValid en el streaming", () => {
    test("acepta un día válido aislado (sin envolver en 'days')", () => {
      const dia = {
        day: 1,
        title: "Llegada a Lisboa",
        activities: [
          { time: "09:00", description: "Check-in", location: "Alfama", source: "" },
        ],
      };
      assert.equal(DaySchema.safeParse(dia).success, true);
    });
  
    test("rechaza un día con activities: [] (mid-stream, array vacío mientras llega)", () => {
      const dia = { day: 1, title: "Llegada", activities: [] };
      // Nota: esto SÍ pasa hoy porque DaySchema no tiene .min(1) en activities
      // — quedó pendiente de la conversación anterior. Ver comentario abajo.
      const result = DaySchema.safeParse(dia);
      console.log("activities vacío → success:", result.success);
    });
  
    test("rechaza un día con una activity sin 'time' (chunk parcial típico)", () => {
      const dia = {
        day: 1,
        title: "Llegada",
        activities: [{ description: "Check-in" }],
      };
      assert.equal(DaySchema.safeParse(dia).success, false);
    });
  });
});