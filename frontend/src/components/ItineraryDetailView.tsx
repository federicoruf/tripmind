import { useState, useEffect, useCallback } from "react";
import { type ItineraryHistoryDetail } from "../hooks/useItineraryHistory";

interface ItineraryDetailViewProps {
  itineraryId: string;
  onBack: () => void;
  onDelete: (id: string) => void;
  getItinerary: (id: string) => Promise<ItineraryHistoryDetail | null>;
  deletingId: string | null;
}

export function ItineraryDetailView({
  itineraryId,
  onBack,
  onDelete,
  getItinerary,
  deletingId,
}: ItineraryDetailViewProps) {
  const [itinerary, setItinerary] = useState<ItineraryHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItinerary() {
      setLoading(true);
      setError(null);
      try {
        const data = await getItinerary(itineraryId);
        if (data) {
          setItinerary(data);
        } else {
          setError("Itinerario no encontrado.");
        }
      } catch (err) {
        setError("Error al cargar el itinerario.");
      } finally {
        setLoading(false);
      }
    }
    loadItinerary();
  }, [itineraryId, getItinerary]);

  if (loading) {
    return (
      <div className="itinerary-detail">
        <div className="itinerary-detail__header">
          <button className="itinerary-detail__back" onClick={onBack}>
            ← Volver al listado
          </button>
        </div>
        <div className="empty-state">Cargando itinerario...</div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="itinerary-detail">
        <div className="itinerary-detail__header">
          <button className="itinerary-detail__back" onClick={onBack}>
            ← Volver al listado
          </button>
        </div>
        <div className="error-banner">{error || "Itinerario no encontrado."}</div>
      </div>
    );
  }

  return (
    <div className="itinerary-detail">
      <div className="itinerary-detail__header">
        <button className="itinerary-detail__back" onClick={onBack}>
          ← Volver al listado
        </button>
        <button
          className="itinerary-detail__delete"
          onClick={() => onDelete(itinerary.id)}
          disabled={deletingId === itinerary.id}
        >
          {deletingId === itinerary.id ? "Eliminando..." : "🗑️ Eliminar"}
        </button>
      </div>

      <div className="itinerary-detail__prompt">
        <strong>Prompt:</strong> {itinerary.prompt}
      </div>
      <div className="itinerary-detail__summary" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
        <strong>Resumen:</strong> {itinerary.summary}
      </div>
      <div className="itinerary-detail__meta">
        Creado: {new Date(itinerary.createdAt).toLocaleDateString()}
      </div>

      <div className="itinerary-detail__content">
        <h3>Itinerario</h3>
        {itinerary.itinerary && itinerary.itinerary.days && (
          <>
            {itinerary.itinerary.days.map((day: any, index: number) => (
              <section className="day" key={day.day || index}>
                <h2 className="day__title">
                  <span className="day__number">Día {day.day || index + 1}</span>
                  {day.title}
                </h2>
                <div className="timeline">
                  {day.activities && day.activities.map((act: any, i: number) => (
                    <div className="activity" key={i}>
                      <div className="activity__time">{act.time}</div>
                      <p className="activity__desc">{act.description}</p>
                      {act.location && (
                        <div className="activity__meta">
                          <span className="activity__location">{act.location}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
