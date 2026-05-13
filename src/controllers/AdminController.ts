import type { Request, Response } from "express";
import { AdminService } from "../services/AdminService.js";
import { BaseUserService } from "../services/BaseUserService.js";

import { EmpresaSchema, QueryListagemSchema } from "../schemas/auth.schema.js";
import { z } from "zod";
import { prisma } from "../config/prisma.js";

const adminService = new AdminService();
const baseUserService = new BaseUserService();

export class AdminController {
  /** #region GESTÃO DE EMPRESAS:
   *  Funcionalidades:
   * - Cadastrar empresa
   * - Listar todas
   * - Obter detalhes
   * - Desativar empresa
   * */

  // Cadastrar nova empresa e o usuário administrador dela -revisada-
  async cadastrarEmpresa(req: Request, res: Response) {
    try {
      const id_autor = req.user.id;
      const resultado = await adminService.cadastrarEmpresa(req.body, id_autor);
      return res.status(201).json(resultado);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Listar todas as empresas cadastradas -revisada-
  async listarEmpresas(req: Request, res: Response) {
    try {
      // O .parse valida page, limit e search
      const { page, limit, search } = QueryListagemSchema.parse(req.query);

      // Pegamos o status direto da query da requisição
      const status = req.query.status as "ATIVO" | "BLOQUEADO" | undefined;

      const result = await adminService.listarTodasEmpresas(
        page,
        limit,
        search,
        status, // <--- AGORA SIM! O parâmetro sendo passado para o Service
      );

      return res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Parâmetros de consulta inválidos",
          detalhes: error.issues,
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Buscar detalhes de uma empresa específica por ID
  async obterDetalhesEmpresa(req: Request, res: Response) {
    try {
      // O id já vem como number aqui graças ao z.coerce do middleware
      const { id } = req.params as unknown as { id: number };

      const empresa = await adminService.buscarEmpresaPorId(id);

      return res.status(200).json(empresa);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Bloquear uma empresa e pausar suas vagas (soft delete)
  async alterarStatusEmpresa(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const { acao } = req.body;
      const id_autor = req.user.id;

      await adminService.alterarStatusEmpresa(id, acao, id_autor);

      return res.status(200).json({
        message:
          acao === "ATIVAR"
            ? "Acesso da empresa e usuários restaurado."
            : "Empresa desativada: usuários bloqueados e vagas pausadas.",
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // #endregion FIM DA GESTÃO DE EMPRESAS

  /** #region GESTÃO DE USUÁRIOS (COLABORADORES):
   * Funcionalidades:
   * - Adicionar novo acesso
   * - Atualizar dados
   * - Ativar/Bloquear usuário
   * - Listagem e detalhes
   * */

  // Adicionar um novo colaborador a uma empresa já existente
  async cadastrarUsuarioEmEmpresa(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const id_autor = req.user.id;

      const usuario = await adminService.cadastrarUsuarioEmEmpresa(
        id,
        req.body,
        id_autor,
      );

      // Ocultamos o hash da senha no retorno por segurança
      const { senha_hash, ...dadosPublicos } = usuario;

      return res.status(201).json(dadosPublicos);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Atualizar nome, e-mail ou senha de um usuário empresa
  async atualizarUsuario(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const idAutor = req.user.id;

      // Chamamos a função do Base
      const usuario = await baseUserService.atualizarUsuario(
        id,
        req.body,
        idAutor,
      );

      return res.status(200).json({
        message: "Dados do usuário atualizados.",
        data: {
          id: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Bloquear ou ativar um acesso individual
  async alternarStatusUsuario(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const { status } = req.body;
      const idAutor = req.user.id;

      // Chamamos direto do baseUserService que o AdminService já possui/conhece
      await baseUserService.alterarStatus(id, status, idAutor);

      return res.status(200).json({
        message: `Usuário ${status === "ATIVO" ? "ativado" : "bloqueado"} com sucesso.`,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Listar todos os usuários do tipo EMPRESA no sistema
  async listarUsuariosEmpresa(req: Request, res: Response) {
    try {
      // req.query já está limpo e tipado pelo Zod
      const result = await adminService.listarTodosUsuariosEmpresa(req.query);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
  // Obter detalhes completos de um usuário (incluindo logs e empresa)
  async obterDetalhesUsuario(req: Request, res: Response) {
    try {
      // Pegamos o ID já validado e convertido para número pelo Zod
      const { id } = req.params as any;

      const usuario = await baseUserService.buscarPorId(id);

      return res.status(200).json(usuario);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Ver currículo completo do candidato
  async obterCurriculo(req: Request, res: Response) {
    try {
      // Pegamos o id já validado e convertido pelo middleware
      const { id } = req.params as any;

      const curriculo = await adminService.obterCurriculoCompleto(id);

      return res.status(200).json(curriculo);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Resetar senha de qualquer usuário (Forçar troca)
  async resetarSenhaUsuario(req: Request, res: Response) {
    try {
      const { id } = req.params as any; // Validado pelo IdParamSchema
      const { novaSenha } = req.body;
      const idAutor = req.user.id;

      // 1. Buscar o tipo do usuário alvo antes de resetar
      const usuarioAlvo = await prisma.usuario.findUnique({
        where: { id_usuario: id },
        select: { tipo_usuario: true, is_master: true },
      });

      if (!usuarioAlvo) throw new Error("Usuário não encontrado.");

      // 2. Trava de segurança: Apenas Master reseta senha de outros Admins
      if (usuarioAlvo.tipo_usuario === "ADM" && !req.user.is_master) {
        return res.status(403).json({
          error:
            "Apenas um Administrador Master pode resetar senhas da equipe.",
        });
      }

      // 3. Executa o reset
      await adminService.forcarTrocaSenha(id, novaSenha, idAutor);

      return res.status(200).json({
        message:
          "Senha alterada com sucesso. O usuário será obrigado a trocá-la no próximo login.",
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // #endregion FIM DA GESTÃO DE USUÁRIOS (COLABORADORES)

  /** #region GESTÃO DE EQUIPE ACI (MASTER):
   * Funcionalidades:
   * - Criar outros administradores
   * - Visualizar equipe ACI
   * */

  async cadastrarNovoAdmin(req: Request, res: Response) {
    try {
      // Verificação de segurança: Apenas Master cria equipe
      if (!req.user.is_master) {
        return res
          .status(403)
          .json({ error: "Acesso restrito a Administradores Master." });
      }

      const id_autor = req.user.id;
      const admin = await adminService.cadastrarNovoAdmin(req.body, id_autor);

      return res.status(201).json(admin);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async listarAdmins(req: Request, res: Response) {
    try {
      // 1. Segurança: Apenas Master gerencia a equipe
      if (!req.user.is_master) {
        return res
          .status(403)
          .json({ error: "Acesso restrito ao Administrador Master." });
      }

      // 2. Filtros validados pelo Zod (FiltroUsuarioSchema)
      const result = await adminService.listarAdministradores(req.query);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async atualizarAdmin(req: Request, res: Response) {
    try {
      if (!req.user.is_master) {
        return res
          .status(403)
          .json({ error: "Acesso restrito ao Administrador Master." });
      }

      const { id } = req.params as any; // Pegamos o ID convertido pelo IdParamSchema
      const admin = await adminService.atualizarDadosAdmin(
        id,
        req.body,
        req.user.id,
      );

      return res.status(200).json(admin);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async excluirAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params as any; // ID do Admin a ser removido
      const idAutor = req.user.id; // ID do Master logado

      // 1. TRAVA DE SEGURANÇA (Regra de Negócio)
      if (!req.user.is_master) {
        return res.status(403).json({ error: "Acesso restrito ao Master." });
      }

      if (id === idAutor) {
        return res
          .status(400)
          .json({ error: "Você não pode remover a si mesmo." });
      }

      // 2. REUSO DO MOTOR (BaseUserService)
      // Em vez de criar um código novo, usamos o que já está pronto
      await baseUserService.alterarStatus(id, "BLOQUEADO", idAutor);

      return res.status(200).json({
        message: "Administrador removido da equipe com sucesso.",
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async addExperiencia(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any; // Validado pelo IdParamSchema
      const exp = await adminService.adicionarExperienciaCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(exp);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async addFormacao(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any;
      const form = await adminService.adicionarFormacaoCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(form);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async addCompetencia(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any;
      const result = await adminService.adicionarCompetenciaCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  //gerenciar créditos empresa

  // Endpoint para o Admin adicionar créditos a uma empresa
  async atualizarCreditos(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID da empresa vindo da URL
      const idAutor = (req.user as any).id;

      const empresa = await adminService.gerenciarCreditosEmpresa(
        Number(id),
        req.body,
        idAutor,
      );

      return res.status(200).json({
        success: true,
        message: "Créditos/Recursos atualizados com sucesso.",
        data: {
          id_empresa: empresa.id_empresa,
          nome_fantasia: empresa.nome_fantasia,
          creditos_vagas: empresa.creditos_vagas,
          creditos_curriculos: empresa.creditos_curriculos,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // Ouvidoria
  async listarOuvidoria(req: Request, res: Response) {
    try {
      const resultado = await adminService.listarRelatosOuvidoria(req.query);
      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Suporte
  async listarTickets(req: Request, res: Response) {
    try {
      const resultado = await adminService.listarTicketsSuporte(req.query);
      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async responderTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body; // Aberto, Em Andamento, Resolvido

      const ticket = await adminService.atualizarStatusTicket(
        Number(id),
        status,
        req.user.id,
      );
      return res
        .status(200)
        .json({ message: "Status do ticket atualizado.", data: ticket });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Balcão de vagas: Admin cadastra e publica uma vaga diretamente para uma empresa
  async liberarRecursos(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID da Empresa vindo da URL
      const { tipo, quantidade } = req.body; // 'VAGA' ou 'CURRICULO' e a quantia
      const id_autor = (req.user as any).id; // ID do Admin logado para o Log de Auditoria

      // Chamada para o Service que criamos anteriormente
      const resultado = await adminService.liberarRecursosPagos(
        Number(id),
        { tipo, quantidade: Number(quantidade) },
        id_autor,
      );

      return res.status(200).json({
        success: true,
        message: `Recursos liberados com sucesso para a empresa.`,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Listar pedidos de marketing para o Admin (com filtro opcional por status)
  async listarParaAdmin(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const resultado = await adminService.listarPedidosAdmin(status);
      return res.status(200).json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Endpoint para o Admin aprovar ou rejeitar um pedido de marketing
  async gerenciarPedido(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const id_autor = (req.user as any).id;
      const resultado = await adminService.atualizarStatusPedido(
        Number(id),
        req.body,
        id_autor,
      );
      return res.status(200).json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
