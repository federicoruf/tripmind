// routes/itinerary.ts
import dotenv from "dotenv";
dotenv.config();

import { Router, Request, Response } from "express";
import { runOrchestratedItinerary } from "../orchestrator/graph";
import { sendEventFunction } from "../utils/sendEvent";
import { computeFinalOutcome } from "../rag/computefinaloutcome";
import { checkJwt } from "../middleware/auth";
import { logStep, logError, previewTexto } from "../utils/logger";


const router = Router();

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

  logStep("route:itinerary", "Petición recibida", {
    userId,
    prompt: previewTexto(prompt),
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = sendEventFunction(res);

  try {
    // El grafo corre de punta a punta (planificador ⇄ validador, con
    // reintentos) ANTES de emitir nada por SSE — se decidió no mostrar
    // intentos intermedios/rechazados, solo el itinerario final. La
    // memoria del usuario ya se actualiza adentro de runOrchestratedItinerary.
    const resultado = await runOrchestratedItinerary(prompt, userId);

    logStep("route:itinerary", "Orquestador finalizó", {
      intentos: resultado.intentos,
      valido: resultado.validacionFinal?.valido ?? null,
      dias: resultado.itinerary.length,
    });

    // Reusa la misma lógica de decisión que antes usaba el tramo final del
    // streaming: día por día, valida contra el schema, arma "day" events.
    // daysEmitidosInicial=0 porque acá no hubo nada emitido todavía.
    const events = computeFinalOutcome(resultado.itinerary, 0);
    const doneEvent = events.find((event) => event.type === "done");
    const otrosEventos = events.filter((event) => event.type !== "done");

    logStep("route:itinerary", "Emitiendo eventos SSE", {
      cantidad: otrosEventos.length,
    });

    for (const event of otrosEventos) {
      sendEvent(event.type, event.payload);
    }

    // Si se agotaron los reintentos sin que el validador diera el OK
    // semántico, el itinerario ya se armó y es estructuralmente válido
    // (por eso sí se muestra), pero avisamos al usuario del motivo del
    // rechazo en vez de mostrarlo como un resultado sin observaciones.
    if (resultado.entregadoSinValidarCompleto) {
      logStep("route:itinerary", "Itinerario entregado sin validación semántica completa", {
        motivos: resultado.validacionFinal?.motivos ?? [],
      });
      sendEvent("error", {
        stage: "validation",
        message:
          "El itinerario no pasó completamente la revisión de calidad tras los reintentos disponibles.",
        motivos: resultado.validacionFinal?.motivos ?? [],
        emittedDays: resultado.itinerary.length,
      });
    }

    if (doneEvent) {
      const status = resultado.entregadoSinValidarCompleto
        ? ("partial" as const)
        : doneEvent.payload.status;
      sendEvent("done", {
        ...doneEvent.payload,
        status,
        ok: status === "complete",
      });
    }

    logStep("route:itinerary", "Petición completada");
  } catch (err) {
    logError("route:itinerary", "Error generando el itinerario", err);
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