import { FunctionDeclaration, Type } from "@google/genai";

export const tripDeclarations: FunctionDeclaration[] = [
    {
      name: "get_weather",
      description: "Devuelve el clima esperado para una ciudad y fecha",
      parameters: {
        type: Type.OBJECT,
        properties: {
          city: { type: Type.STRING },
          date: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
        },
        required: ["city", "date"],
      },
    },
    {
      name: "get_places",
      description: "Busca lugares de interés en una ciudad según categoría",
      parameters: {
        type: Type.OBJECT,
        properties: {
          city: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ["naturaleza", "comida", "cultura"],
          },
        },
        required: ["city", "category"],
      },
    },
  ];