import { useState, useEffect, useCallback } from "react";
import { ItineraryHistoryDetail } from "../hooks/useItineraryHistory";

interface ItineraryCardProps {
  itineraryId: string;
  prompt: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deletingId: string | null;
  getItinerary: (id: string) => Promise<ItineraryHistoryDetail | null>;
  isMobile?: boolean;
}

// Type for the decrypted itinerary structure
export interface ItineraryData {
  days: Array<{
    day: number;
    title: string;
    activities: Array<{
      time: string;
      description: string;
      location?: string;
      source?: string;
    }>;
  }>;
}

// Type for combined props
export interface ItineraryCardCombinedProps {
  id: string;
  prompt: string;
  summary: string;
  itinerary: ItineraryData | null;
  createdAt: string;
  expiresAt: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deletingId: string | null;
  isMobile?: boolean;
}

/**
 * Helper function to clean and format the summary text.
 * Removes the itinerary complete section and formats with line breaks.
 * For the list view, we only show the structured summary part.
 */
export function formatSummary(summary: string): React.ReactElement {
  if (!summary) return <></>;
  
  // Remove everything after (and including) "Itinerario Completo:" (with various formats)
  // This handles: "*\nItinerario Completo:", "*** **Itinerario Completo:", etc.
  let cleanedSummary = summary;
  
  // Try to find "Itinerario Completo:" in various formats
  const itineraryMarkers = [
    /\*\n\s*Itinerario Completo:\s*/i,
    /\*\*\* \*\*Itinerario Completo:\*\*/i,
    /\*\*Itinerario Completo:\*\*/i,
    /Itinerario Completo:/i,
    /\*\s+Itinerario Completo:/i
  ];
  
  for (const marker of itineraryMarkers) {
    const match = cleanedSummary.match(marker);
    if (match && match.index !== undefined) {
      cleanedSummary = cleanedSummary.substring(0, match.index).trim();
      break;
    }
  }
  
  // Also try to find just "*\n" followed by "Itinerario"
  const starNewlineItinerario = cleanedSummary.match(/\*\n\s*\*\s*Itinerario/i);
  if (starNewlineItinerario && starNewlineItinerario.index !== undefined) {
    cleanedSummary = cleanedSummary.substring(0, starNewlineItinerario.index).trim();
  }
  
  // Remove trailing markers like standalone *, ---, ###, etc.
  // These appear before the itinerary section and should be removed
  cleanedSummary = cleanedSummary.replace(/([\-*#]|\*\*\*)+\s*$/g, '').trim();
  
  // Also remove any trailing * on its own line
  cleanedSummary = cleanedSummary.replace(/\n\s*[\-*#]\s*$/g, '').trim();
  
  // Extract only the structured summary part
  // Handle various summary title formats
  const summaryTitles = [
    "**Resumen del viaje:",
    "Resumen del viaje:",
    "**Resumen del itinerario:",
    "Resumen del itinerario:",
    "* **Destino:"
  ];
  
  for (const title of summaryTitles) {
    if (cleanedSummary.includes(title)) {
      const startIndex = cleanedSummary.indexOf(title);
      cleanedSummary = cleanedSummary.substring(startIndex);
      break;
    }
  }
  
  // Process the summary line by line
  // The structure is: * **Label:** Value or *   Label: Value
  // We want: • **Label:** Value (with line breaks)
  
  // Split by lines first, then process each line
  const lines = cleanedSummary.split('\n');
  
  const elements: React.ReactElement[] = [];
  let key = 0;
  let firstItem = true;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Skip summary title line (we'll keep it but handle it specially)
    const isSummaryTitle = line.includes("Resumen del viaje:") || line.includes("Resumen del itinerario:");
    
    if (isSummaryTitle) {
      // Process the summary title
      const titleParts = line.split('**');
      for (let j = 0; j < titleParts.length; j++) {
        const part = titleParts[j];
        if (!part) continue;
        if (j % 2 === 1) {
          elements.push(<strong key={key++}>{part}</strong>);
        } else {
          elements.push(<span key={key++}>{part}</span>);
        }
      }
      elements.push(<br key={key++} />);
      continue;
    }
    
    // Handle list items that start with *
    if (line.startsWith('*')) {
      // Remove the leading * and any spaces
      let cleanedLine = line.replace(/^\*\s*/, '').trim();
      
      if (!firstItem) {
        elements.push(<br key={key++} />);
      }
      elements.push(<span key={key++}>• </span>);
      
      // Process bold text in the line
      const parts = cleanedLine.split('**');
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (!part) continue;
        if (j % 2 === 1) {
          elements.push(<strong key={key++}>{part}</strong>);
        } else {
          elements.push(<span key={key++}>{part}</span>);
        }
      }
      
      firstItem = false;
    }
  }
  
  return <>{elements}</>;
}

/**
 * ItineraryCard component for displaying structured itinerary previews.
 * Can accept either raw list data + getItinerary function, or pre-fetched combined data.
 */
export function ItineraryCard(props: ItineraryCardProps | ItineraryCardCombinedProps): React.ReactElement {
  const isCombined = 'itinerary' in props;
  
  // For the combined props case
  if (isCombined) {
    const combinedProps = props as ItineraryCardCombinedProps;
    return (
      <ItineraryCardInternal
        prompt={combinedProps.prompt}
        summary={combinedProps.summary}
        itinerary={combinedProps.itinerary}
        createdAt={combinedProps.createdAt}
        expiresAt={combinedProps.expiresAt}
        onClick={combinedProps.onClick}
        onDelete={combinedProps.onDelete}
        deletingId={combinedProps.deletingId}
        isMobile={combinedProps.isMobile}
      />
    );
  }
  
  // For the props + getItinerary case
  const cardProps = props as ItineraryCardProps;
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadItinerary() {
      setLoading(true);
      setError(false);
      try {
        const detail = await cardProps.getItinerary(cardProps.itineraryId);
        if (detail && detail.itinerary) {
          setItinerary(detail.itinerary as ItineraryData);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadItinerary();
  }, [cardProps.itineraryId, cardProps.getItinerary]);

  if (loading) {
    return (
      <div className="itinerary-card itinerary-card--loading">
        <div className="itinerary-card__content">
          <div className="itinerary-card__summary" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {formatSummary(cardProps.summary)}
          </div>
          <div className="itinerary-card__meta">
            <span>Cargando preview...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // Fallback to basic display
    return (
      <ItineraryCardInternal
        prompt={cardProps.prompt}
        summary={cardProps.summary}
        itinerary={null}
        createdAt={cardProps.createdAt}
        expiresAt={cardProps.expiresAt}
        onClick={cardProps.onClick}
        onDelete={cardProps.onDelete}
        deletingId={cardProps.deletingId}
        isMobile={cardProps.isMobile}
      />
    );
  }

  return (
    <ItineraryCardInternal
      prompt={cardProps.prompt}
      summary={cardProps.summary}
      itinerary={itinerary}
      createdAt={cardProps.createdAt}
      expiresAt={cardProps.expiresAt}
      onClick={cardProps.onClick}
      onDelete={cardProps.onDelete}
      deletingId={cardProps.deletingId}
      isMobile={cardProps.isMobile}
    />
  );
}

/**
 * Internal component that renders the itinerary card with structured data.
 */
function ItineraryCardInternal({
  prompt,
  summary,
  itinerary,
  createdAt,
  expiresAt,
  onClick,
  onDelete,
  deletingId,
  isMobile = false,
}: {
  prompt: string;
  summary: string;
  itinerary: ItineraryData | null;
  createdAt: string;
  expiresAt: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deletingId: string | null;
  isMobile?: boolean;
}): React.ReactElement {
  // Calculate days left for expiration
  const getDaysLeft = (expiresAt: string): number => {
    try {
      const expiresDate = new Date(expiresAt);
      const now = new Date();
      const diffTime = expiresDate.getTime() - now.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // Safely parse itinerary data
  const dayCount = itinerary?.days?.length || 0;
  const totalActivities = itinerary?.days?.reduce(
    (sum, day) => sum + (day.activities?.length || 0),
    0
  ) || 0;

  // Get first day's activities for preview
  const firstDayActivities = itinerary?.days?.[0]?.activities || [];

  // Truncate preview based on device
  const maxPreviewItems = isMobile ? 2 : 3;
  const previewActivities = firstDayActivities.slice(0, maxPreviewItems);

  // Format activity preview text
  const formatPreview = (): string => {
    if (previewActivities.length === 0) return "";
    return previewActivities
      .map((act) => `${act.time} - ${act.description}`)
      .join(", ");
  };

  const daysLeft = getDaysLeft(expiresAt);

  // Fallback content if itinerary data is not available
  if (!itinerary || dayCount === 0) {
    return (
      <li className="itinerary-history__item" onClick={onClick}>
        <div className="itinerary-history__item-content">
          <div className="itinerary-history__item-summary" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {formatSummary(summary)}
          </div>
          <div className="itinerary-history__item-meta">
            <span className="itinerary-history__item-date">
              {new Date(createdAt).toLocaleDateString()}
            </span>
            <span className="itinerary-history__item-expires">
              Expira en {daysLeft} días
            </span>
          </div>
        </div>
        <div className="itinerary-history__item-actions">
          <button
            className="itinerary-history__item-delete"
            onClick={onDelete}
            disabled={deletingId !== null}
            title="Eliminar itinerario"
            aria-label={`Eliminar itinerario: ${prompt}`}
          >
            🗑️
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className="itinerary-history__item itinerary-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Itinerario: ${prompt}. ${dayCount} días, ${totalActivities} actividades. Expira en ${daysLeft} días.`}
    >
      <div className="itinerary-card__content">
        <div className="itinerary-card__summary" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
          {formatSummary(summary)}
        </div>

        <div className="itinerary-card__meta">
          <span className="itinerary-card__date">
            {new Date(createdAt).toLocaleDateString()}
          </span>
          <span className="itinerary-card__expires">
            Expira en {daysLeft} día{daysLeft !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="itinerary-card__actions">
        <button
          className="itinerary-card__delete"
          onClick={onDelete}
          disabled={deletingId !== null}
          title="Eliminar itinerario"
          aria-label={`Eliminar itinerario: ${prompt}`}
        >
          🗑️
        </button>
      </div>
    </li>
  );
}
