/*
  Warnings:

  - A unique constraint covering the columns `[token_confirmar_email]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "token_confirmar_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_confirmar_email_key" ON "usuarios"("token_confirmar_email");
