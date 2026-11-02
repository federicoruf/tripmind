import { useState, useEffect, useCallback } from "react";
import { useItineraryHistory, type ItineraryHistoryDetail } from "../hooks/useItineraryHistory";
import { ItineraryCard } from "./ItineraryCard";

interface ItineraryHistoryProps {
  onClose?: () => void;
}

type View = "list" | "detail";

export function ItineraryHistory({ onClose }: ItineraryHistoryProps) {
  const [currentView, setCurrentView] = useState<View>("list");
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itineraryToDelete, setItineraryToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const {
    itineraries,
    loading,
    error,
    fetchItineraries,
    getItinerary,
    deleteItinerary,
  } = useItineraryHistory();

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleViewItinerary = useCallback((id: string) => {
    setSelectedItineraryId(id);
    setCurrentView("detail");
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedItineraryId(null);
    setCurrentView("list");
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setItineraryToDelete(id);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (itineraryToDelete) {
      setDeletingId(itineraryToDelete);
      setShowDeleteConfirm(false);
      const success = await deleteItinerary(itineraryToDelete);
      setDeletingId(null);
      setItineraryToDelete(null);
      if (success && selectedItineraryId === itineraryToDelete) {
        handleBackToList();
      }
    }
  }, [itineraryToDelete, selectedItineraryId, deleteItinerary, handleBackToList]);

  const handleCancelDelete = useCallback(() => {
    setItineraryToDelete(null);
    setShowDeleteConfirm(false);
  }, []);

  // Calculate days left for expiration
  const getDaysLeft = (expiresAt: string): number => {
    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiresDate.getTime() - now.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  if (currentView === "detail" && selectedItineraryId) {
    return (
      <ItineraryDetailView
        itineraryId={selectedItineraryId}
        onBack={handleBackToList}
        onDelete={handleDeleteClick}
        getItinerary={getItinerary}
        deletingId={deletingId}
      />
    );
  }

  // Show loading state while fetching list
  if (loading) {
    return (
      <div className="itinerary-history">
        <div className="itinerary-history__header">
          <h2>Historial de Itinerarios</h2>
          <div className="itinerary-history__notice">
            Guardado por 30 días, máximo 10 itinerarios
          </div>
        </div>
        <div className="empty-state">Cargando historial…</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="itinerary-history">
        <div className="itinerary-history__header">
          <h2>Historial de Itinerarios</h2>
          <div className="itinerary-history__notice">
            Guardado por 30 días, máximo 10 itinerarios
          </div>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  // Show empty state
  if (itineraries.length === 0) {
    return (
      <div className="itinerary-history">
        <div className="itinerary-history__header">
          <h2>Historial de Itinerarios</h2>
          <div className="itinerary-history__notice">
            Guardado por 30 días, máximo 10 itinerarios
          </div>
        </div>
        <div className="empty-state">
          No tenés itinerarios guardados. Generá uno y aparecerá acá.
        </div>
      </div>
    );
  }

  // Render itinerary cards with structured previews
  return (
    <div className="itinerary-history">
      <div className="itinerary-history__header">
        <h2>Historial de Itinerarios</h2>
        <div className="itinerary-history__notice">
            Guardado por 30 días, máximo 10 itinerarios
        </div>
      </div>

      <div className="itinerary-history__list">
        <ul className="itinerary-history__items">
          {itineraries.map((itinerary) => (
            <ItineraryCard
              key={itinerary.id}
              id={itinerary.id}
              prompt={itinerary.prompt}
              summary={itinerary.summary}
              itinerary={null}
              createdAt={itinerary.createdAt}
              expiresAt={itinerary.expiresAt}
              onClick={() => handleViewItinerary(itinerary.id)}
              onDelete={(e) => {
                e.stopPropagation();
                handleDeleteClick(itinerary.id);
              }}
              deletingId={deletingId}
              isMobile={isMobile}
            />
          ))}
        </ul>
      </div>

      {showDeleteConfirm && (
        <div className="confirmation-dialog">
          <div className="confirmation-dialog__content">
            <h3>¿Estás seguro de que quieres eliminar este itinerario?</h3>
            <p>Esta acción no se puede deshacer.</p>
            <div className="confirmation-dialog__actions">
              <button
                className="confirmation-dialog__cancel"
                onClick={handleCancelDelete}
              >
                Cancelar
              </button>
              <button
                className="confirmation-dialog__confirm"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para ver el detalle de un itinerario
interface ItineraryDetailViewProps {
  itineraryId: string;
  onBack: () => void;
  onDelete: (id: string) => void;
  getItinerary: (id: string) => Promise<any | null>;
  deletingId: string | null;
}

function ItineraryDetailView({
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
