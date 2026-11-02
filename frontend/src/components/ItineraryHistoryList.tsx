import { useState, useEffect } from "react";
import { type ItineraryHistoryDetail } from "../hooks/useItineraryHistory";
import { ItineraryCard, type ItineraryData } from "./ItineraryCard";

interface ItineraryHistoryListProps {
  itineraries: ItineraryHistoryDetail[];
  getItinerary: (id: string) => Promise<ItineraryHistoryDetail | null>;
  onViewItinerary: (id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  isMobile: boolean;
}

export function ItineraryHistoryList({
  itineraries,
  getItinerary,
  onViewItinerary,
  onDelete,
  deletingId,
  isMobile,
}: ItineraryHistoryListProps) {
  const [itinerariesDetails, setItinerariesDetails] = useState<Record<string, ItineraryData | null>>({});

  // Preload all itinerary details to avoid N+1
  useEffect(() => {
    async function loadAllItineraries() {
      const details: Record<string, ItineraryData | null> = {};
      await Promise.all(
        itineraries.map(async (itinerary) => {
          try {
            const detail = await getItinerary(itinerary.id);
            details[itinerary.id] = detail?.itinerary as ItineraryData | null || null;
          } catch {
            details[itinerary.id] = null;
          }
        })
      );
      setItinerariesDetails(details);
    }

    if (itineraries.length > 0) {
      loadAllItineraries();
    }
  }, [itineraries, getItinerary]);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div className="itinerary-history__list">
      <ul className="itinerary-history__items">
        {itineraries.map((itinerary) => (
          <ItineraryCard
            key={itinerary.id}
            id={itinerary.id}
            prompt={itinerary.prompt}
            summary={itinerary.summary}
            itinerary={itinerariesDetails[itinerary.id] || null}
            createdAt={itinerary.createdAt}
            expiresAt={itinerary.expiresAt}
            onClick={() => onViewItinerary(itinerary.id)}
            onDelete={(e) => handleDeleteClick(itinerary.id, e)}
            deletingId={deletingId}
            isMobile={isMobile}
          />
        ))}
      </ul>
    </div>
  );
}
