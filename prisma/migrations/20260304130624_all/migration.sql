/*
  Warnings:

  - You are about to drop the column `endereco` on the `vagas` table. All the data in the column will be lost.
  - Added the required column `uf` to the `vagas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "StatusVaga" ADD VALUE 'REPROVADA';

-- AlterTable
ALTER TABLE "candidatos" ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" TEXT;

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" TEXT;

-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "endereco",
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" TEXT NOT NULL;
