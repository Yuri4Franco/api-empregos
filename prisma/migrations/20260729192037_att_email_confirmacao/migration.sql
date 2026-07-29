-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "email_confirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_pendente" TEXT;
