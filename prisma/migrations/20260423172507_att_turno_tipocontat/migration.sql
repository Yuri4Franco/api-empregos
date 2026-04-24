/*
  Warnings:

  - The `turno_preferido` column on the `candidatos` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TurnoPreferido" AS ENUM ('PRIMEIRO_TURNO', 'SEGUNDO_TURNO', 'TERCEIRO_TURNO', 'HORARIO_COMERCIAL', 'QUALQUER_TURNO');

-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "turno_preferido",
ADD COLUMN     "turno_preferido" "TurnoPreferido" DEFAULT 'QUALQUER_TURNO';

-- DropEnum
DROP TYPE "Turno";
