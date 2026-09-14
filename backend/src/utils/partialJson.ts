// utils/partialJson.ts
import { parse } from "best-effort-json-parser";

export function tryParsePartialItinerary(text: string): { days: any[] } | null {
  try {
    const result = parse(text);
    return result && Array.isArray(result.days) ? result : null;
  } catch {
    return null;
  }
}