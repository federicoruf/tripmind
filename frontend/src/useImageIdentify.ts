import { useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface ImageIdentifyResult {
  esLugarPuntual: boolean;
  lugar: string;
  pais: string;
  sugerencias: string[];
}

// Debe coincidir con ALLOWED_IMAGE_MIME_TYPES / MAX_IMAGE_BYTES en
// backend/src/constans.ts — validar acá evita subir un archivo que el
// backend va a rechazar igual.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result es "data:image/jpeg;base64,AAAA..."; el backend solo
      // quiere la parte de después de la coma.
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export function useImageIdentify() {
  const [result, setResult] = useState<ImageIdentifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getAccessTokenSilently } = useAuth0();

  const identify = useCallback(async (file: File) => {
    setResult(null);
    setError(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Formato no soportado. Usá JPEG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen supera los 5MB.");
      return;
    }

    setLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/image/identify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo identificar la imagen.");

      setResult(data as ImageIdentifyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, identify, reset };
}
