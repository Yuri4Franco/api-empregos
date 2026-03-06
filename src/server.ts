import express from "express";
import "dotenv/config";
import { prisma } from "./config/prisma"; // Importando nossa instância configurada
import routes from "./routes/index.js";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "*" , // URL do seu frontend (ex: Vite)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.use(routes);

const PORT = process.env.PORT || 3000;

app.get("/health", async (req, res) => {
  try {
    // Testamos se o Prisma consegue falar com o banco
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
