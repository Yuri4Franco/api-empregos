/*
  Warnings:

  - You are about to drop the column `bairro` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `area_profissional` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `bairro` on the `vagas` table. All the data in the column will be lost.
  - Added the required column `id_area_atuacao` to the `vagas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "bairro",
ADD COLUMN     "id_area_atuacao" INTEGER,
ADD COLUMN     "id_bairro" INTEGER;

-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "area_profissional",
DROP COLUMN "bairro",
ADD COLUMN     "id_area_atuacao" INTEGER NOT NULL,
ADD COLUMN     "id_bairro" INTEGER;

-- CreateTable
CREATE TABLE "taxonomia_bairros" (
    "id_bairro" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "taxonomia_bairros_pkey" PRIMARY KEY ("id_bairro")
);

-- CreateTable
CREATE TABLE "taxonomia_areas" (
    "id_area" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "taxonomia_areas_pkey" PRIMARY KEY ("id_area")
);

-- CreateIndex
CREATE UNIQUE INDEX "taxonomia_bairros_nome_key" ON "taxonomia_bairros"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomia_areas_nome_key" ON "taxonomia_areas"("nome");

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_id_bairro_fkey" FOREIGN KEY ("id_bairro") REFERENCES "taxonomia_bairros"("id_bairro") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_id_area_atuacao_fkey" FOREIGN KEY ("id_area_atuacao") REFERENCES "taxonomia_areas"("id_area") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_id_bairro_fkey" FOREIGN KEY ("id_bairro") REFERENCES "taxonomia_bairros"("id_bairro") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_id_area_atuacao_fkey" FOREIGN KEY ("id_area_atuacao") REFERENCES "taxonomia_areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;
