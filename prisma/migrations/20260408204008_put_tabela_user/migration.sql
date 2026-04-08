/*
  Warnings:

  - A unique constraint covering the columns `[token_ativacao]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token_recuperar]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "expira_token" TIMESTAMP(3),
ADD COLUMN     "token_ativacao" TEXT,
ADD COLUMN     "token_recuperar" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_ativacao_key" ON "usuarios"("token_ativacao");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_recuperar_key" ON "usuarios"("token_recuperar");
