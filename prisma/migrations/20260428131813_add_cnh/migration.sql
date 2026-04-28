-- CreateEnum
CREATE TYPE "TipoCnh" AS ENUM ('NAO_POSSUO', 'A', 'B', 'C', 'D', 'E');

-- AlterTable
ALTER TABLE "candidatos" ADD COLUMN     "cnh" "TipoCnh"[];
