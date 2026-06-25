declare namespace Express {
  export interface Request {
    user: {
      id: number;
      role: "CANDIDATO" | "EMPRESA" | "ADM";
      is_master: boolean; 
      id_empresa: number | null;
      exigir_troca_senha: boolean;
    };
  }
}