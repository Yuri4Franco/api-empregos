import { z } from "zod";
import { validarCPF } from "../types/validarCpf.js";

// --- ÁTOMOS  ---
const UsuarioBaseSchema = z.object({
  nome: z
    .string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")

    .regex(
      /^[a-zA-ZÀ-ÿ\s\-']+$/,
      "O nome não deve conter números ou caracteres inválidos",
    )
    .transform((nome) => {
      return nome
        .trim()
        .split(/\s+/)
        .map((palavra, index) => {
          const lower = palavra.toLowerCase();
          const excecoes = ["de", "da", "do", "das", "dos", "e"];
          if (index > 0 && excecoes.includes(lower)) {
            return lower;
          }
          if (lower.includes("-")) {
            return lower
              .split("-")
              .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
              .join("-");
          }

          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ");
    }),

  email: z
    .string()
    .email("E-mail inválido")
    .transform((email) => email.trim().toLowerCase()),
});

const SenhaForte = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[a-z]/, "Deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Deve conter ao menos um número")
  .regex(/[^a-zA-Z0-9]/, "Deve conter ao menos um caractere especial");

const EnderecoSchema = z.object({
  uf: z.string().length(2, "UF deve ter 2 caracteres").optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
});

export const AtualizarNomeSchema = UsuarioBaseSchema.pick({
  nome: true,
});

export const RegistroUsuario = UsuarioBaseSchema.extend({
  senha: SenhaForte,
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  whatsapp: z.string().optional().nullable(),
  recaptchaToken: z.string().min(1, "O token de recaptcha é obrigatório"),
}).strict();

export const esqueciSenhaSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido."),
});

export const redefinirSenhaSchema = z.object({
  token: z.string().min(1, "O token de recuperação é obrigatório."),
  nova_senha: SenhaForte,
});

export const TrocarSenha = z.object({
  nova_senha: SenhaForte,
  senha_atual: z
    .string()
    .min(1, "A senha atual é obrigatória para trocar a senha."),
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

export const editarCompetenciaSchema = z.object({
  novo_nome: z
    .string()
    .min(2, "O nome oficial deve ter pelo menos 2 caracteres."),
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

  tipo_diversidade: z.string().default("AMPLA_CONCORRENCIA"),

  salario_de: z.coerce.number().optional().nullable(),
  salario_ate: z.coerce.number().optional().nullable(),
  salario_a_combinar: z.boolean().default(false),
  ocultar_salario: z.boolean().default(false),
  empresa_confidencial: z.boolean().default(false),
  data_fechamento: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const dataEscolhida = new Date(`${val}T12:00:00`);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return dataEscolhida >= hoje;
    }, "A data de fechamento não pode estar no passado."),
  link_externo: z
    .string()
    .url("Insira um link válido (com https://)")
    .nullable()
    .optional()
    .or(z.literal("")),

  instrucoes_candidatura: z.string().nullable().optional().or(z.literal("")),

  // Textos
  descricao: z.string().min(10),
  responsabilidades: z.string().min(5),
  requisitos_obrigatorios: z.string().min(5),
  diferenciais: z.string().optional().default(""),

  // Endereço
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z
    .string()
    .default("PANAMBI")
    .transform((val) => val.toUpperCase()),
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

export const sincronizarAreasSchema = z.object({
  areas_ids: z
    .array(z.number("Os IDs das áreas devem ser números."))
    .max(10, "Você pode selecionar no máximo 10 áreas de atuação.")
    .min(1, "Selecione pelo menos uma área."),
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
      "AGUARDANDO_PAGAMENTO",
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
  cpf: z
    .string()
    .length(11, "CPF deve ter 11 dígitos")
    .refine((val) => validarCPF(val), {
      message: "CPF inválido. Verifique os números digitados.",
    })
    .optional()
    .nullable(),
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
  link_outro: z
    .string()
    .url("URL inválida")
    .optional()
    .or(z.literal(""))
    .nullable(),

  // Profissional
  objetivo_profissional: z
    .string()
    .max(300, "Tente ser mais direto no objetivo (máx 3200 caracteres)")
    .optional()
    .nullable()
    .or(z.literal("")),
  resumo_profissional: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine((val) => !val || val.trim().length >= 20, {
      message:
        "Se for preencher, escreva pelo menos 20 caracteres para um bom resumo.",
    }),
  pretensao_salarial: z.number().positive().optional().nullable(),
  id_area_atuacao: z.number().int().optional().nullable(),
  primeiro_emprego: z.boolean().default(false),

  disponibilidade_viagem: z.boolean().optional(),
  disponibilidade_mudanca: z.boolean().optional(),
  disponibilidade_sabados: z.boolean().optional(),
  turno_preferido: z
    .array(z.enum(["MANHÃ", "TARDE", "NOITE", "COMERCIAL", "QUALQUER_TURNO"]))
    .max(3, "Você pode selecionar no máximo 3 turnos")
    .optional()
    .default([]),
  tipo_contato: z
    .array(z.enum(["WHATSAPP", "EMAIL", "LIGACAO", "QUALQUER_UM"]))
    .default(["QUALQUER_UM"]),

  pcd: z.boolean().optional(),
  tipo_pcd: z.string().optional().nullable(),
  necessidade: z.string().max(300, "Texto muito longo").optional().nullable(),
  cnh: z
    .array(z.enum(["NAO_POSSUO", "A", "B", "C", "D", "E"]))
    .optional()
    .default(["NAO_POSSUO"]),
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
    instituicao: z.string().optional().nullable(), // Agora é opcional, pois ensino básico não envia
    nivel: z.string().min(2, "Nível de escolaridade é obrigatório"),
    curso: z.string().min(2, "Nome do curso é obrigatório"), // O front sempre vai enviar (seja o curso ou o nome do nível)
    status: z.string().min(2, "Status é obrigatório"),
    data_conclusao: z.string().pipe(z.coerce.date()).optional().nullable(),
  })
  .refine(
    (data) => {
      const isBasico =
        data.nivel === "Ensino Fundamental" || data.nivel === "Ensino Médio";
      const isConcluido = data.status.toUpperCase() === "CONCLUÍDO";

      if (!isBasico && isConcluido && !data.data_conclusao) {
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
    message:
      "O status de visibilidade é obrigatório e deve ser verdadeiro ou falso.",
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

export const contatoSiteSchema = z.object({
  nome: z.string().min(2, "O nome da empresa/responsável é obrigatório."),
  email: z.string().email("Informe um e-mail válido."),
  assunto: z.string().min(2, "O assunto é obrigatório."),
  mensagem: z
    .string()
    .min(10, "Escreva uma mensagem de pelo menos 10 caracteres."),
});
