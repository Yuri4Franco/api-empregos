/*
  Warnings:

  - You are about to drop the column `cidade` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `id_bairro` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `logradouro` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `numero` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `uf` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `bairro` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `cidade` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `logradouro` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `numero` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `uf` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `cidade` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `id_bairro` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `logradouro` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `numero` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `uf` on the `vagas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id_endereco]` on the table `candidatos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_endereco]` on the table `empresas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_endereco]` on the table `vagas` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "candidatos" DROP CONSTRAINT "candidatos_id_bairro_fkey";

-- DropForeignKey
ALTER TABLE "vagas" DROP CONSTRAINT "vagas_id_bairro_fkey";

-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "cidade",
DROP COLUMN "id_bairro",
DROP COLUMN "logradouro",
DROP COLUMN "numero",
DROP COLUMN "uf",
ADD COLUMN     "id_endereco" INTEGER;

-- AlterTable
ALTER TABLE "empresas" DROP COLUMN "bairro",
DROP COLUMN "cidade",
DROP COLUMN "logradouro",
DROP COLUMN "numero",
DROP COLUMN "uf",
ADD COLUMN     "id_endereco" INTEGER;

-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "cidade",
DROP COLUMN "id_bairro",
DROP COLUMN "logradouro",
DROP COLUMN "numero",
DROP COLUMN "uf",
ADD COLUMN     "id_endereco" INTEGER;

-- CreateTable
CREATE TABLE "enderecos" (
    "id_endereco" SERIAL NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "cep" TEXT,
    "cidade" TEXT NOT NULL DEFAULT 'Panambi',
    "uf" TEXT NOT NULL DEFAULT 'RS',
    "id_bairro" INTEGER,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id_endereco")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidatos_id_endereco_key" ON "candidatos"("id_endereco");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_id_endereco_key" ON "empresas"("id_endereco");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_id_endereco_key" ON "vagas"("id_endereco");

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_id_bairro_fkey" FOREIGN KEY ("id_bairro") REFERENCES "taxonomia_bairros"("id_bairro") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_id_endereco_fkey" FOREIGN KEY ("id_endereco") REFERENCES "enderecos"("id_endereco") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_id_endereco_fkey" FOREIGN KEY ("id_endereco") REFERENCES "enderecos"("id_endereco") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_id_endereco_fkey" FOREIGN KEY ("id_endereco") REFERENCES "enderecos"("id_endereco") ON DELETE SET NULL ON UPDATE CASCADE;
