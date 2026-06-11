/*
  Warnings:

  - A unique constraint covering the columns `[token_troca_email]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "data_aviso_inativacao" TIMESTAMP(3),
ADD COLUMN     "data_aviso_inativo" TIMESTAMP(3),
ADD COLUMN     "motivo_inativacao" TEXT,
ADD COLUMN     "token_troca_email" TEXT,
ADD COLUMN     "ultima_atividade_candidato" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "logs_disparos_jobs" (
    "id_log" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "data_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_disparos_jobs_pkey" PRIMARY KEY ("id_log")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_troca_email_key" ON "usuarios"("token_troca_email");

-- AddForeignKey
ALTER TABLE "logs_disparos_jobs" ADD CONSTRAINT "logs_disparos_jobs_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
