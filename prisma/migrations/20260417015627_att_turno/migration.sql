/*
  Warnings:

  - The `turno_preferido` column on the `candidatos` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MATUTINO', 'VESPERTINO', 'NOTURNO', 'DIURNO', 'SEM_PREFERENCIA');

-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "turno_preferido",
ADD COLUMN     "turno_preferido" "Turno";
