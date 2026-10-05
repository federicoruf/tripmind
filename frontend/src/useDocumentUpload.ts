import { useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface DocumentUploadResult {
  id: string;
  filename: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  expiresAt: string;
}

// Debe coincidir con ALLOWED_DOC_EXTENSIONS / MAX_DOC_BYTES en
// backend/src/constans.ts — validar acá evita subir un archivo que el
// backend va a rechazar igual.
export const ALLOWED_DOC_EXTENSIONS = [".pdf", ".md", ".txt"];
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB

// Mensajes de error para el usuario
export const ERROR_MESSAGES = {
  INVALID_EXTENSION: "Solo se aceptan archivos .txt, .pdf o .md",
  FILE_TOO_LARGE: "El archivo supera el máximo permitido (10MB)",
  EMPTY_FILE: "El archivo está vacío",
  NETWORK_ERROR: "Error de conexión. Intentá de nuevo.",
  UNKNOWN_ERROR: "No se pudo subir el documento. Intentá de nuevo.",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result es "data:application/pdf;base64,AAAA..." o similar
      // el backend solo quiere la parte de después de la coma
      const result = reader.result as string;
      const base64String = result.split(",")[1] ?? "";
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Valida que el archivo tenga una extensión permitida
 */
function validateFileExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_DOC_EXTENSIONS.includes(ext);
}

/**
 * Valida que el archivo no supere el tamaño máximo
 */
function validateFileSize(file: File): boolean {
  return file.size <= MAX_DOC_BYTES && file.size > 0;
}

export function useDocumentUpload() {
  const [result, setResult] = useState<DocumentUploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { getAccessTokenSilently } = useAuth0();

  const upload = useCallback(async (file: File) => {
    setResult(null);
    setError(null);
    setSuccess(false);

    // Validación client-side de extensión
    if (!validateFileExtension(file.name)) {
      setError(ERROR_MESSAGES.INVALID_EXTENSION);
      return;
    }

    // Validación client-side de tamaño
    if (!validateFileSize(file)) {
      if (file.size === 0) {
        setError(ERROR_MESSAGES.EMPTY_FILE);
      } else {
        setError(ERROR_MESSAGES.FILE_TOO_LARGE);
      }
      return;
    }

    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          fileBase64,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Manejar errores del backend con mensajes específicos
        const errorMessage = data.error || ERROR_MESSAGES.UNKNOWN_ERROR;
        setError(errorMessage);
        return;
      }

      setResult(data);
      setSuccess(true);
    } catch (err) {
      const errorMessage = 
        err instanceof Error && err.message.includes("network")
          ? ERROR_MESSAGES.NETWORK_ERROR
          : ERROR_MESSAGES.UNKNOWN_ERROR;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setSuccess(false);
  }, []);

  return { result, loading, error, success, upload, reset };
}
