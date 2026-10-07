import { useState } from "react";
import { useItineraryStream } from "./useItineraryStream";
import { useUserDocuments } from "./useUserDocuments";
import tripmindIcon from "./assets/icon.svg";
import "./App.css";
import { AuthButton } from "./LoginButton";
import { ImageUploader } from "./ImageUploader";
import { DocumentUploadButton } from "./DocumentUploadButton";

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

type View = "itinerary" | "documents";

function App() {
  const [prompt, setPrompt] = useState(
    "3 días en Lisboa, ritmo relajado, comida y arquitectura"
  );
  const [currentView, setCurrentView] = useState<View>("itinerary");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { days, loading: itineraryLoading, error: itineraryError, outcome, generate } = useItineraryStream();
  const { documents, loading: documentsLoading, error: documentsError, fetchDocuments, deleteDocument } = useUserDocuments();

  const handleUploadSuccess = () => {
    fetchDocuments();
  };

  const handleDeleteClick = (docId: string) => {
    setDocumentToDelete(docId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (documentToDelete) {
      setDeletingId(documentToDelete);
      setShowDeleteConfirm(false);
      const success = await deleteDocument(documentToDelete);
      setDeletingId(null);
      setDocumentToDelete(null);
      // If there's an error, it will be shown via the documentsError state
    }
  };

  const handleCancelDelete = () => {
    setDocumentToDelete(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-text">
          <div className="app__brand">
            <img src={tripmindIcon} alt="" className="app__icon" />
            <h1>TripMind</h1>
          </div>
          {currentView === "itinerary" ? (
            <p>Describí el viaje que tenés en mente y armamos el itinerario día por día.</p>
          ) : (
            <p>Subí y gestioná tus documentos personales para el RAG privado.</p>
          )}
        </div>
        <div className="app__auth">
          <AuthButton />
        </div>
      </header>

      <nav className="app__nav">
        <button
          className={`app__nav-button ${currentView === "itinerary" ? "app__nav-button--active" : ""}`}
          onClick={() => setCurrentView("itinerary")}
        >
          Itinerario
        </button>
        <button
          className={`app__nav-button ${currentView === "documents" ? "app__nav-button--active" : ""}`}
          onClick={() => setCurrentView("documents")}
        >
          Mis Documentos
        </button>
      </nav>

      {currentView === "itinerary" ? (
        <>
          <ImageUploader onPlaceConfirmed={(texto) => setPrompt(texto)} />

          <div className="prompt-box">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
            <button onClick={() => generate(prompt)} disabled={itineraryLoading}>
              {itineraryLoading ? "Armando el itinerario…" : "Generar itinerario"}
            </button>
          </div>

          {itineraryError && <div className="error-banner">{itineraryError}</div>}

          {!itineraryLoading && outcome && (
            <div className={`outcome-banner outcome-banner--${outcome.status}`}>
              {OUTCOME_LABEL[outcome.status]}
              {outcome.status !== "failed" &&
                ` — ${outcome.emittedDays}${
                  outcome.totalDaysEsperados ? ` de ${outcome.totalDaysEsperados}` : ""
                } días`}
            </div>
          )}

          {!itineraryLoading && !itineraryError && days.length === 0 && (
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
        </>
      ) : (
        <>
          <div className="documents-header">
            <DocumentUploadButton onUploadSuccess={handleUploadSuccess} />
          </div>

          <div className="privacy-message">
            <strong>Privacidad:</strong> Los documentos se guardan por 30 días y pueden ser borrados manualmente. El texto se envía a Gemini para generar el itinerario.
          </div>

          {documentsError && <div className="error-banner">{documentsError}</div>}

          {documentsLoading ? (
            <div className="empty-state">Cargando documentos…</div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              No tenés documentos subidos. Usá el botón "Subir Documento" para agregar tus archivos .txt, .pdf o .md.
            </div>
          ) : (
            <div className="documents-list">
              <h3>Tus documentos</h3>
              <ul className="documents-list__items">
                {documents.map((doc) => (
                  <li key={doc.id} className="documents-list__item">
                    <div className="documents-list__item-info">
                      <span className="documents-list__item-filename">{doc.filename}</span>
                      <span className="documents-list__item-status">{doc.status}</span>
                      <span className="documents-list__item-chunks">{doc.chunkCount} fragmentos</span>
                      <span className="documents-list__item-date">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                      <span className="documents-list__item-expires">
                        Expira: {new Date(doc.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="documents-list__item-actions">
                      <button 
                        className="documents-list__item-delete"
                        onClick={() => handleDeleteClick(doc.id)}
                        disabled={deletingId === doc.id || documentsLoading}
                        title="Eliminar documento"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {showDeleteConfirm && (
        <div className="confirmation-dialog">
          <div className="confirmation-dialog__content">
            <h3>¿Estás seguro de que quieres eliminar este documento?</h3>
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
       <footer className="app__footer">
        <a href="https://federicorufrancosportfolio.web.app/" target="_blank" rel="noopener noreferrer">
          Portfolio
        </a>
        <span aria-hidden="true">·</span>
        <a href="mailto:fde.ruf@gmail.com">fde.ruf@gmail.com</a>
      </footer>
    </div>
  );
}

export default App;