/*
  Warnings:

  - You are about to drop the column `id_area_atuacao` on the `candidatos` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "candidatos" DROP CONSTRAINT "candidatos_id_area_atuacao_fkey";

-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "id_area_atuacao";

-- CreateTable
CREATE TABLE "candidato_areas_atuacao" (
    "id_candidato" INTEGER NOT NULL,
    "id_area" INTEGER NOT NULL,

    CONSTRAINT "candidato_areas_atuacao_pkey" PRIMARY KEY ("id_candidato","id_area")
);

-- AddForeignKey
ALTER TABLE "candidato_areas_atuacao" ADD CONSTRAINT "candidato_areas_atuacao_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidato_areas_atuacao" ADD CONSTRAINT "candidato_areas_atuacao_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "taxonomia_areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;
