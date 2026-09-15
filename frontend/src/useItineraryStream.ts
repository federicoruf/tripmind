import { useState, useCallback } from "react";

interface DayActivity {
  time: string;
  description: string;
  location: string;
}

interface DayData {
  day: number;
  title: string;
  activities: DayActivity[];
}

export function useItineraryStream() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string) => {
    setDays([]);
    setError(null);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/itinerary/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.body) throw new Error("Sin cuerpo de respuesta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Los eventos SSE vienen separados por "\n\n"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // lo incompleto queda para el próximo chunk

        for (const part of parts) {
          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (eventType === "day") {
            setDays((prev) => [...prev, data as DayData]);
          } else if (eventType === "error") {
            setError(data.message);
          } else if (eventType === "done") {
            setLoading(false);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
    }
  }, []);

  return { days, loading, error, generate };
}