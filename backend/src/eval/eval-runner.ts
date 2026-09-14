/**
 * TripMind - Evaluación semántica con Golden Dataset
 *
 * Qué hace:
 * 1. Carga golden-dataset.json (casos con input + criterios esperados)
 * 2. Genera un itinerario para cada input llamando a tu pipeline real de TripMind
 *    (reemplazar la función `generateItinerary` por tu llamada real)
 * 3. Aplica chequeos determinísticos rápidos (JSON válido, sin duplicados, etc.)
 * 4. Usa un LLM como "juez" para calificar 1-5 si el itinerario cumple los criterios
 * 5. Imprime un reporte y falla (exit code 1) si el promedio no llega al umbral
 *
 * Uso:
 *   npm install
 *   GEMINI_API_KEY=... npx tsx eval-runner.ts
 */

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { generateItinerary as generarItinerarioReal } from "../services/itinerary";

// ---------- Config ----------
const UMBRAL_MINIMO = 3.5; // promedio 1-5 para considerar el pipeline "aprobado"
const UMBRAL_MINIMO_CASO = 3; // ningún caso individual puede estar por debajo de esto
const PORCENTAJE_MAXIMO_CASOS_BAJO_UMBRAL = 0.2; // máximo 20% de casos por debajo de UMBRAL_MINIMO
const MODELO_JUEZ = "gemini-3.1-flash-lite"; // ajustá al modelo que tengas disponible
//const MODELO_JUEZ = "gemini-3.6-flash"; // ajustá al modelo que tengas disponible
const PAUSA_ENTRE_CASOS_MS = 4000;

const ai = new GoogleGenAI({}); // toma la API key de la variable de entorno GEMINI_API_KEY

// ---------- Tipos ----------
interface CasoDorado {
  id: string;
  input: string;
  criterios: string[];
}

interface Actividad {
  hora?: string;
  titulo: string;
  descripcion?: string;
}

interface DiaItinerario {
  dia: number;
  actividades: Actividad[];
}

interface ResultadoCaso {
  id: string;
  input: string;
  chequeosDeterministicos: {
    nombre: string;
    paso: boolean;
    detalle?: string;
  }[];
  scoreSemantico: number; // 1-5
  razonJuez: string;
}

async function generateItinerary(input: string): Promise<DiaItinerario[]> {
  const days = await generarItinerarioReal(input);

  return days.map((d: any) => ({
    dia: d.day,
    actividades: d.activities.map((a: any) => ({
      hora: a.time,
      titulo: a.description, // el schema no tiene "title" por actividad, solo por día
      descripcion: a.location
        ? `${a.description} — ${a.location}`
        : a.description,
    })),
  }));
}

// ---------- PASO 2: chequeos determinísticos (gratis, antes de gastar tokens) ----------
function chequeosDeterministicos(itinerario: DiaItinerario[]) {
  const resultados: { nombre: string; paso: boolean; detalle?: string }[] = [];

  // JSON con estructura mínima válida
  const estructuraValida =
    Array.isArray(itinerario) &&
    itinerario.every(
      (d) => typeof d.dia === "number" && Array.isArray(d.actividades),
    );
  resultados.push({ nombre: "estructura_json_valida", paso: estructuraValida });

  if (!estructuraValida) return resultados;

  // Días consecutivos sin huecos ni repetidos
  const dias = itinerario.map((d) => d.dia).sort((a, b) => a - b);
  const diasConsecutivos = dias.every((d, i) => d === i + 1);
  resultados.push({ nombre: "dias_consecutivos", paso: diasConsecutivos });

  // Sin actividades duplicadas (mismo título el mismo día)
  const sinDuplicados = itinerario.every((d) => {
    const titulos = d.actividades.map((a) => a.titulo.toLowerCase().trim());
    return new Set(titulos).size === titulos.length;
  });
  resultados.push({
    nombre: "sin_actividades_duplicadas",
    paso: sinDuplicados,
  });

  // Cada día tiene al menos 1 actividad
  const diasConActividad = itinerario.every((d) => d.actividades.length > 0);
  resultados.push({
    nombre: "todos_los_dias_tienen_actividades",
    paso: diasConActividad,
  });

  return resultados;
}

