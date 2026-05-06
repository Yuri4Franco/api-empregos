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
import { ExperienciaController } from "../controllers/ExperienciaController.js";
import { FormacaoController } from "../controllers/FormacaoController.js";
import { CompetenciaController } from "../controllers/CompetenciaController.js";
import { AreaAtuacaoController } from "../controllers/AreaAtuacaoController.js";
import { BancoTalentosController } from "../controllers/BancoTalentosController.js";
import { NotificacaoController } from "../controllers/NotificacaoController.js";
import { EmpresaDashboardController } from "../controllers/EmpresaDashboardController.js";
import { EmpresaPublicaController } from "../controllers/EmpresaPublicaController.js";
import {
  uploadBanner,
  uploadLogo,
  uploadCandidato,
} from "../middlewares/upload.js";
import {
  AgendarEntrevistaSchema,
  AtualizarAdminSchema,
  AtualizarPerfilCompletoSchema,
  AtualizarPerfilEmpresaSchema,
  AtualizarUsuarioSchema,
  CadastroAdminSchema,
  cadastroCandidatoManualSchema,
  candidatoAreaSchema,
  candidatoCompetenciaSchema,
  CandidaturaSchema,
  ColaboradorSchema,
  ConfigurarDestaquesSchema,
  CreditosSchema,
  DashboardFiltroSchema,
  EmpresaSchema,
  experienciaSchema,
  ExperienciaSchema,
  FiltroUsuarioSchema,
  FiltroVagasEmpresaSchema,
  formacaoSchema,
  FormacaoSchema,
  GerenciarMidiaSchema,
  IdParamSchema,
  ModeracaoVagaSchema,
  QueryListagemSchema,
  ResetSenhaSchema,
  sincronizarAreasSchema,
  SolicitacaoMidiaSchema,
  StatusEmpresaSchema,
  StatusUsuarioSchema,
  TaxonomiaSchema,
  TrocarSenha,
  updateCandidatoSchema,
  vagaSchema,
  VincularCompetenciaSchema,
} from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.js";
import { TaxonomiaController } from "../controllers/TaxonomiaController.js";
import { validatePhotoUpload } from "../middlewares/validatePhotoUpload.js";
import { DashboardCandidatoController } from "../controllers/DashboardCandidatoController.js";

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
const experienciaController = new ExperienciaController();
const formacaoController = new FormacaoController();
const competenciaController = new CompetenciaController();
const areaController = new AreaAtuacaoController();
const bancoController = new BancoTalentosController();
const dashboardCandidatoController = new DashboardCandidatoController();
const notificacaoController = new NotificacaoController();
const empresaDashboardController = new EmpresaDashboardController();
const empresaPublicaController = new EmpresaPublicaController();

routes.post("/login", authController.login);

routes.post("/register", authController.register);

routes.post("/ativar", authController.ativar);

routes.post("/auth/reenviar-ativacao", authController.reenviarAtivacao);

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

// Adicionar usuário a empres - fora do piloto
routes.post(
  "/admin/empresas/:id/usuarios",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ColaboradorSchema, "body"),
  adminController.cadastrarUsuarioEmEmpresa,
);

// Gerenciamento de Usuários - fora do piloto
routes.put(
  "/admin/usuarios/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarUsuarioSchema, "body"),
  adminController.atualizarUsuario,
);

// Alternar status do usuário - ok
routes.patch(
  "/admin/usuarios/:id/status",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(StatusUsuarioSchema, "body"),
  adminController.alternarStatusUsuario,
);

// Visualização de Usuários Empresa - ok
routes.get(
  "/admin/usuarios-empresa",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarUsuariosEmpresa,
);

// Detalhes de um usuário específico - fora do piloto
routes.get(
  "/admin/usuarios/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.obterDetalhesUsuario,
);

// Deletar um admin - fora do piloto
routes.delete(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.excluirAdmin,
);

routes.get("/empresas/perfil/:slug", empresaPublicaController.buscarPorSlug);

// --- CANDIDATOS ---

// Listar todos os candidatos - fora do piloto
routes.get(
  "/admin/candidatos",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarCandidatos,
);

// Cadastrar candidato manualmente - pode ser
routes.post(
  "/admin/candidatos/manual",
  authMiddleware(["ADM"]),
  validate(cadastroCandidatoManualSchema, "body"),
  adminController.cadastrarCandidatoManual,
);

