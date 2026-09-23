import dotenv from "dotenv";
dotenv.config();
import "./instrumentation";
import cors from "cors";
import express, { Request, Response } from "express";
import itinerary from "./routes/itinerary";
import image from "./routes/image";


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

// /api/image recibe la imagen en base64, que pesa más que el default de
// 100kb de express.json(); se le da un límite propio antes del general.
app.use("/api/image", express.json({ limit: "8mb" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/itinerary", itinerary);
app.use("/api/image", image);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
