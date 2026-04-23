-- CreateEnum
CREATE TYPE "TipoDiversidade" AS ENUM ('AMPLA_CONCORRENCIA', 'VAGA_INCLUSIVA', 'EXCLUSIVA_PCD');

-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "tipo_diversidade" "TipoDiversidade" NOT NULL DEFAULT 'AMPLA_CONCORRENCIA';
