import { prisma } from "../config/prisma.js";
import argon2 from "argon2";
import { BaseUserService } from "./BaseUserService";

const baseUser = new BaseUserService();

export class AdminService {
  /** #region GESTÃO DE EMPRESAS:
   *
   *
   * Funcionalidades
   * - Cadastrar nova empresa
   * - Listar todas as empresas
   * - Obter detalhes de uma empresa específica
   * - Desativar empresa
   *
   */

  // Cadastrar nova empresa + primeiro usuário vinculado
  async cadastrarEmpresa(dados: any, id_autor: number) {
    // Validações de unicidade (CNPJ e E-mail)
    const cnpjLimpo = dados.cnpj.replace(/\D/g, "");

    const conflito = await prisma.$transaction(async (tx) => {
      const e = await tx.empresa.findUnique({ where: { cnpj: cnpjLimpo } });
      const u = await tx.usuario.findUnique({ where: { email: dados.email } });
      if (e) throw new Error("CNPJ já cadastrado.");
      if (u) throw new Error("E-mail de usuário já cadastrado.");
    });

    const senha_hash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          cnpj: cnpjLimpo,
          razao_social: dados.razao_social,
          nome_fantasia: dados.nome_fantasia,
          email: dados.email_institucional || null,
          tipo_vinculo_aci: dados.tipo_vinculo_aci || "NAO_ASSOCIADA",
          uf: dados.uf,
          cidade: dados.cidade,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash,
          tipo_usuario: "EMPRESA",
          status: "PENDENTE",
          id_empresa: empresa.id_empresa,
          exigir_troca_senha: true,
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "CADASTRAR_EMPRESA",
        "Empresa",
        empresa.id_empresa,
        {
          razao_social: empresa.razao_social,
        },
      );

