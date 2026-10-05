import { useRef } from "react";
import { useDocumentUpload } from "./useDocumentUpload";

interface Props {
  onUploadSuccess?: (document: any) => void;
  onUploadError?: (error: string) => void;
}

export function DocumentUploadButton({ 
  onUploadSuccess, 
  onUploadError 
}: Props) {
  const { upload, loading, error, success, result, reset } = useDocumentUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
    e.target.value = ""; // permite volver a subir el mismo archivo
  };

  // Notificar éxito al componente padre
  if (success && result && onUploadSuccess) {
    onUploadSuccess(result);
    reset();
  }

  // Notificar error al componente padre
  if (error && onUploadError) {
    onUploadError(error);
    reset();
  }

  return (
    <div className="document-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.md,.txt"
        onChange={handleFileChange}
        hidden
        disabled={loading}
      />
      <button
        type="button"
        className="document-upload__trigger"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? "Subiendo documento…" : "📄 Subir Documento"}
      </button>

      {error && (
        <div className="document-upload__error">
          {error}
        </div>
      )}

      {success && result && (
        <div className="document-upload__success">
          Documento subido con éxito: {result.filename}
        </div>
      )}
    </div>
  );
}
