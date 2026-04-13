import { env } from "prisma/config";
import { Router } from "express";
import { AdminController } from "../controllers/AdminController.js";
import { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { VagaController } from "../controllers/VagaController.js";
import { AdminVagaController } from "../controllers/AdminVagaController.js";
import { EmpresaController } from "../controllers/EmpresaController.js";
import { CandidatoController } from "../controllers/CandidatoController.js";
import { CandidaturaController } from "../controllers/CandidaturaController.js";
import { UserController } from "../controllers/UserController.js";
import {
  AgendarEntrevistaSchema,
  AtualizarAdminSchema,
  AtualizarPerfilCompletoSchema,
  AtualizarPerfilEmpresaSchema,
  AtualizarUsuarioSchema,
  CadastroAdminSchema,
  cadastroCandidatoManualSchema,
  CandidaturaSchema,
  ColaboradorSchema,
  ConfigurarDestaquesSchema,
  CreditosSchema,
  DashboardFiltroSchema,
  EmpresaSchema,
  ExperienciaSchema,
  FiltroUsuarioSchema,
  FiltroVagasEmpresaSchema,
  FormacaoSchema,
  GerenciarMidiaSchema,
  IdParamSchema,
  ModeracaoVagaSchema,
  QueryListagemSchema,
  ResetSenhaSchema,
  SolicitacaoMidiaSchema,
  StatusEmpresaSchema,
  StatusUsuarioSchema,
  TaxonomiaSchema,
  TrocarSenha,
  vagaSchema,
  VincularCompetenciaSchema,
} from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.js";
import { TaxonomiaController } from "../controllers/TaxonomiaController.js";

const routes = Router();
const vagaController = new VagaController();
const adminController = new AdminController();
const authController = new AuthController();
const adminVagaController = new AdminVagaController();
const empresaController = new EmpresaController();
const taxonomiaController = new TaxonomiaController();
const candidatoController = new CandidatoController();
const candidaturaController = new CandidaturaController();
const usuarioController = new UserController();

routes.post("/login", authController.login);

// Rotas de Admin
// Cadastrar nova empresa - OK
routes.post(
  "/admin/cadastrar-empresa",
  authMiddleware(["ADM"]),
  validate(EmpresaSchema),
  adminController.cadastrarEmpresa,
);

// Listar todas - OK
routes.get(
  "/admin/empresas",
  authMiddleware(["ADM"]),
  validate(QueryListagemSchema, "query"),
  adminController.listarEmpresas,
);

// Detalhar empresa - OK
routes.get(
  "/admin/empresas/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.obterDetalhesEmpresa,
);

// Desativar empresa (Soft Delete) - SEMI-OK
routes.patch(
  "/admin/empresas/:id/status",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(StatusEmpresaSchema, "body"),
  adminController.alterarStatusEmpresa,
);

// Adicionar usuário a empresa
routes.post(
  "/admin/empresas/:id/usuarios",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ColaboradorSchema, "body"),
  adminController.cadastrarUsuarioEmEmpresa,
);

// Gerenciamento de Usuários (Colaboradores) pelo Admin
routes.put(
  "/admin/usuarios/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarUsuarioSchema, "body"),
  adminController.atualizarUsuario,
);

// Alternar status do usuário (Ativo <-> Bloqueado)
routes.patch(
  "/admin/usuarios/:id/status",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(StatusUsuarioSchema, "body"),
  adminController.alternarStatusUsuario,
);

// Visualização de Usuários Empresa
routes.get(
  "/admin/usuarios-empresa",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarUsuariosEmpresa,
);

// Detalhes de um usuário específico
routes.get(
  "/admin/usuarios/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.obterDetalhesUsuario,
);

// Deletar um admin
routes.delete(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.excluirAdmin,
);

// --- CANDIDATOS ---

// Listar todos os candidatos
routes.get(
  "/admin/candidatos",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarCandidatos,
);

// Cadastrar candidato manualmente
routes.post(
  "/admin/candidatos/manual",
  authMiddleware(["ADM"]),
  validate(cadastroCandidatoManualSchema, "body"),
  adminController.cadastrarCandidatoManual,
);

// Obter currículo completo de um candidato
routes.get(
  "/admin/candidatos/:id/curriculo",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.obterCurriculo,
);

// Atualizar perfil completo do candidato (dados pessoais + perfil profissional)
routes.put(
  "/admin/candidatos/:id/perfil-completo",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarPerfilCompletoSchema, "body"),
  adminController.atualizarPerfilCompleto,
);

