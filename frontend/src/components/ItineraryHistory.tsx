import { useState, useEffect, useCallback } from "react";
import { useItineraryHistory, type ItineraryHistoryDetail } from "../hooks/useItineraryHistory";
import { ItineraryHistoryList } from "./ItineraryHistoryList";
import { ItineraryDetailView } from "./ItineraryDetailView";

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

  // Show detail view
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

  // Show list view
  return (
    <div className="itinerary-history">
      <div className="itinerary-history__header">
        <h2>Historial de Itinerarios</h2>
        <div className="itinerary-history__notice">
          Guardado por 30 días, máximo 10 itinerarios
        </div>
      </div>

      <ItineraryHistoryList
        itineraries={itineraries}
        getItinerary={getItinerary}
        onViewItinerary={handleViewItinerary}
        onDelete={handleDeleteClick}
        deletingId={deletingId}
        isMobile={isMobile}
      />

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
