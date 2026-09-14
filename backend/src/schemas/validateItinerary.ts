// rag/validateItinerary.ts (o donde prefieras)
import { ItinerarySchema, type Itinerary } from "../schemas/itinerarySchema.zod";

type ValidationResult =
  | { success: true; data: Itinerary }
  | { success: false; errors: string[] };

export function validateItinerary(raw: unknown): ValidationResult {
  const result = ItinerarySchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // .flatten() o .format() son alternativas; issues da el detalle crudo
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { success: false, errors };
}