// Adicionar experiência profissional ao candidato
routes.post(
  "/admin/candidatos/:id_usuario/formacao",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(FormacaoSchema, "body"), // <--- Valida a formação
  adminController.addFormacao,
);

// Adicionar formação acadêmica ao candidato
routes.post(
  "/admin/candidatos/:id_usuario/experiencia",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"), // <--- Valida o ID
  validate(ExperienciaSchema, "body"), // <--- Valida a experiência
  adminController.addExperiencia,
);

// Adicionar competência ao candidato
routes.post(
  "/admin/candidatos/:id_usuario/competencia",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(VincularCompetenciaSchema, "body"),
  adminController.addCompetencia,
);

// --- UTILITÁRIOS ---
routes.patch(
  "/admin/usuarios/:id/reset-senha",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.resetarSenhaUsuario,
);

// --- GESTÃO DE EQUIPE (MASTER) ---

// Cadastrar novo admin
routes.post(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  validate(CadastroAdminSchema, "body"), // <--- Blindagem com SenhaForte
  adminController.cadastrarNovoAdmin,
);

// Listar todos os admins
routes.get(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarAdmins,
);

// Atualizar dados de um admin (incluindo status e senha)
routes.put(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarAdminSchema, "body"),
  adminController.atualizarAdmin,
);

// Excluir um admin (Soft Delete, na verdade só desativa)
routes.delete(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.excluirAdmin,
);

// Resetar senha de um usuário
routes.patch(
  "/admin/usuarios/:id/reset-senha",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ResetSenhaSchema, "body"),
  adminController.resetarSenhaUsuario,
);

// Gerenciar créditos da empresa
routes.patch(
  "/admin/empresas/:id/creditos",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(CreditosSchema, "body"),
  adminController.atualizarCreditos,
);

// VAGAS

// Rota da Empresa (Cria como Rascunho ou Analise)
// Criar Rascunho (Etapa 1) [cite: 161, 163, 165]
routes.post(
  "/vagas",
  authMiddleware(["EMPRESA"]),
  validate(vagaSchema),
  vagaController.cadastrar,
);

// Atualizar Etapas do Wizard
routes.put(
  "/vagas/:id",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  validate(vagaSchema, "body"),
  vagaController.atualizar,
);

// Rota do Admin (Cadastro Assistido/Balcão - Direto como ATIVA)
routes.post(
  "/admin/vagas/balcao",
  authMiddleware(["ADM"]),
  validate(vagaSchema),
  adminVagaController.adminCadastrarVaga,
);

// A empresa só consegue atualizar se a vaga NÃO estiver "ATIVA" [Regra de Negócio]
routes.put(
  "/vagas/:id",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  validate(vagaSchema, "body"),
  vagaController.atualizar,
);

// O Admin tem poder de superusuário para editar qualquer vaga
routes.put(
  "/admin/vagas/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(vagaSchema, "body"),
  adminVagaController.adminAtualizarVaga,
);

// Listar vagas da empresa logada com filtros
routes.get(
  "/vagas/minhas-vagas",
  authMiddleware(["EMPRESA"]),
  validate(FiltroVagasEmpresaSchema, "query"),
  vagaController.listarMinhasVagas,
);

// Listar vagas pendentes para moderação (Apenas ADM)
routes.get(
  "/admin/vagas/pendentes",
  authMiddleware(["ADM"]),
  validate(QueryListagemSchema, "query"),
  adminVagaController.listarPendentes,
);

routes.patch(
  "/admin/vagas/:id/moderacao",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ModeracaoVagaSchema, "body"),
  adminVagaController.moderar,
);

// --- OUVIDORIA (Relatos de Candidatos) ---
routes.get(
  "/admin/ouvidoria",
  authMiddleware(["ADM"]),
  adminController.listarOuvidoria,
);

// --- SUPORTE (Tickets Fale Conosco) ---
routes.get(
  "/admin/tickets",
  authMiddleware(["ADM"]),
  validate(QueryListagemSchema, "query"),
  adminController.listarTickets,
);

// Ticket response
routes.patch(
  "/admin/tickets/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.responderTicket,
);

// Rotas de Empresa
routes.post(
  "/vagas/solicitar-midia",
  authMiddleware(["EMPRESA"]),
  validate(SolicitacaoMidiaSchema),
  empresaController.criarSolicitacao,
);

// Rotas de Admin [cite: 41, 44]
routes.get(
  "/admin/midia/pedidos",
  authMiddleware(["ADM"]),
  adminController.listarParaAdmin,
);

