declare namespace Express {
  export interface Request {
    user: {
      id: number;
      role: "CANDIDATO" | "EMPRESA" | "ADM";
      is_master: boolean; 
    };
  }
}
