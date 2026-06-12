/*
  Warnings:

  - You are about to drop the column `data_aviso_inativacao` on the `usuarios` table. All the data in the column will be lost.
  - You are about to drop the column `ultima_atividade_candidato` on the `usuarios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "data_aviso_inativacao",
DROP COLUMN "ultima_atividade_candidato",
ADD COLUMN     "ultima_atividade" TIMESTAMP(3);