//
routes.patch(
  "/admin/midia/pedidos/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(GerenciarMidiaSchema),
  adminController.gerenciarPedido,
);

//  CRUD - Áreas
routes.get("/taxonomia/areas", taxonomiaController.listarAreas);
routes.post(
  "/admin/taxonomia/areas",
  authMiddleware(["ADM"]),
  validate(TaxonomiaSchema),
  taxonomiaController.criarArea,
);
routes.delete(
  "/admin/taxonomia/areas/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  taxonomiaController.excluirArea,
);

// CRUD - Benefícios
routes.get("/taxonomia/beneficios", taxonomiaController.listarBeneficios);
routes.post(
  "/admin/taxonomia/beneficios",
  authMiddleware(["ADM"]),
  validate(TaxonomiaSchema),
  taxonomiaController.criarBeneficio,
);
routes.delete(
  "/admin/taxonomia/beneficios/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  taxonomiaController.excluirBeneficio,
);

// Empresa  - Gestão de Perfil Institucional (Logo, Banner, Quem Somos, Links)
routes.put(
  "/empresa/perfil",
  authMiddleware(["EMPRESA"]),
  validate(AtualizarPerfilEmpresaSchema, "body"),
  empresaController.atualizarPerfil,
);

// Visualizar Kanban da Vaga
routes.get(
  "/empresa/vagas/:id_vaga/kanban",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  candidatoController.index,
);

// Mover Card individual
routes.patch(
  "/empresa/candidaturas/:id_candidatura/mover",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  candidatoController.mover,
);

// Ações em Massa (Reprovar)
routes.post(
  "/empresa/candidaturas/reprovar-lote",
  authMiddleware(["EMPRESA"]),
  candidatoController.reprovarEmLote,
);

// Safe Send (Botão Publicar)
routes.post(
  "/empresa/vagas/:id_vaga/notificar-candidatos",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  candidatoController.publicarNotificacoes,
);

// Perfil completo do candidato (Dados + Currículo + Agendamento + Avaliação)
routes.get(
  "/empresa/candidaturas/:id_candidatura/perfil",
  authMiddleware(["EMPRESA"]),
  candidatoController.verPerfil,
);

// Salvar avaliação interna
routes.post(
  "/empresa/candidaturas/:id_candidatura/avaliar",
  authMiddleware(["EMPRESA"]),
  candidatoController.avaliar,
);

// Agendar Entrevista
routes.post(
  "/empresa/candidaturas/:id_candidatura/agendar",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  validate(AgendarEntrevistaSchema, "body"),
  candidatoController.agendar,
);

// Configurar quais campos aparecem no resumo estratégico do candidato
routes.patch(
  "/empresa/vagas/:id_vaga/configurar-destaques",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  validate(ConfigurarDestaquesSchema, "body"),
  candidatoController.salvarConfiguracaoDestaques,
);

// Encerrar vaga
routes.post(
  "/empresa/vagas/:id_vaga/encerrar",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  vagaController.encerrar,
);

// Duplicar vaga
routes.post(
  "/empresa/vagas/:id_vaga/duplicar",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  vagaController.duplicar,
);

// Histórico de movimentações (Timeline) do candidato
routes.get(
  "/empresa/candidaturas/:id_candidatura/historico",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  candidatoController.verHistorico,
);

// Resumo operacional para a tela inicial da empresa
routes.get(
  "/empresa/dashboard",
  authMiddleware(["EMPRESA"]),
  validate(DashboardFiltroSchema, "query"),
  empresaController.dashboard,
);

// Rota para o candidato se inscrever em uma vaga
routes.post(
  "/candidatos/inscrever",
  authMiddleware(["CANDIDATO"]),
  validate(CandidaturaSchema, "body"),
  candidaturaController.aplicar,
);

// Candidato desiste de uma vaga específica
routes.patch(
  "/candidatos/candidaturas/:id_candidatura/desistir",
  authMiddleware(["CANDIDATO"]),
  validate(IdParamSchema, "params"),
  candidaturaController.desistir,
);

// Trocar senha
routes.patch(
  "/usuarios/:id/trocar-senha",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  validate(IdParamSchema, "params"),
  validate(TrocarSenha, "body"),
  usuarioController.trocarSenha,
);

routes.get(
  "/me",
  authMiddleware(["ADM", "EMPRESA", "CANDIDATO"]),
  usuarioController.obterPerfil
);


routes.get("/vagas/:id", vagaController.buscarDetalhes);

export default routes;
