// schemas/imageIdentifySchema.ts
import { Type } from "@google/genai";

export const imageIdentifySchema = {
  type: Type.OBJECT,
  properties: {
    esLugarPuntual: {
      type: Type.BOOLEAN,
      description:
        "true si la imagen muestra un lugar identificable y visitable puntualmente (ej: Torre Eiffel, Machu Picchu). false si es un paisaje/escena genérica (ej: 'una playa', 'aurora boreal') sin lugar único identificable.",
    },
    lugar: {
      type: Type.STRING,
      description: "Nombre del lugar identificado. Vacío si esLugarPuntual es false.",
    },
    pais: {
      type: Type.STRING,
      description: "País del lugar identificado. Vacío si esLugarPuntual es false.",
    },
    sugerencias: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "2 a 3 destinos reales (ciudad, país) donde se puede vivir una experiencia similar a la de la imagen. Se completa SOLO si esLugarPuntual es false.",
    },
  },
  required: ["esLugarPuntual", "lugar", "pais", "sugerencias"],
};