// Obter currículo completo de um candidat - fora do piloto
routes.get(
  "/admin/candidatos/:id/curriculo",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.obterCurriculo,
);

// Atualizar perfil completo do candidato (dados pessoais + perfil profissional)- fora do piloto
routes.put(
  "/admin/candidatos/:id/perfil-completo",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarPerfilCompletoSchema, "body"),
  adminController.atualizarPerfilCompleto,
);

// Adicionar experiência profissional ao candidato - pode ser
routes.post(
  "/admin/candidatos/:id_usuario/formacao",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(FormacaoSchema, "body"), // <--- Valida a formação
  adminController.addFormacao,
);

// Adicionar formação acadêmica ao candidato - pode ser
routes.post(
  "/admin/candidatos/:id_usuario/experiencia",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"), // <--- Valida o ID
  validate(ExperienciaSchema, "body"), // <--- Valida a experiência
  adminController.addExperiencia,
);

// Adicionar competência ao candidato - pode ser
routes.post(
  "/admin/candidatos/:id_usuario/competencia",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(VincularCompetenciaSchema, "body"),
  adminController.addCompetencia,
);

// --- UTILITÁRIOS --- ok
routes.patch(
  "/admin/usuarios/:id/reset-senha",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.resetarSenhaUsuario,
);

// --- GESTÃO DE EQUIPE (MASTER) ---

// Cadastrar novo admin - pode ser
routes.post(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  validate(CadastroAdminSchema, "body"), // <--- Blindagem com SenhaForte
  adminController.cadastrarNovoAdmin,
);

// Listar todos os admins - pode ser
routes.get(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  validate(FiltroUsuarioSchema, "query"),
  adminController.listarAdmins,
);

// Atualizar dados de um admin (incluindo status e senha) - pode ser
routes.put(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarAdminSchema, "body"),
  adminController.atualizarAdmin,
);

// Excluir um admin (Soft Delete, na verdade só desativa) - fora do piloto
routes.delete(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  adminController.excluirAdmin,
);

// Resetar senha de um usuário - ok
routes.patch(
  "/admin/usuarios/:id/reset-senha",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ResetSenhaSchema, "body"),
  adminController.resetarSenhaUsuario,
);

// Gerenciar créditos da empresa - ok
routes.patch(
  "/admin/empresas/:id/creditos",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(CreditosSchema, "body"),
  adminController.atualizarCreditos,
);

// VAGAS

// Rota da Empresa (Cria como Rascunho ou Analise)
// Criar Rascunho (Etapa 1) - ok
routes.post(
  "/vagas",
  authMiddleware(["EMPRESA"]),
  vagaController.cadastrar
);


// Atualizar Etapas do Wizard -ok
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

// A empresa atualizar
routes.put(
  "/vagas/:id",
  authMiddleware(["EMPRESA"]),
  validate(IdParamSchema, "params"),
  validate(vagaSchema, "body"),
  vagaController.atualizar,
);

// O Admin tem poder de superusuário para editar qualquer vaga - fora do piloto
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

// Listar vagas pendentes para moderação (Apenas ADM) - ok
routes.get(
  "/admin/vagas/pendentes",
  authMiddleware(["ADM"]),
  validate(QueryListagemSchema, "query"),
  adminVagaController.listarPendentes,
);

// ok
routes.patch(
  "/admin/vagas/:id/moderacao",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ModeracaoVagaSchema, "body"),
  adminVagaController.moderar,
);

//ok
routes.patch(
  "/admin/vagas/:id/confirmar-pagamento",
  authMiddleware(["ADM"]),
  adminVagaController.confirmarPagamento,
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

// Rotas de Admin
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

routes.get(
  "/perguntas-eliminatorias",
  taxonomiaController.listarPerguntasEliminatorias,
);

routes.get("/taxonomia/competencias", taxonomiaController.listarCompetencias);

// Empresa  - Gestão de Perfil Institucional
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
  candidatoController.index,
);

// Mover Card individual
routes.patch(
  "/empresa/candidaturas/:id_candidatura/mover",
  authMiddleware(["EMPRESA"]),
  candidatoController.mover,
);

// Avançar candidato para a próxima etapa
routes.patch(
  "/empresa/candidaturas/:id_candidatura/avancar",
  authMiddleware(["EMPRESA"]),
  candidaturaController.avancar,
);

