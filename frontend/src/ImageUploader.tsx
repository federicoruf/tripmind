import { useRef } from "react";
import { useImageIdentify } from "./useImageIdentify";

interface Props {
  // Se llama con el texto ya armado (ej. "Kotor, Montenegro") cuando el
  // usuario confirma. App.tsx lo usa como prompt normal — este componente
  // no toca el flujo de /api/itinerary/stream directamente.
  onPlaceConfirmed: (prompt: string) => void;
}

export function ImageUploader({ onPlaceConfirmed }: Props) {
  const { result, loading, error, identify, reset } = useImageIdentify();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) identify(file);
    e.target.value = ""; // permite volver a subir el mismo archivo
  };

  const handleConfirm = (destino: string) => {
    onPlaceConfirmed(`Quiero viajar a ${destino}`);
    reset();
  };

  return (
    <div className="image-uploader">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        hidden
      />
      <button
        type="button"
        className="image-uploader__trigger"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? "Identificando lugar…" : "📷 Subir una foto en vez de escribir"}
      </button>

      {error && <div className="error-banner">{error}</div>}

      {result && result.esLugarPuntual && (
        <div className="image-result">
          <p>
            Parece ser <strong>{result.lugar}</strong>
            {result.pais && `, ${result.pais}`}.
          </p>
          <div className="image-result__actions">
            <button onClick={() => handleConfirm(`${result.lugar}, ${result.pais}`)}>
              Armar itinerario para {result.lugar}
            </button>
            <button className="image-result__dismiss" onClick={reset}>
              No es esto
            </button>
          </div>
        </div>
      )}

      {result && !result.esLugarPuntual && (
        <div className="image-result">
          <p>No identifiqué un lugar puntual. Destinos similares:</p>
          <div className="image-result__actions">
            {result.sugerencias.map((destino) => (
              <button key={destino} onClick={() => handleConfirm(destino)}>
                {destino}
              </button>
            ))}
            <button className="image-result__dismiss" onClick={reset}>
              Ninguno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
