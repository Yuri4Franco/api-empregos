/*
  Warnings:

  - You are about to drop the column `bairro` on the `vagas` table. All the data in the column will be lost.
  - Added the required column `endereco` to the `vagas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "bairro",
ADD COLUMN     "endereco" TEXT NOT NULL;
