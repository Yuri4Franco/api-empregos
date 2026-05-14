import express from "express";
import "dotenv/config";
import { prisma } from "./config/prisma";
import routes from "./routes/index.js";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: [
      "http://acivagas.com.br",
      "https://acivagas.com.br",
      "http://www.acivagas.com.br",
      "https://www.acivagas.com.br",
      "http://localhost:3000" 
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);
app.use(express.json());

app.use(routes);

const PORT = process.env.PORT || 4000;

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
