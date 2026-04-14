import type { Request, Response, NextFunction } from "express";

export const validatePhotoUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhuma imagem foi enviada." });
  }

  // Validar extensão (opcional, já que o Multer/Cloudinary filtram, mas é boa prática)
  const allowedMimetypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimetypes.includes(req.file.mimetype)) {
    return res
      .status(400)
      .json({ error: "Formato de arquivo inválido. Use JPG, PNG ou WebP." });
  }

  next();
};
