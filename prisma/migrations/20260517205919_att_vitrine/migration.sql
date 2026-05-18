-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "instrucoes_candidatura" TEXT,
ADD COLUMN     "link_externo" TEXT,
ADD COLUMN     "vaga_externa" BOOLEAN DEFAULT false;