// Avançar em massa
routes.patch(
  "/empresa/candidaturas/avancar-massa",
  authMiddleware(["EMPRESA"]),
  candidaturaController.avancarMassa,
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
  validate(AgendarEntrevistaSchema, "body"),
  candidatoController.agendar,
);

// Configurar quais campos aparecem no resumo estratégico do candidato
routes.patch(
  "/empresa/vagas/:id_vaga/configurar-destaques",
  authMiddleware(["EMPRESA"]),

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
  "/vagas/:id_vaga/candidatar",
  authMiddleware(["CANDIDATO"]),
  candidaturaController.aplicar,
);

// Trocar senha
routes.patch(
  "/user/trocar-senha",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  validate(TrocarSenha, "body"),
  usuarioController.alterarSenha,
);

routes.patch(
  "/user/definir-senha-inicial",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  usuarioController.definirSenhaInicial,
);

routes.get(
  "/me",
  authMiddleware(["ADM", "EMPRESA", "CANDIDATO"]),
  usuarioController.obterPerfil,
);

// Rota de Logo (Empresa)
routes.patch(
  "/empresa/perfil/logo",
  authMiddleware(["EMPRESA"]),
  uploadLogo.single("logo"),
  validatePhotoUpload,
  empresaController.atualizarLogo,
);

// Rota de Banner (Empresa - Detalhes da Vaga)
routes.patch(
  "/empresa/perfil/banner",
  authMiddleware(["EMPRESA"]),
  uploadBanner.single("banner"),
  validatePhotoUpload,
  empresaController.atualizarBanner,
);

// Rota para a empresa logada ver seus próprios dados
routes.get(
  "/empresa/perfil",
  authMiddleware(["EMPRESA"]),
  empresaController.meuPerfil,
);

// Retorna os benefícios que a empresa configurou no perfil dela
routes.get(
  "/empresa/meus-beneficios-padrao",
  authMiddleware(["EMPRESA"]),
  empresaController.meusBeneficiosPadrao,
);

// Rota para o candidato obter seu próprio currículo completo
routes.get(
  "/candidato/meu-curriculo",
  authMiddleware(["CANDIDATO"]),
  candidatoController.meuCurriculo,
);

routes.get(
  "/candidato/vaga/:id_vaga/status",  
  authMiddleware(["CANDIDATO"]),
  candidaturaController.verificarStatus
);

// Rota para o candidato atualizar seu próprio currículo completo
routes.put(
  "/candidato/meu-curriculo",
  authMiddleware(["CANDIDATO"]),
  validate(updateCandidatoSchema, "body"),
  candidatoController.actualizar,
);

// Rotas de Experiência Profissional
routes.post(
  "/candidato/experiencias",
  authMiddleware(["CANDIDATO"]),
  validate(experienciaSchema),
  experienciaController.store,
);

routes.put(
  "/candidato/experiencias/:id",
  authMiddleware(["CANDIDATO"]),
  validate(experienciaSchema),
  experienciaController.update,
);

routes.delete(
  "/candidato/experiencias/:id",
  authMiddleware(["CANDIDATO"]),
  experienciaController.destroy,
);

// Rotas de Formação Acadêmica
routes.post(
  "/candidato/formacoes",
  authMiddleware(["CANDIDATO"]),
  validate(formacaoSchema),
  formacaoController.store,
);

routes.put(
  "/candidato/formacoes/:id",
  authMiddleware(["CANDIDATO"]),
  validate(formacaoSchema),
  formacaoController.update,
);

routes.delete(
  "/candidato/formacoes/:id",
  authMiddleware(["CANDIDATO"]),
  formacaoController.destroy,
);

// Rotas de Competências do Candidato
routes.post(
  "/candidato/competencias",
  authMiddleware(["CANDIDATO"]),
  validate(candidatoCompetenciaSchema),
  competenciaController.store,
);

routes.delete(
  "/candidato/competencias/:id_competencia",
  authMiddleware(["CANDIDATO"]),
  competenciaController.destroy,
);

routes.post(
  "/candidato/areas",
  authMiddleware(["CANDIDATO"]),
  validate(candidatoAreaSchema),
  areaController.store,
);

routes.delete(
  "/candidato/areas/:id_area",
  authMiddleware(["CANDIDATO"]),
  areaController.destroy,
);

routes.patch(
  "/candidato/visibilidade",
  authMiddleware(["CANDIDATO"]),
  candidatoController.toggleVisibilidade,
);

