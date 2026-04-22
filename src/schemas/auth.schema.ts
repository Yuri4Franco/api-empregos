import { z } from "zod";

// --- ÁTOMOS  ---
const UsuarioBaseSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
});

const SenhaForte = z
  .string()
  .min(6, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Deve conter ao menos um número")
  .regex(/[^a-zA-Z0-9]/, "Deve conter ao menos um caractere especial");

const SenhaPadrao = z
  .string()
  .min(6, "A senha deve ter no mínimo 6 caracteres");

const EnderecoSchema = z.object({
  uf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
});

export const TrocarSenha = z.object({
  nova_senha: SenhaForte,
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

export const AtualizarAdminSchema = z
  .object({
    nome: z.string().min(3).optional(),
    email: z.string().email().optional(),
    is_master: z.boolean().optional(),
    status: z.enum(["ATIVO", "BLOQUEADO", "INATIVO", "PENDENTE"]).optional(),
    senha: SenhaForte.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });

export const ResetSenhaSchema = z.object({
  novaSenha: SenhaForte, // Garante que a senha temporária também seja segura
});

// --- EXPORTS QUE VOCÊ JÁ USA ---

// 1. Para Criar Colaborador (Admin da Empresa)
export const ColaboradorSchema = UsuarioBaseSchema.extend({
  senha: z.string().min(6, "Mínimo 6 caracteres"),
});

export const CadastroAdminSchema = UsuarioBaseSchema.extend({
  senha: SenhaForte, // Aquela com maiúsculas, números e caracteres especiais
  is_master: z.boolean().default(false),
  id_empresa: z.number().int().optional().nullable(),
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
    .enum(["ASSOCIADA", "NAO_ASSOCIADA"])
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
  status: z.enum(["ATIVO", "BLOQUEADO"]).optional(),
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

export const vagaSchema = z.object({
  titulo: z.string().min(3),
  id_area_atuacao: z.number().int().min(1, "Área de atuação é obrigatória"),
  nivel_hierarquico: z.string(),
  modelo_trabalho: z.string(),
  tipo_contrato: z.string(),


  salario_de: z.number().optional().nullable(),
  salario_ate: z.number().optional().nullable(),
  salario_a_combinar: z.boolean().default(false),
  ocultar_salario: z.boolean().default(false),
  empresa_confidencial: z.boolean().default(false),

  // Textos
  descricao: z.string().min(10),
  responsabilidades: z.string().min(5),
  requisitos_obrigatorios: z.string().min(5),
  diferenciais: z.string().optional().default(""),

  // Endereço
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().default("PANAMBI").transform((val) => val.toUpperCase()),
  uf: z.string().length(2).default("RS"),

  // Arrays e Fluxo
  enviar_para_aprovacao: z.boolean().default(false),
  beneficios_ids: z.array(z.number()).default([]),
  perguntas_eliminatorias: z
    .array(
      z.object({
        id_pergunta: z.number(),
        resposta_esperada: z.boolean(),
      }),
    )
    .default([]),

  // Para o Admin cadastrar para outros
  id_empresa_alvo: z.number().int().optional(),

  // Etapas
  etapas: z
    .array(
      z.object({
        nome: z.string(),
        ordem: z.number().int(),
      }),
    )
    .optional(),
});

export const FiltroVagasEmpresaSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z
    .enum([
      "RASCUNHO",
      "EM_ANALISE",
      "ATIVA",
      "REPROVADA",
      "PAUSADA",
      "ENCERRADA",
    ])
    .optional(),
});

export const ModeracaoVagaSchema = z.object({
  acao: z.enum(["APROVAR", "REPROVAR"]),
  motivo: z
    .string()
    .optional()
    .refine((val) => {
      // Se a ação for REPROVAR, o motivo passa a ser obrigatório
      return true; // Podemos validar lógica condicional aqui se desejar
    }),
});

export const CreditosSchema = z
  .object({
    creditos_vagas: z.number().int().min(0).optional(),
    creditos_curriculos: z.number().int().min(0).optional(),
    modo: z.enum(["SOMAR", "DEFINIR"]).default("DEFINIR"),
  })
  .refine(
    (data) =>
      data.creditos_vagas !== undefined ||
      data.creditos_curriculos !== undefined,
    {},
  );

export const SolicitacaoMidiaSchema = z.object({
  id_vaga: z.number().int(),
  plataforma: z.enum(["Instagram", "LinkedIn", "Ambos"]),
  descricao: z.string().max(500).optional(),
});

export const GerenciarMidiaSchema = z.object({
  status: z.enum(["PENDENTE", "AGENDADO", "POSTADO", "RECUSADO"]),
  justificativa: z.string().optional(),
});

export const TaxonomiaSchema = z.object({
  nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres").max(100),
});

export const AtualizarPerfilEmpresaSchema = z.object({
  nome_fantasia: z.string().optional(),
  quem_somos: z
    .string()
    .max(2000, "O texto 'Quem Somos' é muito longo")
    .optional(),
  site: z.string().optional().or(z.literal("")),
  instagram: z.string().optional().or(z.literal("")),
  linkedin: z.string().optional().or(z.literal("")),
  facebook: z.string().optional().or(z.literal("")),
  beneficios_ids: z.array(z.number()).optional(),
});

export const AgendarEntrevistaSchema = z.object({
  data_hora: z.string().datetime({ message: "Data e hora inválidas" }),
  local_link: z
    .string()
    .min(5, "O local ou link deve ter pelo menos 5 caracteres"),
  observacoes: z.string().optional(),
});

export const ConfigurarDestaquesSchema = z.object({
  campos: z
    .array(z.string())
    .min(1, "Selecione pelo menos um campo para destaque"),
});

export const DashboardFiltroSchema = z.object({
  periodo_dias: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 30)),
});

export const CandidaturaSchema = z.object({
  id_vaga: z.number(),

  respostas: z
    .array(
      z.object({
        id_pergunta: z.number(),
        resposta: z.any(),
      }),
    )
    .min(
      1,
      "Você precisa responder às perguntas eliminatórias para se candidatar.",
    ),
});

export const RegisterCandidatoSchema = z
  .object({
    nome: z.string().min(3, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    senha: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "A senha deve conter letras")
      .regex(/[0-9]/, "A senha deve conter números")
      .regex(/[@#$!%*?&]/, "A senha deve conter um caractere especial"),
    confirmar_senha: z.string(),
    aceite_termos: z.boolean().refine((val) => val === true, {
      message: "Você deve aceitar os Termos de Uso e Política de Privacidade",
    }),
  })
  .refine((data) => data.senha === data.confirmar_senha, {
    message: "As senhas não coincidem",
    path: ["confirmar_senha"],
  });

export const updateCandidatoSchema = z.object({
  // Dados Pessoais
  cpf: z.string().length(11, "CPF deve ter 11 dígitos").optional().nullable(),
  telefone: z.string().min(10).optional().nullable(),
  whatsapp: z.string().min(10).optional().nullable(),
  data_nascimento: z.string().pipe(z.coerce.date()).optional().nullable(),
  genero: z.string().optional().nullable(),

  // Links e Social
  link_linkedin: z
    .string()
    .url("URL inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  link_portfolio: z
    .string()
    .url("URL inválida")
    .optional()
    .nullable()
    .or(z.literal("")),

  // Profissional
  objetivo_profissional: z.string().max(200).optional().nullable(),
  pretensao_salarial: z.number().positive().optional().nullable(),
  resumo_profissional: z.string().min(20).optional().nullable(),
  id_area_atuacao: z.number().int().optional().nullable(),

  // Preferências
  disponibilidade_viagem: z.boolean().optional(),
  disponibilidade_mudanca: z.boolean().optional(),
  turno_preferido: z
    .enum(["MATUTINO", "DIURNO", "NOTURNO", "VESPERTINO", "SEM_PREFERENCIA"])
    .optional()
    .nullable(),
  pcd: z.boolean().optional(),
  tipo_pcd: z.string().optional().nullable(),

  // Endereço (Nested)
  endereco: z
    .object({
      logradouro: z.string().min(3),
      numero: z.string(),
      complemento: z.string().optional().nullable(),
      bairro: z.string().min(2),
      cidade: z.string().default("Panambi"),
      uf: z.string().length(2).default("RS"),
      cep: z.string().length(8),
    })
    .optional(),
});

export const experienciaSchema = z
  .object({
    empresa: z.string().min(2, "Nome da empresa é obrigatório"),
    cargo: z.string().min(2, "Cargo é obrigatório"),
    atividades: z
      .string()
      .max(1000, "Resumo de atividades muito longo")
      .optional()
      .nullable(),
    data_inicio: z.string().pipe(z.coerce.date()),
    data_fim: z.string().pipe(z.coerce.date()).optional().nullable(),
    atual: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (!data.atual && !data.data_fim) return false;
      return true;
    },
    {
      message: "Data de fim é obrigatória se não for o emprego atual",
      path: ["data_fim"],
    },
  );

export const formacaoSchema = z
  .object({
    instituicao: z.string().min(2, "Nome da instituição é obrigatório"),
    nivel: z.string().min(2, "Nível de escolaridade é obrigatório"), // Ex: Ensino Médio, Superior, Técnico
    curso: z.string().min(2, "Nome do curso é obrigatório"),
    status: z.string().min(2, "Status é obrigatório"), // Ex: Concluído, Cursando, Trancado
    data_conclusao: z.string().pipe(z.coerce.date()).optional().nullable(),
  })
  .refine(
    (data) => {
      // Regra inteligente: Se marcou como concluído, tem que ter a data.
      if (data.status.toUpperCase() === "CONCLUÍDO" && !data.data_conclusao) {
        return false;
      }
      return true;
    },
    {
      message: "A data de conclusão é obrigatória para cursos concluídos.",
      path: ["data_conclusao"],
    },
  );

export const candidatoCompetenciaSchema = z.object({
  id_competencia: z.number().int().positive("Competência inválida"),
  nivel: z
    .enum(["BASICO", "INTERMEDIARIO", "AVANCADO", "ESPECIALISTA"])
    .default("INTERMEDIARIO"),
});

export const visibilidadeSchema = z.object({
  perfil_visivel_empresas: z.boolean({
    message: "O status de visibilidade é obrigatório e deve ser verdadeiro ou falso.",
  }),
});

export const AtualizarDadosEmpresaSchema = z.object({
  razao_social: z.string().min(3, "Razão social muito curta"),
  nome_fantasia: z.string().min(2, "Nome fantasia muito curto"),
  email_institucional: z
    .string()
    .email("E-mail institucional inválido")
    .nullable(),
  tipo_vinculo_aci: z.enum(["ASSOCIADA", "NAO_ASSOCIADA"]).optional(),
  // Dados de Endereço
  logradouro: z.string().min(3, "Logradouro obrigatório"),
  numero: z.string().min(1, "Número obrigatório"),
  complemento: z.string().nullable().optional(),
  cep: z.string().min(8, "CEP inválido"),
  cidade: z.string().default("Panambi"),
  uf: z.string().length(2).default("RS"),
  bairro: z.string().min(2, "Bairro obrigatório"),
});

export const candidatoAreaSchema = z.object({
  id_area: z.number().int().positive("Área de atuação inválida"),
});


