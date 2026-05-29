/*
  Warnings:

  - The values [PRIMEIRO_TURNO,SEGUNDO_TURNO,TERCEIRO_TURNO,HORARIO_COMERCIAL] on the enum `TurnoPreferido` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TurnoPreferido_new" AS ENUM ('MANHÃ', 'TARDE', 'NOITE', 'COMERCIAL', 'QUALQUER_TURNO');
ALTER TABLE "candidatos" ALTER COLUMN "turno_preferido" TYPE "TurnoPreferido_new"[] USING ("turno_preferido"::text::"TurnoPreferido_new"[]);
ALTER TYPE "TurnoPreferido" RENAME TO "TurnoPreferido_old";
ALTER TYPE "TurnoPreferido_new" RENAME TO "TurnoPreferido";
DROP TYPE "public"."TurnoPreferido_old";
COMMIT;
