// Test with the user's actual examples

// EJEMPLO 1
const ejemplo1 = "Resumen del viaje:\n*   Destino: Avilés, Asturias.\n*   Duración: 3 días.\n*   Tipo de viaje: Escapada cultural y gastronómica de ritmo relajado.\n*   Intereses: Arquitectura histórica y contemporánea (Centro Niemeyer, casco antiguo), gastronomía asturiana tradicional y disfrute pausado de la vida local.\n\n*\nItinerario Completo:\n\nDía 1: Arquitectura y contrastes\n* 10:00: Paseo por el Casco Histórico";

console.log("=== EJEMPLO 1 ===");
let cleaned = ejemplo1;

// Remove everything after (and including) "Itinerario Completo:"
const itineraryMarkers = [
  /\*\n\s*Itinerario Completo:\s*/i,
  /\*\*\* \*\*Itinerario Completo:\*\*/i,
  /\*\*Itinerario Completo:\*\*/i,
  /Itinerario Completo:/i,
  /\*\s+Itinerario Completo:/i
];

for (const marker of itineraryMarkers) {
  const match = cleaned.match(marker);
  if (match && match.index !== undefined) {
    cleaned = cleaned.substring(0, match.index).trim();
    break;
  }
}

// Remove trailing markers
cleaned = cleaned.replace(/([\-*#]|\*\*\*)+\s*$/g, '').trim();
cleaned = cleaned.replace(/\n\s*[\-*#]\s*$/g, '').trim();

// Extract summary part
const summaryTitles = [
  "**Resumen del viaje:",
  "Resumen del viaje:",
  "**Resumen del itinerario:",
  "Resumen del itinerario:",
  "* **Destino:"
];

for (const title of summaryTitles) {
  if (cleaned.includes(title)) {
    const startIndex = cleaned.indexOf(title);
    cleaned = cleaned.substring(startIndex);
    break;
  }
}

console.log("Cleaned summary:");
console.log(cleaned);
console.log();

// Process lines
const lines = cleaned.split('\n');
const result = [];
let firstItem = true;

for (let line of lines) {
  line = line.trim();
  if (!line) continue;
  
  const isSummaryTitle = line.includes("Resumen del viaje:") || line.includes("Resumen del itinerario:");
  
  if (isSummaryTitle) {
    result.push(line);
    result.push('');
    continue;
  }
  
  if (line.startsWith('*')) {
    let cleanedLine = line.replace(/^\*\s*/, '').trim();
    
    if (!firstItem) {
      result.push('');
    }
    result.push('• ' + cleanedLine);
    firstItem = false;
  }
}

console.log("Formatted output:");
console.log(result.join('\n'));
console.log();

// EJEMPLO 2
const ejemplo2 = "Resumen del itinerario:\n\n*   Destino: Asturias (Oviedo, Cudillero y Avilés).\n*   Duración: 3 días.\n*   Tipo de viaje: Relax y cultural.\n*   Intereses: Arquitectura prerrománica (Monte Naranco) y vanguardista (Niemeyer), y gastronomía tradicional (sidrerías y productos locales).\n\n---\n\n###\nItinerario Completo:\n\nDía 1: Oviedo...";

console.log("=== EJEMPLO 2 ===");
let cleaned2 = ejemplo2;

for (const marker of itineraryMarkers) {
  const match = cleaned2.match(marker);
  if (match && match.index !== undefined) {
    cleaned2 = cleaned2.substring(0, match.index).trim();
    break;
  }
}

cleaned2 = cleaned2.replace(/([\-*#]|\*\*\*)+\s*$/g, '').trim();
cleaned2 = cleaned2.replace(/\n\s*[\-*#]\s*$/g, '').trim();

for (const title of summaryTitles) {
  if (cleaned2.includes(title)) {
    const startIndex = cleaned2.indexOf(title);
    cleaned2 = cleaned2.substring(startIndex);
    break;
  }
}

console.log("Cleaned summary:");
console.log(cleaned2);
console.log();

const lines2 = cleaned2.split('\n');
const result2 = [];
firstItem = true;

for (let line of lines2) {
  line = line.trim();
  if (!line) continue;
  
  const isSummaryTitle = line.includes("Resumen del viaje:") || line.includes("Resumen del itinerario:");
  
  if (isSummaryTitle) {
    result2.push(line);
    result2.push('');
    continue;
  }
  
  if (line.startsWith('*')) {
    let cleanedLine = line.replace(/^\*\s*/, '').trim();
    
    if (!firstItem) {
      result2.push('');
    }
    result2.push('• ' + cleanedLine);
    firstItem = false;
  }
}

console.log("Formatted output:");
console.log(result2.join('\n'));
