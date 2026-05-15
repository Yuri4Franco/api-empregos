import express from "express";
import "dotenv/config";
import { prisma } from "./config/prisma";
import routes from "./routes/index.js";
import cors from "cors";
import helmet from "helmet";
import { globalLimiter } from "./middlewares/rateLimiter";

// Importações do Sentry
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const app = express();

// (As linhas antigas requestHandler e tracingHandler foram removidas daqui)

app.set("trust proxy", 1); 
app.use(globalLimiter);

app.use(helmet());

const origensPermitidas = [
  "https://acivagas.com.br",
  "http://acivagas.com.br",
  "https://www.acivagas.com.br",
  "http://www.acivagas.com.br"
];

if (process.env.NODE_ENV !== 'production') {
  origensPermitidas.push("http://localhost:3000");
}

app.use(
  cors({
    origin: origensPermitidas,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json());

app.use(routes);

Sentry.setupExpressErrorHandler(app);

// Seu middleware customizado
app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: "Erro interno do servidor" });
});

const PORT = process.env.PORT || 3333;

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT} 🚀`);
});