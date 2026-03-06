/*
  Warnings:

  - The values [INATIVO] on the enum `StatusGeral` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusGeral_new" AS ENUM ('ATIVO', 'PENDENTE', 'BLOQUEADO');
ALTER TABLE "public"."usuarios" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "status" TYPE "StatusGeral_new" USING ("status"::text::"StatusGeral_new");
ALTER TYPE "StatusGeral" RENAME TO "StatusGeral_old";
ALTER TYPE "StatusGeral_new" RENAME TO "StatusGeral";
DROP TYPE "public"."StatusGeral_old";
ALTER TABLE "usuarios" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;
