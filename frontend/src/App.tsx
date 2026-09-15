import { useState } from "react";
import { useItineraryStream } from "./useItineraryStream";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState(
    "3 días en Lisboa, ritmo relajado, comida y arquitectura"
  );
  const { days, loading, error, generate } = useItineraryStream();

  return (
    <div className="app">
      <header className="app__header">
        <h1>TripMind</h1>
        <p>Describí el viaje que tenés en mente y armamos el itinerario día por día.</p>
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
            {day.activities.map((act, i) => (
              <div className="activity" key={i}>
                <div className="activity__time">{act.time}</div>
                <p className="activity__desc">{act.description}</p>
                <div className="activity__location">{act.location}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default App;