      return { usuario, empresa };
    });
  }

  // Listar todas as empresas com dados básicos e número de vagas
  async listarTodasEmpresas(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
  ) {
    // Calcula quantos registros pular
    const skip = (pagina - 1) * limite;

    // Filtro opcional de busca (Nome ou CNPJ)
    const onde: any = busca
      ? {
          OR: [
            { nome_fantasia: { contains: busca, mode: "insensitive" } },
            { cnpj: { contains: busca } },
            { razao_social: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, empresas] = await Promise.all([
      prisma.empresa.count({ where: onde }),
      prisma.empresa.findMany({
        where: onde,
        skip,
        take: limite,
        select: {
          id_empresa: true,
          nome_fantasia: true,
          cnpj: true,
          tipo_vinculo_aci: true,
          cidade: true,
          _count: { select: { vagas: true } },
          usuarios: {
            where: { status: "ATIVO" },
            take: 1,
            select: { nome: true, email: true },
          },
        },
        orderBy: { nome_fantasia: "asc" },
      }),
    ]);

    return {
      meta: {
        total,
        pagina,
        limite,
        total_paginas: Math.ceil(total / limite),
      },
      data: empresas,
    };
  }

  // Obter detalhes de uma empresa específica, incluindo usuários e vagas
  async buscarEmpresaPorId(id_empresa: number) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      include: {
        usuarios: {
          select: { id_usuario: true, nome: true, email: true, status: true }, // Evita trazer o hash da senha
        },
        vagas: true,
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
    return await prisma.$transaction(async (tx) => {
      const statusUsuario = acao === "ATIVAR" ? "ATIVO" : "BLOQUEADO";

      // 1. Atualiza usuários em massa
      await tx.usuario.updateMany({
        where: { id_empresa },
        data: { status: statusUsuario },
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

    return await prisma.$transaction(async (tx) => {
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

    return await prisma.$transaction(async (tx) => {
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

  // Listar todos os candidatos com dados básicos
  async listarTodosCandidatos(filtros: any) {
    const { page = 1, limit = 10, search, cidade, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "CANDIDATO",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { candidato: { cpf: { contains: search } } },
              ],
            }
          : {},
        cidade
          ? { candidato: { cidade: { contains: cidade, mode: "insensitive" } } }
          : {},
      ],
    };

    const [total, candidatos] = await Promise.all([
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
          candidato: {
            select: {
              cpf: true,
              cidade: true,
              uf: true,
              telefone: true,
              competencias: {
                include: { competencia: { select: { nome: true } } },
                take: 3,
              },
            },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: candidatos,
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

  // Atualizar o currículo (Parte do Candidato)
  async atualizarPerfilCompletoCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      if (dados.nome || dados.email) {
        await tx.usuario.update({
          where: { id_usuario },
          data: {
            nome: dados.nome,
            email: dados.email,
          },
        });
      }

      const candidato = await tx.candidato.update({
        where: { id_usuario },
        data: {
          cpf: dados.cpf ? dados.cpf.replace(/\D/g, "") : null,
          cidade: dados.cidade || null,
          uf: dados.uf || null,
          logradouro: dados.logradouro || null,
          numero: dados.numero || null,
          bairro: dados.bairro || null,
          telefone: dados.telefone || null,
          whatsapp: dados.whatsapp || null,
          resumo_profissional: dados.resumo_profissional || null,
          objetivo_profissional: dados.objetivo_profissional || null,
          pretensao_salarial: dados.pretensao_salarial || null,
          genero: dados.genero || null,
          pcd: dados.pcd ?? false,
          tipo_pcd: dados.tipo_pcd || null,
          data_nascimento: dados.data_nascimento
            ? new Date(dados.data_nascimento)
            : null,
        },
      });

      if (dados.experiencias && Array.isArray(dados.experiencias)) {
        await tx.experienciaProfissional.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.experienciaProfissional.createMany({
          data: dados.experiencias.map((exp: any) => ({
            id_candidato: id_usuario,
            empresa: exp.empresa,
            cargo: exp.cargo,
            atividades: exp.atividades,
            data_inicio: new Date(exp.data_inicio),
            data_fim: exp.data_fim ? new Date(exp.data_fim) : null,
            atual: exp.atual || false,
          })),
        });
      }

      if (dados.formacoes && Array.isArray(dados.formacoes)) {
        await tx.formacaoAcademica.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.formacaoAcademica.createMany({
          data: dados.formacoes.map((form: any) => ({
            id_candidato: id_usuario,
            instituicao: form.instituicao,
            nivel: form.nivel,
            curso: form.curso,
            status: form.status,
            data_conclusao: form.data_conclusao
              ? new Date(form.data_conclusao)
              : null,
          })),
        });
      }

      if (dados.competencias && Array.isArray(dados.competencias)) {
        // 1. Remove as associações antigas
        await tx.candidatoCompetencia.deleteMany({
          where: { id_candidato: id_usuario },
        });

        // 2. Cria as novas associações
        await tx.candidatoCompetencia.createMany({
          data: dados.competencias.map((comp: any) => ({
            id_candidato: id_usuario,
            id_competencia: comp.id_competencia,
            nivel: comp.nivel,
          })),
        });
      }

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ADM_ATUALIZACAO_TOTAL_PERFIL",
          entidade: "Candidato",
          id_entidade: id_usuario,
          detalhes: { alterado_por: id_autor, data: new Date() },
        },
      });

      return candidato;
    });
  }

  // Cadastrar Candidato Manualmente
  async cadastrarCandidatoManual(dados: any, id_autor: number) {
    // 1. Verificações pré-transação (fail-fast)
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("E-mail já cadastrado.");

    const cpfExistente = await prisma.candidato.findUnique({
      where: { cpf: dados.cpf },
    });
    if (cpfExistente) throw new Error("CPF já cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      // 2. Cria o Usuário base
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "CANDIDATO",
          status: "ATIVO",
          exigir_troca_senha: true,
        },
      });

      // 3. Cria o Perfil do Candidato vinculado
      const candidato = await tx.candidato.create({
        data: {
          id_usuario: usuario.id_usuario,
          cpf: dados.cpf,
          telefone: dados.telefone,
          whatsapp: dados.whatsapp,
          cidade: dados.cidade,
          uf: dados.uf,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          data_nascimento: dados.data_nascimento, // Já é um objeto Date graças ao Zod
          genero: dados.genero,
          pcd: dados.pcd,
          tipo_pcd: dados.tipo_pcd,
          perfil_visivel_empresas: true,
        },
      });

      // 4. Log padronizado
      await baseUser.registrarLog(
        tx,
        id_autor,
        "CADASTRAR_CANDIDATO_MANUAL",
        "Candidato",
        usuario.id_usuario,
        {
          nome: usuario.nome,
          cpf: dados.cpf,
        },
      );

      return { usuario, candidato };
    });
  }

  // Adicionar Experiência Profissional
  async adicionarExperienciaCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
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
    return await prisma.$transaction(async (tx) => {
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
    return await prisma.$transaction(async (tx) => {
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
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("E-mail já cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      const novoAdmin = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "ADM",
          status: "ATIVO",
          is_master: dados.is_master || false,
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
  async listarAdministradores() {
    return await prisma.usuario.findMany({
      where: { tipo_usuario: "ADM" },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        status: true,
        is_master: true,
        ultimo_login: true,
      },
      orderBy: { nome: "asc" },
    });
  }

  async atualizarDadosAdmin(id_admin: number, dados: any, id_autor: number) {
    const senha_hash = dados.senha ? await argon2.hash(dados.senha) : undefined;

    return await prisma.$transaction(async (tx) => {
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

    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: {
          senha_hash,
          exigir_troca_senha: true, // Força a troca no próximo login
        },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "FORCAR_TROCA_SENHA",
          entidade: "Usuario",
          id_entidade: id_usuario,
        },
      });

      // TODO: EmailService.enviarSenhaTemporaria(usuario.email, novaSenhaPura);
      return usuario;
    });
  }
  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE ADMINISTRADORES

  //gerenciar crédito das empresas

  async gerenciarCreditosEmpresa(
    id_empresa: number,
    dados: {
      creditos_vagas?: number;
      creditos_curriculos?: number;
      modo: "SOMAR" | "DEFINIR";
    },
    id_autor: number,
  ) {
    const empresa = await prisma.empresa.findUnique({ where: { id_empresa } });
    if (!empresa) throw new Error("Empresa não encontrada.");

    return await prisma.$transaction(async (tx) => {
      const novaData: any = {};

      if (dados.creditos_vagas !== undefined) {
        novaData.creditos_vagas =
          dados.modo === "SOMAR"
            ? empresa.creditos_vagas + dados.creditos_vagas
            : dados.creditos_vagas;
      }

      if (dados.creditos_curriculos !== undefined) {
        novaData.creditos_curriculos =
          dados.modo === "SOMAR"
            ? empresa.creditos_curriculos + dados.creditos_curriculos
            : dados.creditos_curriculos;
      }

      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: novaData,
      });

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
}
