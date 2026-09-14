# Inicio del frontend

```bash
npm run dev
```

# Inicio del backend

```bash
npm run dev
```

# Inicio de la base de datos

## Requisitos

```bash
npm install -g chromadb
```

```bash
chroma run --host localhost --port 8000 --path ./chroma-data
```

Si el comando  no funciona, instar mediante python
```bash
pip install chromadb
```
Y desinstalar la versión de npm
```bash
npm install -g chromadb
```

Y si pyhton ha fallado, instalar un contenedor de chroma
```bash	
docker run -d --rm --name chromadb -p 8000:8000 -v ./chroma-data:/data chromadb/chroma:1.5.3
```
Iniciar el contenedor con este comando
```bash	
docker run -d -p 8000:8000 chromadb/chroma:1.5.3
```

Verificar que funciona
```bash
doker ps
```
Hacer una consulta a la base de datos
```bash
curl http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections
```

Eliminar la colección
```bash
curl -X DELETE http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/tripmind_guides
```

# Pruebas
## /stream
```bash
cat > /tmp/body.json << 'EOF'
{"prompt": "Hola, quiero planear un viaje a Lisboa de 3 días en octubre. ¿Hace mucho frío?"}
EOF

curl -N -X POST -H "Content-Type: application/json" --data-binary @/tmp/body.json http://localhost:3000/api/itinerary/stream
``

# TripMind — Evaluación semántica (Golden Dataset)

## Qué es cada archivo
- `golden-dataset.json`: 15 casos de prueba (input del usuario + criterios que el itinerario debe cumplir).
- `eval-runner.ts`: corre cada caso, aplica chequeos determinísticos y un LLM-as-judge que da un score 1-5.
- `package.json`: dependencias mínimas.

## Antes de correrlo
En `eval-runner.ts`, reemplazá la función `generateItinerary(input)` (línea marcada con `TODO`) por la llamada real a tu backend/LLM de TripMind. Tiene que devolver un array así:

```json
[
  { "dia": 1, "actividades": [{ "titulo": "...", "hora": "...", "descripcion": "..." }] }
]
```

## Cómo correrlo

```bash
npm install
export GEMINI_API_KEY=...
npm run eval
```

Nota: el modelo juez está fijado a `gemini-2.5-flash` en `MODELO_JUEZ` (en `eval-runner.ts`). Cambialo si usás otro modelo de Gemini.

## Qué hace el reporte
- Muestra score 1-5 por caso y la razón del juez.
- Marca qué chequeos determinísticos fallaron (estructura, días duplicados, etc.).
- Al final da un promedio general. Si está por debajo de 3.5 (ajustable en `UMBRAL_MINIMO`), el script termina con error — útil para bloquear un deploy en CI.

## Siguiente paso sugerido
Agregar este script a GitHub Actions para que corra en cada PR que toque el prompt o la lógica de generación de itinerarios.

## Judge model
Con el modelo "gemini-3.1-flash-lite" se ejecutan todas las evaluaciones, sin embargo hubo que poner un tiempo muerto de espera para no saturar la api
En cambio con el modelo "gemini-3.6-flash" el tiempo de espera no fue suficiente y se quedo sin cuota disponible para ejecutar el resto de las evaluaciones ```GenerateRequestsPerMinutePerProjectPerModel```


