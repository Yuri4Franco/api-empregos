ALTER TABLE "candidatos" ALTER COLUMN "turno_preferido" DROP DEFAULT;

ALTER TABLE "candidatos" 
ALTER COLUMN "turno_preferido" TYPE "TurnoPreferido"[] 
USING ARRAY["turno_preferido"]::"TurnoPreferido"[]; 