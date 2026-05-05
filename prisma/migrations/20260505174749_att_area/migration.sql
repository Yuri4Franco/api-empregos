-- DropForeignKey
ALTER TABLE "vagas" DROP CONSTRAINT "vagas_id_area_atuacao_fkey";

-- AlterTable
ALTER TABLE "vagas" ALTER COLUMN "id_area_atuacao" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_id_area_atuacao_fkey" FOREIGN KEY ("id_area_atuacao") REFERENCES "taxonomia_areas"("id_area") ON DELETE SET NULL ON UPDATE CASCADE;
