/*
  Warnings:

  - You are about to drop the column `notificacao_pendente` on the `candidaturas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "candidaturas" DROP COLUMN "notificacao_pendente";

-- AlterTable
ALTER TABLE "movimentos_candidatura" ADD COLUMN     "notificacao_pendente" BOOLEAN NOT NULL DEFAULT true;
