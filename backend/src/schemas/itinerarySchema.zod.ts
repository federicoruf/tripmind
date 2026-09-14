// schemas/itinerarySchema.zod.ts
import { z } from "zod";

export const ActivitySchema = z.object({
  time: z.string().min(1, "time no puede estar vacío"),
  description: z.string().min(1, "description no puede estar vacío"),
  location: z.string().optional(),
  source: z.string().default(""), // Gemini rellena "" cuando no viene del RAG
});

export const DaySchema = z.object({
  day: z.number().int().positive(),
  title: z.string().min(1),
  activities: z.array(ActivitySchema).min(1),
});

export const ItinerarySchema = z.object({
  days: z.array(DaySchema).min(1, "el itinerario no puede tener 0 días"),
});

// Tipo TS inferido automáticamente — dejá de mantener una interface aparte
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type Day = z.infer<typeof DaySchema>;
export type Activity = z.infer<typeof ActivitySchema>;