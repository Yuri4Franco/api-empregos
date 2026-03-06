/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `empresas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "email" TEXT,
ADD COLUMN     "facebook" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "exigir_troca_senha" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_key" ON "empresas"("email");
