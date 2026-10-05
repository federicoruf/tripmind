import { useState, useCallback, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface UserDocument {
  id: string;
  filename: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  expiresAt: string;
}

export function useUserDocuments() {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const fetchDocuments = useCallback(async () => {
    if (!isAuthenticated) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/documents`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || "No se pudieron cargar los documentos.";
        setError(errorMessage);
        setDocuments([]);
        return;
      }

      setDocuments(data);
    } catch (err) {
      setError("Error de conexión al cargar documentos.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  const deleteDocument = useCallback(async (documentId: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.error || "No se pudo borrar el documento.";
        setError(errorMessage);
        return false;
      }

      // Actualizar la lista de documentos
      await fetchDocuments();
      return true;
    } catch (err) {
      setError("Error de conexión al borrar el documento.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, fetchDocuments]);

  // Cargar documentos cuando el usuario se autentica
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [isAuthenticated, fetchDocuments]);

  return { documents, loading, error, fetchDocuments, deleteDocument };
}
