// routes/itinerary.ts
import dotenv from "dotenv";
dotenv.config();

import { Router, Request, Response } from "express";
import { streamItinerary } from "../services/itinerary";
import { tryParsePartialItinerary } from "../utils/partialJson";
import { sendEventFunction } from "../utils/sendEvent";
import { Day, DaySchema } from "../schemas/itinerarySchema.zod";
import { computeFinalOutcome } from "../rag/computefinaloutcome";
import { checkJwt } from "../middleware/auth";
import { updateUserMemory } from "../services/memoryUpdater";


const router = Router();

function isDayValid(day: unknown): day is Day {
  return DaySchema.safeParse(day).success;
}

// Límite generoso para un pedido de viaje en lenguaje natural.
// Corta el gasto antes de que el prompt llegue siquiera al LLM.
const MAX_PROMPT_CHARS = 2000;

router.post("/stream", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const { prompt } = req.body;

  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "El campo 'prompt' es requerido y debe ser texto." });
    return;
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(400).json({
      error: `El prompt es demasiado largo (${prompt.length} caracteres, máximo ${MAX_PROMPT_CHARS}).`,
    });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = sendEventFunction(res);

  try {
    const { stream: result, memoria } = await streamItinerary(prompt, userId);

    let fullText = "";
    let daysEmitidos = 0;
    let lastParsedDays: any[] = [];

    for await (const chunk of result) {
      const text = chunk.text ?? "";
      fullText += text;

      const parsed = tryParsePartialItinerary(fullText);

      if (parsed?.days) {
        for (let i = daysEmitidos; i < parsed.days.length; i++) {
          const dia = parsed.days[i];
          const hayDiaSiguiente = i < parsed.days.length - 1;
          const esCompleto = isDayValid(dia);
          const eraIgualAntes =
            lastParsedDays[i] !== undefined &&
            JSON.stringify(lastParsedDays[i]) === JSON.stringify(dia);

          if (esCompleto && (hayDiaSiguiente || eraIgualAntes)) {
            sendEvent("day", dia);
            daysEmitidos++;
          }
        }
        lastParsedDays = parsed.days;
      }
    }

    // Al terminar el stream, parseamos la versión final completa
    let parsedFinal: unknown;
    try {
      parsedFinal = JSON.parse(fullText);
    } catch {
      // Fatal: no hay nada recuperable, ni siquiera sabemos cuántos días
      // "reales" hay. Los días ya emitidos por SSE quedan en pantalla,
      // pero el front tiene que saber que el itinerario NO cerró.
      sendEvent("error", {
        stage: "syntax",
        message: "Respuesta incompleta o inválida del modelo",
        emittedDays: daysEmitidos,
      });
      sendEvent("done", {
        ok: false,
        status: "failed",
        emittedDays: daysEmitidos,
      });
      return;
    }

    // --- Capa 2: estructural, day por day para salvar lo que se pueda ---
    const rawDays = Array.isArray((parsedFinal as any)?.days)
      ? (parsedFinal as any).days
      : [];

    const events = computeFinalOutcome(rawDays, daysEmitidos);

    for (const event of events) {
      sendEvent(event.type, event.payload);
    }
    updateUserMemory(userId, prompt, memoria);
  } catch (err) {
    console.error("Stream error:", err);
    sendEvent("error", {
      stage: "unexpected",
      message: "Error generando el itinerario",
    });
    sendEvent("error", { message: "Error generando el itinerario" });
  } finally {
    res.end();
  }
});

export default router;