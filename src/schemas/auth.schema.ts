import { z } from "zod";

// --- ÁTOMOS (Base para evitar repetição) ---
const UsuarioBaseSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
});

const EnderecoSchema = z.object({
  uf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
});

const CandidatoBaseSchema = z.object({
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  data_nascimento: z.coerce.date().optional().nullable(),
  genero: z.string().optional().nullable(),
  pcd: z.boolean().default(false),
  tipo_pcd: z.string().optional().nullable(),
});

export const ExperienciaSchema = z.object({
  empresa: z.string().min(1, "Empresa é obrigatória"),
  cargo: z.string().min(1, "Cargo é obrigatório"),
  atividades: z.string().optional().nullable(),
  data_inicio: z.coerce.date({ message: "Data de início inválida" }),
  data_fim: z.coerce.date().optional().nullable(),
  atual: z.boolean().default(false),
});

export const FormacaoSchema = z.object({
  instituicao: z.string().min(1, "Instituição é obrigatória"),
  nivel: z.string().min(1, "Nível é obrigatório"),
  curso: z.string().min(1, "Curso é obrigatório"),
  status: z.string().min(1, "Status é obrigatório"),
  data_conclusao: z.coerce.date().optional().nullable(),
});

export const VincularCompetenciaSchema = z.object({
  id_competencia: z.coerce
    .number()
    .int()
    .positive("ID da competência inválido"),
  nivel: z.enum(["BASICO", "INTERMEDIARIO", "AVANCADO"]),
});

// --- EXPORTS QUE VOCÊ JÁ USA ---

// 1. Para Criar Colaborador (Admin da Empresa)
export const ColaboradorSchema = UsuarioBaseSchema.extend({
  senha: z.string().min(6, "Mínimo 6 caracteres"),
});

// 2. Para Criar Empresa (Formulário completo)
export const EmpresaSchema = UsuarioBaseSchema.extend({
  senha: z.string().min(8, "Mínimo 8 caracteres"),
  razao_social: z.string().min(1, "Obrigatória"),
  nome_fantasia: z.string().min(1, "Obrigatório"),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ inválido"),
  tipo_vinculo_aci: z
    .enum(["ASSOCIADA", "NAO_ASSOCIADA", "PARCEIRA"])
    .default("NAO_ASSOCIADA"),
}).merge(EnderecoSchema);

// 3. Para Atualizar Dados Básicos do Usuário (PUT /admin/usuarios/:id)
export const AtualizarUsuarioSchema = z
  .object({
    nome: z.string().min(3).optional(),
    email: z.string().email().optional(),
    senha: z.string().min(6).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo");

// 4. Para o Perfil do Candidato (O JSON gigante com experiências/formações)
export const AtualizarPerfilCompletoSchema = z.object({
  nome: z.string().optional(),
  email: z.string().optional(),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .optional(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  // ... (coloque os outros campos de candidato aqui)
  experiencias: z.array(z.any()).optional(), // Pode detalhar como fizemos antes
  formacoes: z.array(z.any()).optional(),
  competencias: z.array(z.any()).optional(),
});

// 5. Filtros e Listagens
export const QueryListagemSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  search: z.string().optional(),
});

export const FiltroUsuarioSchema = QueryListagemSchema.extend({
  cidade: z.string().optional(),
  status: z.enum(["ATIVO", "BLOQUEADO", "PENDENTE", "INATIVO"]).optional(),
});

export const cadastroCandidatoManualSchema = UsuarioBaseSchema.extend({
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
})
  .merge(CandidatoBaseSchema) // Aquele que tem o CPF com transform
  .merge(EnderecoSchema) // Aquele que tem cidade, uf, bairro...
  .extend({
    perfil_visivel_empresas: z.boolean().default(true),
  });

// 6. IDs e Status (Params e Enums)
export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive("ID inválido"),
});

export const StatusEmpresaSchema = z.object({
  acao: z.enum(["ATIVAR", "DESATIVAR"] as const),
});

export const StatusUsuarioSchema = z.object({
  status: z.enum(["ATIVO", "BLOQUEADO", "INATIVO", "PENDENTE"] as const),
});
