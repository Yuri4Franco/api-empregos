/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `empresas` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `empresas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");
