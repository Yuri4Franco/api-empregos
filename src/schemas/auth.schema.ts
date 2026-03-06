import { z } from "zod";

const UsuarioBaseSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

const EnderecoSchema = z.object({
  uf: z.string().length(2, "UF deve ter 2 caracteres"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
});

export const ColaboradorSchema = UsuarioBaseSchema;

export const EmpresaSchema = UsuarioBaseSchema.extend({
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length === 14, "CNPJ deve ter 14 dígitos"),

  email_institucional: z
    .string()
    .email("E-mail institucional inválido")
    .optional()
    .nullable(),
  tipo_vinculo_aci: z
    .enum(["ASSOCIADA", "NAO_ASSOCIADA", "PARCEIRA"])
    .default("NAO_ASSOCIADA"),
}).merge(EnderecoSchema);

export const QueryListagemSchema = z.object({
  // Coagimos (coerce) o valor para número, pois da URL ele sempre vem como string
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive("ID inválido"),
});

export const StatusEmpresaSchema = z.object({
  acao: z.enum(["ATIVAR", "DESATIVAR"] as const),
});


const STATUS_VALIDOS = ["ATIVO", "BLOQUEADO", "INATIVO"] as const;

export const StatusUsuarioSchema = z.object({
  status: z.enum([...STATUS_VALIDOS] as const),
});

export const FiltroUsuarioSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(), // Nome, Email ou Nome da Empresa
  status: z.enum(["ATIVO", "BLOQUEADO", "INATIVO"]).optional(),
});

export const AtualizarUsuarioSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Nenhum dado informado para atualização."
});

// Schema para atualização de créditos
export const CreditosSchema = z.object({
  v: z.number().int().min(0).optional(), // Vagas
  c: z.number().int().min(0).optional(), // Currículos
  modo: z.enum(["SOMAR", "DEFINIR"]),
});

export const cadastroAdminSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Deve conter ao menos um número")
    .regex(/[^a-zA-Z0-9]/, "Deve conter ao menos um caractere especial"),
});

export const cadastroCandidatoManualSchema = z.object({
  // Dados de Usuário
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),

  // Dados de Perfil (Novo Model)
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),

  // Endereço Desmembrado
  uf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),

  // Perfil Profissional
  data_nascimento: z.string().optional().nullable(),
  genero: z.string().optional(),
  pcd: z.boolean().default(false),
  tipo_pcd: z.string().optional(),
  perfil_visivel_empresas: z.boolean().default(true),
});

export const cadastroEmpresaPorAdminSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),

  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos"),
  razao_social: z.string().min(1, "Razão Social é obrigatória"),
  nome_fantasia: z.string().min(1, "Nome Fantasia é obrigatório"),
  email_institucional: z
    .string()
    .email("E-mail institucional inválido")
    .optional(),
  tipo_vinculo_aci: z.enum(["ASSOCIADA", "NAO_ASSOCIADA"]),

  // Endereço Empresa
  uf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),

  creditos_vagas: z.number().int().min(0).default(0),
  creditos_curriculos: z.number().int().min(0).default(0),
});

export const vagaSchema = z.object({
  // Etapa 1 e 2: Dados Básicos e Localização
  titulo: z.string().min(3, "O título deve ter pelo menos 3 caracteres"),
  area_professional: z.string().min(1, "Selecione uma área profissional"),
  nivel_hierarquico: z.string().min(1, "Selecione o nível hierárquico"),

  // Localização Desmembrada conforme o novo Model
  cidade: z.string().min(1, "A cidade é obrigatória"),
  uf: z.string().length(2, "UF é obrigatória"),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),

  modelo_trabalho: z.enum(["PRESENCIAL", "HIBRIDO", "REMOTO"]),
  tipo_contrato: z.enum(["CLT", "PJ", "ESTAGIO", "TEMPORARIO"]),

  // Financeiro
  salario_a_combinar: z.boolean().default(false),
  faixa_salarial_de: z.number().optional().nullable(),
  faixa_salarial_ate: z.number().optional().nullable(),
  ocultar_salario: z.boolean().default(false),

  // Conteúdo (Rich Text)
  descricao: z.string().min(10, "Descreva bem a oportunidade"),
  responsabilidades: z.string().optional(),
  requisitos_obrigatorios: z.string().optional(),
  diferenciais: z.string().optional(),

  // Configurações
  empresa_confidencial: z.boolean().default(false),
  enviar_para_aprovacao: z.boolean().default(false), // Gatilho para mudar status de RASCUNHO para EM_ANALISE

  // Etapa 3: Triagem e Kanban
  etapas: z
    .array(
      z.object({
        nome: z.string(),
        ordem: z.number(),
        tipo: z.enum(["INICIAL", "INTERMEDIARIA", "FINAL"]),
        requer_agendamento: z.boolean().optional(),
      }),
    )
    .optional(),

  perguntas: z
    .array(
      z.object({
        id_pergunta: z.number(),
        resposta_esperada: z.string(),
      }),
    )
    .optional(),
});
