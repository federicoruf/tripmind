# Backend de TripMind — pensado para Cloud Run
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- imagen final, más liviana, sin devDependencies ---
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Cloud Run inyecta PORT en runtime; no hace falta EXPOSE fijo,
# pero lo dejamos como documentación.
EXPOSE 8080

CMD ["node", "dist/index.js"]
