import { useState, useCallback, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface ItineraryHistoryListItem {
  id: string;
  prompt: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
}

export interface ItineraryHistoryDetail {
  id: string;
  prompt: string;
  summary: string;
  itinerary: any;
  createdAt: string;
  expiresAt: string;
}

export interface ItineraryHistoryResponse {
  itineraries: ItineraryHistoryListItem[];
  count: number;
}

export function useItineraryHistory() {
  const [itineraries, setItineraries] = useState<ItineraryHistoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const fetchItineraries = useCallback(async () => {
    if (!isAuthenticated) {
      setItineraries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/itinerary/history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || "No se pudieron cargar los itinerarios.";
        setError(errorMessage);
        setItineraries([]);
        return;
      }

      setItineraries(data.itineraries || []);
    } catch (err) {
      setError("Error de conexión al cargar itinerarios.");
      setItineraries([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  const getItinerary = useCallback(async (itineraryId: string): Promise<ItineraryHistoryDetail | null> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/itinerary/history/${itineraryId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "No se pudo obtener el itinerario.");
        return null;
      }

      return data as ItineraryHistoryDetail;
    } catch (err) {
      setError("Error de conexión al obtener el itinerario.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  const deleteItinerary = useCallback(async (itineraryId: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/itinerary/history/${itineraryId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.error || "No se pudo borrar el itinerario.";
        setError(errorMessage);
        return false;
      }

      // Actualizar la lista de itinerarios
      await fetchItineraries();
      return true;
    } catch (err) {
      setError("Error de conexión al borrar el itinerario.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, fetchItineraries]);

  // Cargar itinerarios cuando el usuario se autentica
  useEffect(() => {
    if (isAuthenticated) {
      fetchItineraries();
    } else {
      setItineraries([]);
    }
  }, [isAuthenticated, fetchItineraries]);

  return { itineraries, loading, error, fetchItineraries, getItinerary, deleteItinerary };
}
