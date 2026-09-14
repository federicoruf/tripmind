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

app.use(
    cors({
    origin: "http://localhost:5173", // el puerto de tu frontend Vite
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/itinerary", itinerary);

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
