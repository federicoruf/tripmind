import dotenv from "dotenv";
import cors from "cors";
import express, { Request, Response } from "express";
import itinerary from "./routes/itinerary";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Falta la variable de entorno GEMINI_API_KEY");
}

const app = express();

// En local usa el puerto por defecto de Vite. En producción, seteá
// FRONTEND_URL con la URL real del frontend deployado.
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
    cors({
    origin: frontendUrl,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/itinerary", itinerary);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
