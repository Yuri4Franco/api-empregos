/*
  Warnings:

  - You are about to drop the column `dispoibilidade_sabados` on the `candidatos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "dispoibilidade_sabados",
ADD COLUMN     "disponibilidade_sabados" BOOLEAN NOT NULL DEFAULT false;
