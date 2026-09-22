const MAX_PLACES = 6;
const MAX_PLACE_NAME_LENGTH = 60;
const OWM_KEY = process.env.OPENWEATHER_API_KEY!;
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY!;

import { logStep } from "../utils/logger";

interface Coords {
  lat: number;
  lon: number;
}

async function geocodeCity(city: string): Promise<Coords | null> {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OWM_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.[0]) return null;
  return { lat: data[0].lat, lon: data[0].lon };
}

const categoriesMap: Record<string, string> = {
  naturaleza: "natural",
  comida: "catering.restaurant,catering.cafe",
  cultura: "tourism.sights,entertainment.museum",
};

export async function getPlaces(city: string, category: "naturaleza" | "comida" | "cultura") {
  const coords = await geocodeCity(city); // ya la tenías, la reutilizamos igual
  if (!coords) return { error: `No se encontró la ciudad "${city}"` };


  const url = `https://api.geoapify.com/v2/places?categories=${categoriesMap[category]}&filter=circle:${coords.lon},${coords.lat},5000&limit=${MAX_PLACES}&lang=es&apiKey=${GEOAPIFY_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  logStep("tool:getPlaces", "Respuesta de Geoapify", {
    city,
    category,
    resultadosCrudos: data.features?.length ?? 0,
  });

  return (data.features ?? [])
    .map((f: any) => ({
      name: (f.properties.name ?? "").slice(0, MAX_PLACE_NAME_LENGTH),
      category,
    }))
    .filter((p: any) => p.name)
    .slice(0, MAX_PLACES);
}

export async function getWeather(city: string, date: string) {
    const coords = await geocodeCity(city);
    if (!coords) return { error: `No se encontró la ciudad "${city}"` };

    logStep("tool:getWeather", "Coordenadas resueltas", { city, coords });

    const daysAhead = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  
    if (daysAhead > 5 || daysAhead < 0) {
      return {
        city,
        date,
        available: false,
        note: "Fuera del rango de pronóstico (solo hay datos confiables para los próximos 5 días). No inventar clima para esta fecha.",
      };
    }
  
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${OWM_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
  
    // Tomamos la entrada más cercana al mediodía de la fecha pedida
    const target = data.list.find((entry: any) => entry.dt_txt.startsWith(date));
    if (!target) return { city, date, available: false, note: "Sin datos para esa fecha específica" };
  
    return {
      city,
      date,
      available: true,
      tempC: target.main.temp,
      condition: target.weather[0].description,
    };
  }