routes.put(
  "/candidato/areas/sync",
  authMiddleware(["CANDIDATO"]),
  validate(sincronizarAreasSchema),
  areaController.sync,
);

routes.patch(
  "/candidato/foto-perfil",
  authMiddleware(["CANDIDATO"]),
  uploadCandidato.single("foto"),
  candidatoController.uploadFoto,
);

// ✅ CORRETO: As rotas fixas (estáticas) vêm primeiro!
routes.get(
  "/empresas/banco-talentos",
  authMiddleware(["EMPRESA"]),
  bancoController.listar,
);

routes.get(
  "/empresas/banco-talentos/areas",
  authMiddleware(["EMPRESA"]),
  bancoController.listarAreasDash,
);

// 1. Listar os Favoritos (Coloque antes de rotas com :param)
routes.get(
  "/empresas/banco-talentos/favoritos",
  authMiddleware(["EMPRESA"]),
  bancoController.listarFavoritos,
);

// 👇 Agora sim, as rotas com parâmetros dinâmicos (:id_candidato) ficam por último
routes.get(
  "/empresas/banco-talentos/:id_candidato",
  authMiddleware(["EMPRESA"]),
  bancoController.detalharCurriculo,
);

routes.post(
  "/empresas/banco-talentos/:id_candidato/desbloquear",
  authMiddleware(["EMPRESA"]),
  bancoController.desbloquear,
);

routes.get(
  "/empresas/meus-desbloqueados",
  authMiddleware(["EMPRESA"]),
  bancoController.listarGaveta,
);

// 2. Alternar Favorito (Botão de Salvar/Remover)
routes.post(
  "/empresas/banco-talentos/:id_candidato/favorito",
  authMiddleware(["EMPRESA"]),
  bancoController.alternarFavorito,
);

routes.get(
  "/candidato/dashboard/metricas",
  authMiddleware(["CANDIDATO"]),
  dashboardCandidatoController.metricas,
);

routes.get(
  "/candidato/dashboard/candidaturas-recentes",
  authMiddleware(["CANDIDATO"]),
  dashboardCandidatoController.candidaturasRecentes,
);

routes.get(
  "/candidato/dashboard/vagas-recomendadas",
  authMiddleware(["CANDIDATO"]),
  dashboardCandidatoController.vagasRecomendadas,
);

routes.get(
  "/candidato/minhas-candidaturas",
  authMiddleware(["CANDIDATO"]),
  candidaturaController.listarMinhasCandidaturas,
);

routes.get(
  "/candidato/agendamentos",
  authMiddleware(["CANDIDATO"]),
  candidaturaController.listarAgendamentos,
);

routes.patch(
  "/candidato/candidaturas/:id_candidatura/desistir",
  authMiddleware(["CANDIDATO"]),
  candidaturaController.desistir,
);

routes.get(
  "/notificacoes",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  notificacaoController.listar,
);

routes.get(
  "/notificacoes/nao-lidas",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  notificacaoController.contarNaoLidas,
);

routes.patch(
  "/notificacoes/marcar-lidas",
  authMiddleware(["CANDIDATO", "EMPRESA", "ADM"]),
  notificacaoController.marcarLidas,
);



routes.delete(
  "/usuario/conta",
  authMiddleware(["CANDIDATO", "EMPRESA"]),
  usuarioController.deletarConta,
);

routes.get(
  "/empresa/dashboard/estatisticas",
  authMiddleware(["EMPRESA", "ADM"]),
  empresaDashboardController.estatisticas
);

// Lista as vagas ativas com o termômetro de candidatos
routes.get(
  "/empresa/dashboard/vagas-resumo",
  authMiddleware(["EMPRESA", "ADM"]),
  empresaDashboardController.resumoVagas
);

// Próximas entrevistas agendadas
routes.get(
  "/empresa/dashboard/proximas-entrevistas",
  authMiddleware(["EMPRESA", "ADM"]),
  empresaDashboardController.proximasEntrevistas
);


routes.get("/admin/vagas", authMiddleware(["ADM"]), vagaController.listarAdmin);

routes.get("/vagas", vagaController.listarPublicas);

routes.get("/vagas/filtros-disponiveis", vagaController.filtrosDisponiveis);

routes.get("/vagas/:id", vagaController.detalharPublica);

export default routes;
