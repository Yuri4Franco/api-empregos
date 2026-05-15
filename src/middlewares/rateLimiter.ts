import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: { success: false, error: "Tráfego intenso detectado. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de acesso. Aguarde 15 minutos." },
});


export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: "Limite de envios atingido. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});