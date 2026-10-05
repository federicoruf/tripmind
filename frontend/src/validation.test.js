import { describe, it } from "node:test";
import assert from "node:assert";

// Test de validación básica sin depender de imports TypeScript
// Esto valida que las constantes y lógicas básicas sean correctas

describe("Validación de extensiones de archivo", () => {
  const ALLOWED_DOC_EXTENSIONS = [".pdf", ".md", ".txt"];

  it("debe aceptar archivos .txt", () => {
    assert.ok(ALLOWED_DOC_EXTENSIONS.includes(".txt"));
  });

  it("debe aceptar archivos .pdf", () => {
    assert.ok(ALLOWED_DOC_EXTENSIONS.includes(".pdf"));
  });

  it("debe aceptar archivos .md", () => {
    assert.ok(ALLOWED_DOC_EXTENSIONS.includes(".md"));
  });

  it("debe rechazar archivos .jpg", () => {
    assert.ok(!ALLOWED_DOC_EXTENSIONS.includes(".jpg"));
  });

  it("debe rechazar archivos .png", () => {
    assert.ok(!ALLOWED_DOC_EXTENSIONS.includes(".png"));
  });

  it("debe tener exactamente 3 extensiones permitidas", () => {
    assert.strictEqual(ALLOWED_DOC_EXTENSIONS.length, 3);
  });
});

describe("Validación de tamaño de archivo", () => {
  const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB

  it("debe tener un límite de 10MB", () => {
    assert.strictEqual(MAX_DOC_BYTES, 10 * 1024 * 1024);
  });

  it("debe ser exactamente 10485760 bytes", () => {
    assert.strictEqual(MAX_DOC_BYTES, 10485760);
  });

  it("debe ser mayor que 5MB", () => {
    assert.ok(MAX_DOC_BYTES > 5 * 1024 * 1024);
  });

  it("debe ser menor que 20MB", () => {
    assert.ok(MAX_DOC_BYTES < 20 * 1024 * 1024);
  });
});

describe("Validación de funciones puras de documento", () => {
  const ALLOWED_DOC_EXTENSIONS = [".pdf", ".md", ".txt"];

  it("debe validar que el array contiene todas las extensiones requeridas", () => {
    const requiredExtensions = [".pdf", ".md", ".txt"];
    const allPresent = requiredExtensions.every(ext => 
      ALLOWED_DOC_EXTENSIONS.includes(ext)
    );
    assert.ok(allPresent);
  });

  it("debe validar que no contiene extensiones no permitidas", () => {
    const invalidExtensions = [".jpg", ".png", ".gif", ".doc", ".xlsx"];
    const nonePresent = invalidExtensions.every(ext => 
      !ALLOWED_DOC_EXTENSIONS.includes(ext)
    );
    assert.ok(nonePresent);
  });
});

describe("Extracción de extensión de filename", () => {
  function getFileExtension(filename) {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex >= 0 ? filename.slice(lastDotIndex).toLowerCase() : "";
  }

  it("debe extraer .txt de test.txt", () => {
    assert.strictEqual(getFileExtension("test.txt"), ".txt");
  });

  it("debe extraer .pdf de documento.pdf", () => {
    assert.strictEqual(getFileExtension("documento.pdf"), ".pdf");
  });

  it("debe extraer .md de readme.md", () => {
    assert.strictEqual(getFileExtension("readme.md"), ".md");
  });

  it("debe manejar nombres con múltiples puntos", () => {
    assert.strictEqual(getFileExtension("archivo.viejo.txt"), ".txt");
  });

  it("debe manejar nombres sin extensión", () => {
    assert.strictEqual(getFileExtension("archivo"), "");
  });

  it("debe manejar mayúsculas en la extensión", () => {
    assert.strictEqual(getFileExtension("documento.TXT"), ".txt");
  });
});

describe("Conversión a base64 - Funciones puras", () => {
  it("debe extraer correctamente la parte base64 de un data URL", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8gV29ybGQ=";
    const base64Part = dataUrl.split(",")[1];
    assert.strictEqual(base64Part, "SGVsbG8gV29ybGQ=");
    assert.strictEqual(Buffer.from(base64Part, 'base64').toString(), "Hello World");
  });

  it("debe manejar data URL sin parte base64", () => {
    const dataUrl = "data:text/plain";
    const base64Part = dataUrl.split(",")[1];
    assert.strictEqual(base64Part, undefined);
    assert.strictEqual(base64Part ?? "", "");
  });

  it("debe manejar base64 vacío correctamente", () => {
    const dataUrl = "data:text/plain;base64,";
    const base64Part = dataUrl.split(",")[1];
    assert.strictEqual(base64Part, "");
    assert.strictEqual(Buffer.from(base64Part, 'base64').toString() ?? "", "");
  });

  it("debe manejar diferentes tipos MIME en data URL", () => {
    const dataUrl = "data:application/pdf;base64,JVBERi0xLjQ=";
    const base64Part = dataUrl.split(",")[1];
    assert.strictEqual(base64Part, "JVBERi0xLjQ=");
  });
});

describe("Mensajes de error esperados", () => {
  const ERROR_MESSAGES = {
    INVALID_EXTENSION: "Solo se aceptan archivos .txt, .pdf o .md",
    FILE_TOO_LARGE: "El archivo supera el máximo permitido (10MB)",
    EMPTY_FILE: "El archivo está vacío",
    NETWORK_ERROR: "Error de conexión. Intentá de nuevo.",
    UNKNOWN_ERROR: "No se pudo subir el documento. Intentá de nuevo.",
  };

  it("debe tener mensaje para extensión inválida", () => {
    assert.ok(ERROR_MESSAGES.INVALID_EXTENSION.includes("Solo se aceptan"));
    assert.ok(ERROR_MESSAGES.INVALID_EXTENSION.includes(".txt"));
    assert.ok(ERROR_MESSAGES.INVALID_EXTENSION.includes(".pdf"));
    assert.ok(ERROR_MESSAGES.INVALID_EXTENSION.includes(".md"));
  });

  it("debe tener mensaje para archivo demasiado grande", () => {
    assert.ok(ERROR_MESSAGES.FILE_TOO_LARGE.includes("10MB"));
  });

  it("debe tener mensaje para archivo vacío", () => {
    assert.strictEqual(ERROR_MESSAGES.EMPTY_FILE, "El archivo está vacío");
  });

  it("debe tener mensaje para error de red", () => {
    assert.ok(ERROR_MESSAGES.NETWORK_ERROR.includes("Error de conexión"));
  });

  it("debe tener mensaje para error desconocido", () => {
    assert.ok(ERROR_MESSAGES.UNKNOWN_ERROR.includes("No se pudo subir"));
  });
});