// ---------- PASO 3: LLM como juez (evaluación semántica) ----------
async function evaluarConJuez(
  input: string,
  criterios: string[],
  itinerario: DiaItinerario[],
): Promise<{ score: number; razon: string }> {
  const prompt = `Sos un evaluador estricto de itinerarios de viaje generados por IA.

Pedido del usuario:
"${input}"

Criterios que el itinerario debe cumplir:
${criterios.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Itinerario generado (JSON):
${JSON.stringify(itinerario, null, 2)}

Evaluá qué tan bien el itinerario cumple TODOS los criterios.
Respondé SOLO con un JSON, sin texto adicional, con este formato exacto:
{"score": <numero entero del 1 al 5>, "razon": "<explicación breve, máximo 2 frases>"}

Escala:
5 = cumple todos los criterios perfectamente
3 = cumple parcialmente, hay 1-2 criterios flojos
1 = incumple la mayoría de los criterios`;

  const respuesta = await ai.models.generateContent({
    model: MODELO_JUEZ,
    contents: prompt,
  });

  const texto = respuesta.text ?? "{}";

  try {
    const limpio = texto.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(limpio);
    return { score: Number(parsed.score) || 1, razon: parsed.razon || "" };
  } catch {
    return {
      score: 1,
      razon: `No se pudo parsear la respuesta del juez: ${texto}`,
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Orquestador principal ----------
async function main() {
  const dataset: CasoDorado[] = JSON.parse(
    readFileSync(new URL("./golden-dataset.json", import.meta.url), "utf-8"),
  );

  const resultados: ResultadoCaso[] = [];

  for (const caso of dataset) {
    console.log(`\nEvaluando ${caso.id}...`);

    let itinerario: DiaItinerario[];
    try {
      itinerario = await generateItinerary(caso.input);
    } catch (err) {
      console.error(`  Error generando itinerario: ${(err as Error).message}`);
      resultados.push({
        id: caso.id,
        input: caso.input,
        chequeosDeterministicos: [
          { nombre: "generacion", paso: false, detalle: String(err) },
        ],
        scoreSemantico: 1,
        razonJuez: "No se pudo generar el itinerario.",
      });
      continue;
    }

    const chequeos = chequeosDeterministicos(itinerario);
    const { score, razon } = await evaluarConJuez(
      caso.input,
      caso.criterios,
      itinerario,
    );

    resultados.push({
      id: caso.id,
      input: caso.input,
      chequeosDeterministicos: chequeos,
      scoreSemantico: score,
      razonJuez: razon,
    });

    console.log(`  Score semántico: ${score}/5 — ${razon}`);
    chequeos
      .filter((c) => !c.paso)
      .forEach((c) =>
        console.log(`  ⚠ Falló chequeo determinístico: ${c.nombre}`),
      );
    await sleep(PAUSA_ENTRE_CASOS_MS);
  }

  // ---------- Reporte final ----------
  const promedio =
    resultados.reduce((sum, r) => sum + r.scoreSemantico, 0) /
    resultados.length;

  const casosBajoUmbral = resultados.filter(
    (r) => r.scoreSemantico < UMBRAL_MINIMO,
  );
  const porcentajeCasosBajoUmbral = casosBajoUmbral.length / resultados.length;
  const casosBajoPisoDuro = resultados.filter(
    (r) => r.scoreSemantico < UMBRAL_MINIMO_CASO,
  );

  console.log("\n===== REPORTE FINAL =====");
  console.log(`Casos evaluados: ${resultados.length}`);
  console.log(
    `Score semántico promedio: ${promedio.toFixed(2)}/5 (mínimo: ${UMBRAL_MINIMO})`,
  );
  console.log(
    `Casos por debajo del umbral: ${casosBajoUmbral.length}/${resultados.length} ` +
      `(${(porcentajeCasosBajoUmbral * 100).toFixed(0)}%, máximo permitido: ${PORCENTAJE_MAXIMO_CASOS_BAJO_UMBRAL * 100}%)`,
  );
  console.log(
    `Casos por debajo del piso duro (${UMBRAL_MINIMO_CASO}): ${casosBajoPisoDuro.length}`,
  );

  if (casosBajoUmbral.length > 0) {
    console.log(`\nDetalle de casos por debajo del umbral:`);
    casosBajoUmbral.forEach((r) =>
      console.log(`  - ${r.id} (score ${r.scoreSemantico}): ${r.razonJuez}`),
    );
  }

  // ---------- Criterios de aprobación ----------
  const motivosFalla: string[] = [];

  if (promedio < UMBRAL_MINIMO) {
    motivosFalla.push(
      `Promedio ${promedio.toFixed(2)} por debajo del mínimo ${UMBRAL_MINIMO}`,
    );
  }
  if (casosBajoPisoDuro.length > 0) {
    motivosFalla.push(
      `${casosBajoPisoDuro.length} caso(s) por debajo del piso duro ${UMBRAL_MINIMO_CASO}: ` +
        casosBajoPisoDuro.map((r) => r.id).join(", "),
    );
  }
  if (porcentajeCasosBajoUmbral > PORCENTAJE_MAXIMO_CASOS_BAJO_UMBRAL) {
    motivosFalla.push(
      `${(porcentajeCasosBajoUmbral * 100).toFixed(0)}% de casos por debajo del umbral, ` +
        `supera el máximo permitido de ${PORCENTAJE_MAXIMO_CASOS_BAJO_UMBRAL * 100}%`,
    );
  }

  if (motivosFalla.length > 0) {
    console.log("\n❌ Evaluación NO aprobada. Motivos:");
    motivosFalla.forEach((m) => console.log(`  - ${m}`));
    process.exit(1);
  } else {
    console.log("\n✅ Evaluación aprobada.");
  }
}

main().catch((err) => {
  console.error("Error fatal en la evaluación:", err);
  process.exit(1);
});
