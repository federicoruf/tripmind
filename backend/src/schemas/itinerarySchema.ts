    // schemas/itinerarySchema.ts

import { Type } from "@google/genai";

export const itinerarySchema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          title: { type: Type.STRING },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                description: { type: Type.STRING },
                location: { type: Type.STRING },
                source: {
                  type: Type.STRING,
                  description:
                    "Nombre exacto del archivo fuente (atributo 'fuente' del fragmento usado, ej: 'Lisboa-Guia-viaje.pdf'). Vacío si no vino del contexto.",
                },
              },
              required: ["time", "description"],
            },
          },
        },
        required: ["day", "title", "activities"],
      },
    },
  },
  required: ["days"],
};