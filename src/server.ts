import express from "express";
import "dotenv/config";

import routes from "./routes/index.js";
import cors from "cors";
import helmet from "helmet";

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { prisma } from "./config/prisma.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";

const app = express();

app.set("trust proxy", 1);

app.use(globalLimiter);

app.use(helmet());

const origensPermitidas = [
  "https://acivagas.com.br",
  "http://acivagas.com.br",
  "https://www.acivagas.com.br",
  "http://www.acivagas.com.br",
];

if (process.env.NODE_ENV !== "production") {
  origensPermitidas.push("http://localhost:3000");
}

app.use(
  cors({
    origin: origensPermitidas,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

app.use(routes);

Sentry.setupExpressErrorHandler(app);

// Seu middleware customizado
app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: "Erro interno do servidor" });
});



app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

const port = Number(process.env.PORT) || 3333;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`Servidor rodando em http://${host}:${port}`);
});
