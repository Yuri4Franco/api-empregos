-- CreateEnum
CREATE TYPE "StatusCompetencia" AS ENUM ('APROVADA', 'PENDENTE', 'REJEITADA');

-- AlterTable
ALTER TABLE "competencias" ADD COLUMN     "status" "StatusCompetencia" NOT NULL DEFAULT 'APROVADA';
