/*
  Warnings:

  - Added the required column `observacoes_admin` to the `vagas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "observacoes_admin" TEXT NOT NULL;
