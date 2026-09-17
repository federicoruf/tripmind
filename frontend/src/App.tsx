import { useState } from "react";
import { useItineraryStream } from "./useItineraryStream";
import tripmindIcon from "./assets/icon.svg";
import "./App.css";
import { AuthButton } from "./LoginButton";

// Traduce el campo "source" que arma el LLM a una etiqueta legible.
// Ver system prompt en backend/src/services/itinerary.ts para las
// convenciones: "Fragmento N" (RAG), "get_weather"/"get_places" (tools),
// o vacío (conocimiento general del modelo, sin verificar).
function sourceLabel(source?: string): string | null {
  if (!source) return null;
  if (source === "get_weather") return "Clima verificado";
  if (source === "get_places") return "Lugar verificado";
  if (/^fragmento/i.test(source)) return `Guía de viaje · ${source}`;
  return source;
}

const OUTCOME_LABEL: Record<string, string> = {
  complete: "Itinerario completo",
  partial: "Itinerario generado parcialmente",
  failed: "No se pudo generar el itinerario",
};

function App() {
  const [prompt, setPrompt] = useState(
    "3 días en Lisboa, ritmo relajado, comida y arquitectura"
  );
  const { days, loading, error, outcome, generate } = useItineraryStream();

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <img src={tripmindIcon} alt="" className="app__icon" />
          <h1>TripMind</h1>
        </div>
        <p>Describí el viaje que tenés en mente y armamos el itinerario día por día.</p>
        <AuthButton />
      </header>

      <div className="prompt-box">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <button onClick={() => generate(prompt)} disabled={loading}>
          {loading ? "Armando el itinerario…" : "Generar itinerario"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!loading && outcome && (
        <div className={`outcome-banner outcome-banner--${outcome.status}`}>
          {OUTCOME_LABEL[outcome.status]}
          {outcome.status !== "failed" &&
            ` — ${outcome.emittedDays}${
              outcome.totalDaysEsperados ? ` de ${outcome.totalDaysEsperados}` : ""
            } días`}
        </div>
      )}

      {!loading && !error && days.length === 0 && (
        <div className="empty-state">
          Todavía no generaste ningún itinerario. Escribí tu viaje arriba y tocá "Generar".
        </div>
      )}

      {days.map((day) => (
        <section className="day" key={day.day}>
          <h2 className="day__title">
            <span className="day__number">Día {day.day}</span>
            {day.title}
          </h2>
          <div className="timeline">
            {day.activities.map((act, i) => {
              const label = sourceLabel(act.source);
              return (
                <div className="activity" key={i}>
                  <div className="activity__time">{act.time}</div>
                  <p className="activity__desc">{act.description}</p>
                  <div className="activity__meta">
                    {act.location && (
                      <span className="activity__location">{act.location}</span>
                    )}
                    {label && <span className="activity__source">{label}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default App;