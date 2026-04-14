import multer from "multer";
import {
  bannerStorage,
  logoStorage,
  candidateStorage,
} from "../config/cloudinary.js";

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Formato de arquivo inválido. Envie apenas imagens."), false);
  }
};

export const uploadBanner = multer({ storage: bannerStorage, fileFilter });
export const uploadLogo = multer({ storage: logoStorage, fileFilter });
export const uploadCandidato = multer({
  storage: candidateStorage,
  fileFilter,
});
