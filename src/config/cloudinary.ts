import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME!,
  api_key: process.env.CLOUDINARY_KEY!,
  api_secret: process.env.CLOUDINARY_SECRET!,
});

const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'acivagas_banners',
      format: 'webp',
      transformation: [
        { width: 1200, height: 400, crop: 'fill', gravity: 'center', quality: 'auto' }
      ],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

// 2. Configuração para Logos (Proporcional + Qualidade Auto)
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'acivagas_logos',
      format: 'webp',
      transformation: [
        { width: 400, height: 400, crop: 'limit', quality: 'auto' }
      ],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

// 3. Configuração para Candidatos (Quadrado/Perfil)
const candidateStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'acivagas_candidatos',
      format: 'webp',
      transformation: [
        { width: 300, height: 300, crop: 'thumb', gravity: 'face', quality: 'auto' }
      ],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

export { cloudinary, bannerStorage, logoStorage, candidateStorage };
