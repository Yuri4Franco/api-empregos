/*
  Warnings:

  - You are about to drop the column `id_bairro` on the `enderecos` table. All the data in the column will be lost.
  - You are about to drop the `taxonomia_bairros` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "enderecos" DROP CONSTRAINT "enderecos_id_bairro_fkey";

-- AlterTable
ALTER TABLE "enderecos" DROP COLUMN "id_bairro",
ADD COLUMN     "bairro" TEXT,
ALTER COLUMN "cidade" DROP NOT NULL,
ALTER COLUMN "uf" DROP NOT NULL;

-- DropTable
DROP TABLE "taxonomia_bairros";
