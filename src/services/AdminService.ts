import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import { BaseUserService } from "./BaseUserService.js";
import { generateSlug } from "../utils/slugify.js";
import type { TipoUsuario } from "@prisma/client";

const baseUser = new BaseUserService();

export class AdminService {
  private async verificarMaster(id_autor: number) {
    const autor = await prisma.usuario.findUnique({
      where: { id_usuario: id_autor },
      select: { is_master: true },
    });

    if (!autor || !autor.is_master) {
      throw new Error(
        "Acesso negado: Apenas administradores Master podem realizar esta operação.",
      );
    }
  }
  /** #region GESTÃO DE EMPRESAS:
   *
   *
   * Funcionalidades
   * - Cadastrar nova empresa
   * - Listar todas as empresas
   * - Obter detalhes de uma empresa específica
   * - Desativar empresa
   * - Atualizar dados de uma empresa
   *
   */

  // Cadastrar nova empresa + primeiro usuário vinculado

  async listarUsuarios(filtros: {
    tipo?: string | undefined;
    busca?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }) {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const skip = (page - 1) * limit;

    const onde: any = {};

    // 1. Filtro por Tipo (CANDIDATO, EMPRESA, ADM)
    if (
      filtros.tipo &&
      ["ADM", "CANDIDATO", "EMPRESA"].includes(filtros.tipo.toUpperCase())
    ) {
      onde.tipo_usuario = filtros.tipo.toUpperCase() as TipoUsuario;
    }

    // 2. Filtro de Busca (Nome ou E-mail)
    if (filtros.busca) {
      onde.OR = [
        { nome: { contains: filtros.busca, mode: "insensitive" } },
        { email: { contains: filtros.busca, mode: "insensitive" } },
      ];
    }

    // 🚀 Consultas em paralelo para performance
    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where: onde }),

      prisma.usuario.findMany({
        where: onde,
        skip,
        take: limit,
        orderBy: {
          ultima_atividade: { sort: "desc", nulls: "last" },
        },
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          tipo_usuario: true,
          status: true,
          is_master: true,
          ultimo_login: true,
          criado_em: true,
          ultima_atividade: true,
          email_confirmado: true,
          candidato: {
            select: {
              perfil_visivel_empresas: true,
            },
          },
          empresa: {
            select: {
              id_empresa: true,
              nome_fantasia: true,
              cnpj: true,
            },
          },
        },
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        total_paginas: Math.ceil(total / limit),
      },
      data: usuarios,
    };
  }

  async cadastrarEmpresa(dados: any, id_autor: number) {
    const cnpjLimpo = dados.cnpj.replace(/\D/g, "");

    // 1. Geração do Slug
    const slugBase = generateSlug(dados.nome_fantasia);

    // 2. Verificações Prévias (Fail Fast)
    const [eExistente, uExistente, slugExistente] = await Promise.all([
      prisma.empresa.findUnique({ where: { cnpj: cnpjLimpo } }),
      prisma.usuario.findUnique({ where: { email: dados.email } }),
      prisma.empresa.findUnique({ where: { slug: slugBase } }), // Verifica se o link já existe
    ]);

    if (eExistente) throw new Error("CNPJ já cadastrado.");
    if (uExistente) throw new Error("E-mail de usuário já cadastrado.");

    // Se o slug já existir, avisamos para o admin adicionar um diferencial (ex: nome da cidade ou bairro)
    if (slugExistente) {
      throw new Error(
        `O nome fantasia "${dados.nome_fantasia}" gera um link (slug) que já está em uso. Por favor, adicione um diferencial ao nome fantasia (ex: ${dados.nome_fantasia} - Centro).`,
      );
    }

    const senha_hash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Cadastro do Endereço
      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento || null,
          cep: dados.cep,
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          bairro: dados.bairro,
        },
      });

      // Cadastro da Empresa com o SLUG
      const empresa = await tx.empresa.create({
        data: {
          cnpj: cnpjLimpo,
          razao_social: dados.razao_social,
          nome_fantasia: dados.nome_fantasia,
          slug: slugBase, // ✨ O novo campo aqui
          email: dados.email_institucional || null,
          tipo_vinculo_aci: dados.tipo_vinculo_aci || "NAO_ASSOCIADA",
          id_endereco: endereco.id_endereco,
        },
      });

      // Cadastro do Usuário Master da Empresa
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash,
          tipo_usuario: "EMPRESA",
          status: "ATIVO",
          id_empresa: empresa.id_empresa,
          exigir_troca_senha: true,
          is_master: true, // Importante para as permissões que discutimos antes
        },
      });

      // Log de Auditoria
      await baseUser.registrarLog(
        tx,
        id_autor,
        "CADASTRAR_EMPRESA",
        "Empresa",
        empresa.id_empresa,
        {
          razao_social: empresa.razao_social,
          slug: empresa.slug,
          vinculo: empresa.tipo_vinculo_aci,
        },
      );

      return { usuario, empresa };
    });
  }

  async atualizarEmpresa(id_empresa: number, dados: any, id_autor: number) {
    // 1. Busca a empresa existente e o endereço (Sem buscar usuários)
    const empresaExistente = await prisma.empresa.findUnique({
      where: { id_empresa },
      include: {
        endereco: true,
      },
    });

    if (!empresaExistente) {
      throw new Error("Empresa não encontrada.");
    }

    // 2. Validações Prévias de Conflito (Ignorando a própria empresa)
    let cnpjLimpo = empresaExistente.cnpj;
    if (dados.cnpj) {
      cnpjLimpo = dados.cnpj.replace(/\D/g, "");
      if (cnpjLimpo !== empresaExistente.cnpj) {
        const cnpjEmUso = await prisma.empresa.findUnique({
          where: { cnpj: cnpjLimpo },
        });
        if (cnpjEmUso)
          throw new Error("Este CNPJ já está cadastrado em outra empresa.");
      }
    }

    let slugFinal = empresaExistente.slug;
    if (
      dados.nome_fantasia &&
      dados.nome_fantasia !== empresaExistente.nome_fantasia
    ) {
      slugFinal = generateSlug(dados.nome_fantasia);
      const slugEmUso = await prisma.empresa.findFirst({
        where: { slug: slugFinal, id_empresa: { not: id_empresa } },
      });

      if (slugEmUso) {
        throw new Error(
          `O nome fantasia "${dados.nome_fantasia}" gera um link (slug) que já está em uso por outra empresa. Adicione um diferencial (ex: - Matriz).`,
        );
      }
    }

    // 3. Execução da Transação Segura
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Atualiza o Endereço
      if (empresaExistente.id_endereco) {
        await tx.endereco.update({
          where: { id_endereco: empresaExistente.id_endereco },
          data: {
            logradouro:
              dados.logradouro !== undefined
                ? dados.logradouro
                : empresaExistente.endereco?.logradouro,
            numero:
              dados.numero !== undefined
                ? dados.numero
                : empresaExistente.endereco?.numero,
            complemento:
              dados.complemento !== undefined
                ? dados.complemento
                : empresaExistente.endereco?.complemento,
            cep:
              dados.cep !== undefined
                ? dados.cep
                : empresaExistente.endereco?.cep,
            cidade:
              dados.cidade !== undefined
                ? dados.cidade
                : empresaExistente.endereco?.cidade,
            uf:
              dados.uf !== undefined ? dados.uf : empresaExistente.endereco?.uf,
            bairro:
              dados.bairro !== undefined
                ? dados.bairro
                : empresaExistente.endereco?.bairro,
          },
        });
      }

      // Atualiza a Empresa (Sem tocar no status e sem e-mail institucional)
      const empresa = await tx.empresa.update({
        where: { id_empresa },
        data: {
          cnpj: cnpjLimpo,
          razao_social:
            dados.razao_social !== undefined
              ? dados.razao_social
              : empresaExistente.razao_social,
          nome_fantasia:
            dados.nome_fantasia !== undefined
              ? dados.nome_fantasia
              : empresaExistente.nome_fantasia,
          slug: slugFinal,
          tipo_vinculo_aci:
            dados.tipo_vinculo_aci !== undefined
              ? dados.tipo_vinculo_aci
              : empresaExistente.tipo_vinculo_aci,
        },
      });

      // Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ADM_ATUALIZAR_EMPRESA",
          entidade: "Empresa",
          id_entidade: empresa.id_empresa,
          detalhes: {
            alterado_por: id_autor,
            data: new Date(),
          },
        },
      });

      // Retorna apenas a empresa atualizada
      return { empresa };
    });
  }
  // Listar todas as empresas com dados básicos e número de vagas
  async listarTodasEmpresas(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: "ATIVO" | "BLOQUEADO",
  ) {
    const skip = (pagina - 1) * limite;

    const onde: any = {};

    if (busca) {
      onde.OR = [
        { nome_fantasia: { contains: busca, mode: "insensitive" } },
        { cnpj: { contains: busca } },
        { razao_social: { contains: busca, mode: "insensitive" } },
      ];
    }

    if (status) {
      onde.status = status;
    }

    const [total, totalAssociadas, totalNaoAssociadas, empresas] =
      await Promise.all([
        prisma.empresa.count({ where: onde }),
        prisma.empresa.count({
          where: { ...onde, tipo_vinculo_aci: "ASSOCIADA" },
        }),
        prisma.empresa.count({
          where: { ...onde, tipo_vinculo_aci: "NAO_ASSOCIADA" },
        }),
        prisma.empresa.findMany({
          where: onde,
          skip,
          take: limite,
          select: {
            id_empresa: true,
            nome_fantasia: true,
            cnpj: true,
            tipo_vinculo_aci: true,
            status: true,
            endereco: {
              select: {
                cidade: true,
                uf: true,
                bairro: true,
              },
            },
            _count: { select: { vagas: true } },
            usuarios: {
              take: 1,
              select: {
                nome: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { nome_fantasia: "asc" },
        }),
      ]);

    const dataFormatada = empresas.map((e) => ({
      id_empresa: e.id_empresa,
      nome_fantasia: e.nome_fantasia,
      cnpj: e.cnpj,
      status: e.status,
      tipo_vinculo_aci: e.tipo_vinculo_aci,
      cidade: e.endereco?.cidade || "N/A",
      bairro: e.endereco?.bairro || "N/A", // Mapeado como string direta
      vagas_count: e._count.vagas,
      responsavel: e.usuarios[0] || null,
    }));

    return {
      meta: {
        total,
        pagina,
        limite,
        total_paginas: Math.ceil(total / limite),
        total_associadas: totalAssociadas,
        total_nao_associadas: totalNaoAssociadas,
      },
      data: dataFormatada,
    };
  }

  // Obter detalhes de uma empresa específica, incluindo usuários e vagas
  async buscarEmpresaPorId(id_empresa: number) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      include: {
        usuarios: {
          select: {
            id_usuario: true,
            nome: true,
            email: true,
            status: true,
            ultimo_login: true,
          },
        },
        vagas: true,
        endereco: true,
        beneficios_padrao: { include: { beneficio: true } },
      },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");
    return empresa;
  }

  // Desativar empresa: bloqueia usuários, pausa vagas e registra auditoria
  async alterarStatusEmpresa(
    id_empresa: number,
    acao: "ATIVAR" | "DESATIVAR",
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const novoStatus = acao === "ATIVAR" ? "ATIVO" : "BLOQUEADO";

      await tx.empresa.update({
        where: { id_empresa },
        data: { status: novoStatus },
      });

      // 1. Atualiza usuários em massa
      await tx.usuario.updateMany({
        where: { id_empresa },
        data: { status: novoStatus },
      });

      // 2. Regra de negócio: Se desativa a empresa, pausa as vagas
      if (acao === "DESATIVAR") {
        await tx.vaga.updateMany({
          where: { id_empresa, status: "ATIVA" },
          data: { status: "PAUSADA" },
        });
      }

      // 3. Usa o rastro de auditoria padronizado do BaseUserService
      await baseUser.registrarLog(
        tx,
        id_autor,
        `${acao}_EMPRESA`,
        "Empresa",
        id_empresa,
      );

      return { success: true };
    });
  }
  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE EMPRESAS

  /** #region GESTÃO DE USUÁRIOS:
   *
   *
   *  Funcionalidades
   * - Cadastrar usuário vinculado a empresa
   * - Atualizar dados do usuário
   * - Desativar/Ativar usuário (Toggle Status)
   * - Listar todos os usuários de empresa
   * - Ver detalhes de UM usuário específico com contexto total
   *
   *
   */

  // Cadastrar novo usuário vinculado a uma empresa já existente
  async cadastrarUsuarioEmEmpresa(
    id_empresa: number,
    dados: any,
    id_autor: number,
  ) {
    // 1. Validação de existência da empresa (Pode ser feita fora da transação para poupar recursos)
    const empresa = await prisma.empresa.findUnique({ where: { id_empresa } });
    if (!empresa) throw new Error("Empresa não encontrada.");

    // 2. Verificação de E-mail Único
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("Este e-mail já está cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 3. Criação do Usuário Colaborador
      const novoUsuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "EMPRESA",
          status: "ATIVO",
          id_empresa: id_empresa,
          exigir_troca_senha: true,
        },
      });

      // 4. Log padronizado via BaseUserService
      await baseUser.registrarLog(
        tx,
        id_autor,
        "CRIAR_USUARIO_EM_EMPRESA",
        "Usuario",
        novoUsuario.id_usuario,
        {
          empresa: empresa.nome_fantasia,
        },
      );

      return novoUsuario;
    });
  }

  // Atualizar dados do usuário (nome, email, senha)
  async atualizarUsuario(id_usuario: number, dados: any, id_autor: number) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuarioExistente) throw new Error("Usuário não encontrado.");

    // Monta o objeto dinamicamente
    const dataUpdate: any = {};

    if (dados.nome) dataUpdate.nome = dados.nome;
    if (dados.email) dataUpdate.email = dados.email;

    if (dados.senha) {
      dataUpdate.senha_hash = await argon2.hash(dados.senha);
    }

    // Verifica se há algo para atualizar para não dar erro no Prisma
    if (Object.keys(dataUpdate).length === 0) {
      throw new Error("Nenhum dado informado para atualização.");
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: dataUpdate,
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATUALIZAR_USUARIO",
          entidade: "Usuario",
          id_entidade: id_usuario,
          detalhes: { campos_alterados: Object.keys(dataUpdate) }, // Usar dataUpdate aqui é mais preciso
        },
      });

      return usuario;
    });
  }

  // Listar todos os usuários de empresa com dados básicos e empresa vinculada
  async listarTodosUsuariosEmpresa(filtros: any) {
    const { page, limit, search, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "EMPRESA",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                {
                  empresa: {
                    nome_fantasia: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {},
      ],
    };

    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where: onde }),
      prisma.usuario.findMany({
        where: onde,
        skip,
        take: limit,
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          status: true,
          criado_em: true,
          empresa: {
            select: { nome_fantasia: true },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: usuarios,
    };
  }

  // Ver currículo completo (Perfil + Experiências + Formações)
  async obterCurriculoCompleto(id_usuario: number) {
    const perfil = await prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        candidato: {
          include: {
            experiencias: {
              orderBy: { data_inicio: "desc" }, // Mais recentes primeiro
            },
            formacoes: {
              orderBy: { status: "asc" }, // Ou por data de conclusão
            },
            competencias: {
              include: {
                competencia: {
                  select: { nome: true }, // Traz o nome da skill (Ex: Excel)
                },
              },
            },
          },
        },
      },
    });

    // Validação de segurança
    if (!perfil || perfil.tipo_usuario !== "CANDIDATO") {
      throw new Error(
        "Candidato não encontrado ou usuário não é do tipo candidato.",
      );
    }

    // Removemos a senha por segurança, mesmo sendo rota de Admin
    const { senha_hash, ...dadosSeguros } = perfil;
    return dadosSeguros;
  }

  // Adicionar Experiência Profissional
  async adicionarExperienciaCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const experiencia = await tx.experienciaProfissional.create({
        data: {
          id_candidato: id_usuario,
          ...dados, // Zod já garantiu os campos e os tipos Date
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_EXPERIENCIA",
        "Candidato",
        id_usuario,
        {
          cargo: dados.cargo,
          empresa: dados.empresa,
        },
      );

      return experiencia;
    });
  }

  // Adicionar Formação Acadêmica
  async adicionarFormacaoCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const formacao = await tx.formacaoAcademica.create({
        data: {
          id_candidato: id_usuario,
          ...dados, // Zod já cuidou de tudo
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_FORMACAO",
        "Candidato",
        id_usuario,
        {
          curso: dados.curso,
          instituicao: dados.instituicao,
        },
      );

      return formacao;
    });
  }

  async adicionarCompetenciaCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const vinculo = await tx.candidatoCompetencia.upsert({
        where: {
          id_candidato_id_competencia: {
            id_candidato: id_usuario,
            id_competencia: dados.id_competencia,
          },
        },
        update: { nivel: dados.nivel },
        create: {
          id_candidato: id_usuario,
          id_competencia: dados.id_competencia,
          nivel: dados.nivel,
        },
        include: { competencia: true },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_COMPETENCIA",
        "Candidato",
        id_usuario,
        {
          competencia: vinculo.competencia.nome,
          nivel: dados.nivel,
        },
      );

      return vinculo;
    });
  }

  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE USUÁRIOS

  /** #region GESTÃO DE ADMINISTRADORES:
   *
   *
   *
   * Funcionalidades:
   * - Cadastrar novo administrador (Master ou ADM comum)
   * - Listar apenas os administradores
   * - Deletar administrador
   *
   *
   */

  // Cadastrar novo administrador (Master ou ADM comum)
  async cadastrarNovoAdmin(dados: any, id_autor: number) {
    await this.verificarMaster(id_autor);

    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("E-mail já cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const novoAdmin = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "ADM",
          status: "ATIVO",
          is_master: dados.is_master || false,
          exigir_troca_senha: true,
          id_empresa: dados.id_empresa,
        },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "CADASTRAR_ADMINISTRADOR",
          entidade: "Usuario",
          id_entidade: novoAdmin.id_usuario,
          detalhes: { nome: novoAdmin.nome, is_master: novoAdmin.is_master },
        },
      });

      return novoAdmin;
    });
  }

  // Listar apenas os administradores
  async listarAdministradores(filtros: any, id_autor: number) {
    await this.verificarMaster(id_autor);

    const { page = 1, limit = 10, search, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "ADM",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [total, admins] = await Promise.all([
      prisma.usuario.count({ where: onde }),
      prisma.usuario.findMany({
        where: onde,
        skip,
        take: limit,
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          status: true,
          is_master: true,
          ultimo_login: true,
          criado_em: true,
        },
        orderBy: { nome: "asc" },
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        total_paginas: Math.ceil(total / limit),
      },
      data: admins,
    };
  }

  // Atualizar dados do administrador (nome, email, senha, is_master)
  async atualizarDadosAdmin(id_admin: number, dados: any, id_autor: number) {
    await this.verificarMaster(id_autor);
    const senha_hash = dados.senha ? await argon2.hash(dados.senha) : undefined;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const admin = await tx.usuario.update({
        where: { id_usuario: id_admin },
        data: {
          nome: dados.nome,
          email: dados.email,
          status: dados.status,
          is_master: dados.is_master,
          ...(senha_hash && {
            senha_hash,
            exigir_troca_senha: true,
          }),
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ATUALIZAR_ADMINISTRADOR",
        "Usuario",
        id_admin,
        {
          campos_alterados: Object.keys(dados).filter((k) => k !== "senha"),
        },
      );

      return admin;
    });
  }

  async forcarTrocaSenha(
    id_usuario: number,
    novaSenhaPura: string,
    id_autor: number,
  ) {
    const senha_hash = await argon2.hash(novaSenhaPura);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: {
          senha_hash,
          exigir_troca_senha: true,
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "FORCAR_TROCA_SENHA",
        "Usuario",
        id_usuario,
      );

      // Opcional: Aqui dispararia o EmailService no futuro
      return usuario;
    });
  }
  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE ADMINISTRADORES

  //gerenciar crédito das empresas

  async gerenciarCreditosEmpresa(
    id_empresa: number,
    dados: any,
    id_autor: number,
  ) {
    // 1. Busca inicial para validar existência e ter os valores atuais para o log
    const empresa = await prisma.empresa.findUnique({ where: { id_empresa } });
    if (!empresa) throw new Error("Empresa não encontrada.");

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const novaData: any = {};

      // Lógica para Vagas
      if (dados.creditos_vagas !== undefined) {
        novaData.creditos_vagas =
          dados.modo === "SOMAR"
            ? empresa.creditos_vagas + Number(dados.creditos_vagas)
            : Number(dados.creditos_vagas);
      }

      // Lógica para Currículos (Pacotes de visualização) [cite: 36]
      if (dados.creditos_curriculos !== undefined) {
        novaData.creditos_curriculos =
          dados.modo === "SOMAR"
            ? empresa.creditos_curriculos + Number(dados.creditos_curriculos)
            : Number(dados.creditos_curriculos);
      }

      // Proteção contra objeto vazio
      if (Object.keys(novaData).length === 0) {
        throw new Error(
          "Informe a quantidade de créditos de vagas ou currículos.",
        );
      }

      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: novaData,
      });

      // 2. Registro de Auditoria (Escopo: Histórico de ações críticas [cite: 56, 58])
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATUALIZAR_CREDITOS_EMPRESA",
          entidade: "Empresa",
          id_entidade: id_empresa,
          detalhes: {
            antes: {
              v: empresa.creditos_vagas,
              c: empresa.creditos_curriculos,
            },
            depois: {
              v: empresaAtualizada.creditos_vagas,
              c: empresaAtualizada.creditos_curriculos,
            },
            modo: dados.modo,
          },
        },
      });

      return empresaAtualizada;
    });
  }
  
  async listarRelatosOuvidoria(filtros: any) {
    const { page = 1, limit = 10 } = filtros;
    const skip = (page - 1) * limit;

    const [total, relatos] = await Promise.all([
      prisma.ouvidoriaRelato.count(),
      prisma.ouvidoriaRelato.findMany({
        skip,
        take: limit,
        include: {
          candidato: {
            select: {
              usuario: { select: { nome: true, email: true } },
            },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: relatos,
    };
  }

  // --- SEÇÃO DE SUPORTE (TICKETS) ---
  async listarTicketsSuporte(filtros: any) {
    const { page = 1, limit = 10, status } = filtros;
    const skip = (page - 1) * limit;

    const onde = status ? { status } : {};

    const [total, tickets] = await Promise.all([
      prisma.ticketSuporte.count({ where: onde }),
      prisma.ticketSuporte.findMany({
        where: onde,
        skip,
        take: limit,
        include: {
          usuario: { select: { nome: true, email: true, tipo_usuario: true } },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: tickets,
    };
  }

  async atualizarStatusTicket(
    id_ticket: number,
    novoStatus: string,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ticket = await tx.ticketSuporte.update({
        where: { id_ticket },
        data: { status: novoStatus },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        `ATUALIZAR_STATUS_TICKET_${novoStatus}`,
        "TicketSuporte",
        id_ticket,
      );

      return ticket;
    });
  }

  async liberarRecursosPagos(
    id_empresa: number,
    dados: { tipo: "VAGA" | "CURRICULO"; quantidade: number },
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Verificar se a empresa existe
      const empresa = await tx.empresa.findUnique({ where: { id_empresa } });
      if (!empresa) throw new Error("Empresa não encontrada.");

      // 2. Atualizar o saldo de créditos conforme o tipo
      const updateData =
        dados.tipo === "VAGA"
          ? { creditos_vagas: { increment: dados.quantidade } }
          : { creditos_curriculos: { increment: dados.quantidade } };

      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: updateData,
      });

      // 3. Registrar Log de Auditoria Crítica [cite: 58]
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: `LIBERACAO_MANUAL_${dados.tipo}`,
          entidade: "Empresa",
          id_entidade: id_empresa,
          detalhes: {
            quantidade: dados.quantidade,
            motivo: "Confirmação manual de pagamento (Balcão/Transferência)",
          },
        },
      });

      return empresaAtualizada;
    });
  }

  //gestão de marketing
  async listarPedidosAdmin(status?: any) {
    return await prisma.solicitacaoMidia.findMany({
      where: status ? { status } : {},
      include: {
        empresa: { select: { nome_fantasia: true } },
        vaga: { select: { titulo: true, status: true } },
      },
      orderBy: { criado_em: "asc" },
    });
  }

  async atualizarStatusPedido(
    id_solicitacao: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pedido = await tx.solicitacaoMidia.update({
        where: { id_solicitacao },
        data: {
          status: dados.status,
          justificativa: dados.justificativa,
        },
      });

      // Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: `MIDIA_STATUS_${dados.status}`,
          entidade: "SolicitacaoMidia",
          id_entidade: id_solicitacao,
          detalhes: {
            status: dados.status,
            justificativa: dados.justificativa,
          },
        },
      });

      return pedido;
    });
  }

  async listarVagasDaEmpresa(id_empresa: number) {
    // Verifica se a empresa existe antes de buscar as vagas
    const empresaExiste = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { id_empresa: true },
    });

    if (!empresaExiste) {
      throw new Error("Empresa não encontrada no sistema.");
    }

    const vagas = await prisma.vaga.findMany({
      where: { id_empresa },
      orderBy: { criada_em: "desc" }, // Mostra as vagas mais recentes primeiro
      select: {
        id_vaga: true,
        titulo: true,
        status: true,
        modelo_trabalho: true,
        data_publicacao: true,
        data_encerramento: true,
        data_atualizacao: true,
        criada_em: true,
        _count: {
          select: { candidaturas: true },
        },
      },
    });

    return vagas;
  }

  async obterDetalhesUsuario(id_usuario: number) {
    // 1. Busca os dados de autenticação e descobre o tipo
    const usuarioBase = await prisma.usuario.findUnique({
      where: { id_usuario },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        tipo_usuario: true,
        status: true,
        criado_em: true,
        ultimo_login: true,
        is_master: true,
        id_empresa: true,
      },
    });

    if (!usuarioBase) {
      throw new Error("Usuário não encontrado.");
    }

    let perfilCompleto = null;

    // 2. RAMIFICAÇÃO: Se for CANDIDATO, puxa o currículo completo
    if (usuarioBase.tipo_usuario === "CANDIDATO") {
      perfilCompleto = await prisma.candidato.findUnique({
        where: { id_usuario },
        include: {
          endereco: true,
          experiencias: { orderBy: { data_inicio: "desc" } },
          formacoes: { orderBy: { data_conclusao: "desc" } },
          areas_atuacao: { include: { area: true } },
          competencias: { include: { competencia: true } },
          // Traz um resumo das últimas 5 candidaturas para o Admin saber o quão ativo ele é
          candidaturas: {
            take: 5,
            orderBy: { data_candidatura: "desc" },
            include: {
              vaga: {
                select: {
                  titulo: true,
                  empresa: { select: { nome_fantasia: true } },
                },
              },
            },
          },
        },
      });
    }

    // 3. RAMIFICAÇÃO: Se for EMPRESA, puxa o perfil institucional
    else if (usuarioBase.tipo_usuario === "EMPRESA" && usuarioBase.id_empresa) {
      perfilCompleto = await prisma.empresa.findUnique({
        where: { id_empresa: usuarioBase.id_empresa },
        include: {
          endereco: true,
          beneficios_padrao: { include: { beneficio: true } },
          // Traz um resumo das últimas 5 vagas dessa empresa
          vagas: {
            take: 5,
            orderBy: { data_publicacao: "desc" },
            select: {
              id_vaga: true,
              titulo: true,
              status: true,
              data_publicacao: true,
            },
          },
        },
      });
    }

    // 4. Retorna tudo empacotado para o frontend
    return {
      conta: usuarioBase,
      detalhes: perfilCompleto,
    };
  }

  async detalharVaga(idVaga: number) {
    const vaga = await prisma.vaga.findUnique({
      where: {
        id_vaga: idVaga,
      },
      include: {
        // Dados essenciais da empresa para o Admin
        empresa: {
          select: {
            id_empresa: true,
            razao_social: true,
            nome_fantasia: true,
            cnpj: true,
            slug: true,
            tipo_vinculo_aci: true,
            logotipo_url: true,
            status: true,
          },
        },
        endereco: true,
        area_atuacao: true,
        configuracao: true,
        beneficios: {
          include: {
            beneficio: true,
          },
        },
        competencias: {
          include: {
            competencia: true,
          },
        },
        perguntas_eliminatorias: {
          include: {
            pergunta: true,
          },
        },
        etapas: {
          orderBy: {
            ordem: "asc", // Garante a ordem correta das etapas (1, 2, 3...)
          },
        },
      },
    });

    if (!vaga) {
      throw new Error("Vaga não encontrada.");
    }

    return vaga;
  }
}
