import { transporter } from "../config/mailer.js";
import { filaEmails } from "../queues/emailQueue.js";

export class EmailService {
  // ============================================================================
  // TEMPLATE BASE DE E-MAIL (Header e Footer)
  // ============================================================================
  private gerarTemplateEmail(conteudoHtml: string): string {
    const logoAciVagas = "https://acivagas.com.br/logo-aci-vagas.png";
    const logoAciPanambi =
      "https://acivagas.com.br/logo-site-aci-transparente.png";
    const linkWhatsApp = "https://wa.me/555533759350";

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7f6; padding: 20px 10px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                
                <tr>
                  <td align="center" style="background-color: #003366; padding: 30px 20px;">
                    <img src="${logoAciVagas}" alt="ACI Vagas" style="max-height: 50px; width: auto; display: block;" />
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                    ${conteudoHtml}
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 40px 30px; text-align: center; color: #64748b; font-size: 14px; line-height: 1.5;">
                    <img src="${logoAciPanambi}" alt="ACI Panambi" style="max-height: 40px; width: auto; margin-bottom: 20px; display: inline-block;" />
                    
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #334155;">Associação Comercial e Industrial de Panambi</p>
                    <p style="margin: 0 0 5px 0;">R. Konrad Adenauer, 555 - Sala B - Centro</p>
                    <p style="margin: 0 0 15px 0;">Panambi - RS, 98280-000</p>
                    
                    <p style="margin: 0 0 20px 0;">
                      <a href="mailto:recepcao@aci.panambi.com.br" style="color: #0056b3; text-decoration: none;">recepcao@aci.panambi.com.br</a><br>
                      (55) 3375-9350
                    </p>

                    <a href="${linkWhatsApp}" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 6px; font-size: 14px;">
                      Falar no WhatsApp
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS (Enfileiramento Instantâneo no Redis)
  // ============================================================================

  async enviarEmailAtivacao(email: string, nome: string, token: string) {
    return await filaEmails.add("email-ativacao", { email, nome, token });
  }

  async enviarEmailAvisoExclusao(email: string, nome: string, token: string) {
    return await filaEmails.add("email-aviso-exclusao", { email, nome, token });
  }

  async enviarEmailAvisoOcultacao(email: string, nome: string) {
    return await filaEmails.add("email-aviso-ocultacao", { email, nome });
  }

  async enviarEmailPerfilOcultado(email: string, nome: string) {
    return await filaEmails.add("email-perfil-ocultado", { email, nome });
  }

  async enviarEmailRecuperacao(email: string, nome: string, token: string) {
    return await filaEmails.add("email-recuperacao", { email, nome, token }, { priority: 1 });
  }

  async enviarEmailLembretePerfil(email: string, nome: string) {
    return await filaEmails.add("email-lembrete-perfil", { email, nome });
  }

  async enviarEmailReprovacao(
    email: string,
    nome: string,
    tituloVaga: string,
    nomeEmpresa: string,
  ) {
    return await filaEmails.add("email-reprovacao", {
      email,
      nome,
      tituloVaga,
      nomeEmpresa,
    });
  }

  async enviarEmailAvanço(
    email: string,
    nome: string,
    tituloVaga: string,
    nomeEmpresa: string,
    nomeEtapaDestino: string,
  ) {
    return await filaEmails.add("email-avanco", {
      email,
      nome,
      tituloVaga,
      nomeEmpresa,
      nomeEtapaDestino,
    });
  }

  async enviarEmailAprovacao(
    email: string,
    nome: string,
    tituloVaga: string,
    nomeEmpresa: string,
  ) {
    return await filaEmails.add("email-aprovacao", {
      email,
      nome,
      tituloVaga,
      nomeEmpresa,
    });
  }

  async enviarEmailContatoEmpresa(
    nome: string,
    emailContato: string,
    assunto: string,
    mensagem: string,
  ) {
    return await filaEmails.add("email-contato", {
      nome,
      emailContato,
      assunto,
      mensagem,
    });
  }

  // ============================================================================
  // MOTOR REAL DE ENVIO (Chamado EXCLUSIVAMENTE pelo Worker do BullMQ)
  // ============================================================================

  async dispararEmailReal(nomeJob: string, dados: any) {
    let subject = "";
    let conteudoHtml = "";
    let to = dados.email;
    let replyTo: string | undefined = undefined;

    switch (nomeJob) {
      case "email-ativacao": {
        const urlAtivacao = `${process.env.APP_URL}/ativar/${dados.token}`;
        subject = "Ative sua conta - ACI Vagas";
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0;">Olá, ${dados.nome}!</h2>
          <p>Seja bem-vindo à plataforma <strong>ACI Vagas</strong>.</p>
          <p>Para concluir seu cadastro de forma segura e começar a se candidatar às vagas exclusivas da nossa região, clique no botão abaixo:</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlAtivacao}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Ativar Minha Conta
            </a>
          </div>

          <p style="margin-bottom: 5px;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p style="font-size: 13px; color: #0056b3; word-break: break-all;">${urlAtivacao}</p>
        `;
        break;
      }

      case "email-aviso-exclusao": {
        const urlAtivacao = `${process.env.APP_URL}/ativar/${dados.token}`;
        subject = "Aviso: Sua conta será excluída em 5 dias";
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0;">Olá, ${dados.nome}!</h2>
          <p>Notamos que você iniciou o seu cadastro na <strong>ACI Vagas</strong>, mas ainda não ativou a sua conta.</p>
          <p>Para mantermos a segurança e a organização do nosso banco de talentos, cadastros inativos há muito tempo são removidos do sistema. <strong>Sua conta será excluída permanentemente em 5 dias.</strong></p>
          <p>Se você ainda quer ter acesso às vagas exclusivas de Panambi e região, ative sua conta clicando no botão abaixo:</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlAtivacao}" style="background-color: #d9534f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Ativar Minha Conta Agora
            </a>
          </div>

          <p style="margin-bottom: 5px;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p style="font-size: 13px; color: #0056b3; word-break: break-all;">${urlAtivacao}</p>
        `;
        break;
      }

      case "email-aviso-ocultacao": {
        const urlLogin = `${process.env.APP_URL}/entrar`;
        subject = "Aviso: Seu currículo ficará oculto em 20 dias";
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0;">Sentimos sua falta, ${dados.nome}!</h2>
          <p>Faz quase 6 meses que você não acessa a sua conta na <strong>ACI Vagas</strong>.</p>
          <p>Para garantir que as empresas encontrem apenas profissionais disponíveis, nosso sistema oculta automaticamente perfis que estão há muito tempo sem atividade. <strong>Seu perfil ficará oculto para as empresas em 20 dias.</strong></p>
          <p>Se você ainda está em busca de oportunidades ou quer deixar seu currículo visível para futuras vagas, basta fazer o login na plataforma para revalidar seu perfil:</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlLogin}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Acessar Minha Conta e Continuar Visível
            </a>
          </div>

          <p style="font-size: 13px; color: #666;">Basta fazer o login uma única vez para que o seu perfil continue ativo e visível na nossa vitrine de talentos.</p>
        `;
        break;
      }

      case "email-perfil-ocultado": {
        const urlLogin = `${process.env.APP_URL}/entrar`;
        subject = "Seu perfil foi ocultado por inatividade - ACI Vagas";
        conteudoHtml = `
          <h2 style="color: #333; margin-top: 0;">Seu perfil foi ocultado temporariamente</h2>
          <p>Olá, ${dados.nome}. Como seu último acesso à <strong>ACI Vagas</strong> foi há mais de 6 meses, seu perfil foi movido para o modo oculto para as empresas da região.</p>
          <p>Mas não se preocupe! <strong>Nenhum dado seu foi apagado.</strong> Suas experiências, formações e dados continuam salvos com total segurança.</p>
          <p>Se você quiser voltar a aparecer na vitrine de talentos para que as empresas te encontrem, o processo é super simples:</p>
          
          <ol>
            <li>Faça o login na plataforma clicando no botão abaixo.</li>
            <li>Ative a opção <strong>"Perfil Visível para Empresas"</strong>.</li>
          </ol>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlLogin}" style="background-color: #28a745; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Fazer Login e Reativar Perfil
            </a>
          </div>
        `;
        break;
      }

      case "email-recuperacao": {
        const urlRecuperacao = `${process.env.APP_URL}/recuperar-senha/${dados.token}`;
        subject = "Recuperação de Senha - ACI Vagas";
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0;">Olá, ${dados.nome}!</h2>
          <p>Recebemos um pedido para redefinir a senha da sua conta no ACI Vagas.</p>
          <p>Se foi você que fez a solicitação, clique no botão abaixo para criar uma nova senha com segurança:</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlRecuperacao}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Redefinir Minha Senha
            </a>
          </div>

          <p style="margin-bottom: 5px;">Ou copie e cole o link abaixo no seu navegador:</p>
          <p style="font-size: 13px; color: #0056b3; word-break: break-all;">${urlRecuperacao}</p>
          
          <p style="font-size: 13px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <strong>Importante:</strong> Este link tem validade de 1 hora. Se você não solicitou a troca de senha, pode ignorar este e-mail tranquilamente.
          </p>
        `;
        break;
      }

      case "email-lembrete-perfil": {
        const urlPainel = `${process.env.APP_URL}/candidato/meu-curriculo`;
        subject = "Aumente suas chances: complete seu perfil na ACI Vagas";
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0;">Olá, ${dados.nome}!</h2>
          <p>Notamos que o seu perfil na plataforma <strong>ACI Vagas</strong> está ativo, mas ainda faltam algumas informações cruciais para você começar a se destacar para as empresas locais.</p>
          <p>Um currículo completo e com a <strong>visibilidade ativada</strong> aumenta as suas chances de ser chamado para entrevistas.</p>
          <p>Não perca tempo! Acesse seu painel agora mesmo para preencher seus dados, cadastrar suas áreas de interesse e deixar seu perfil pronto para os recrutadores:</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlPainel}" style="background-color: #28a745; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Completar Meu Perfil Agora
            </a>
          </div>

          <p style="font-size: 13px; color: #666;">Se você já atualizou seu perfil recentemente, certifique-se de que a opção "Perfil Visível para Empresas" está ativada nas suas configurações.</p>
        `;
        break;
      }

      case "email-reprovacao": {
        const urlVagas = `${process.env.APP_URL}/vagas`;
        subject = `Atualização sobre o processo seletivo – ${dados.tituloVaga}`;
        conteudoHtml = `
          <h2 style="color: #333333; margin-top: 0;">Atualização sobre sua candidatura 📄</h2>
          <p>Olá, <strong>${dados.nome}</strong>.</p>
          <p>Gostaríamos de agradecer imensamente a sua participação no processo seletivo para a vaga de <strong>${dados.tituloVaga}</strong> na empresa <strong>${dados.nomeEmpresa}</strong>, bem como o tempo e o esforço dedicados em cada etapa.</p>
          <p>Informamos que, neste momento, a empresa optou por seguir com outros profissionais cujas qualificações estão mais alinhadas com os requisitos específicos desta oportunidade atual.</p>
          <p>Valorizamos muito o seu interesse e encorajamos que você continue acompanhando as novas oportunidades publicadas diariamente no nosso portal de talentos da região.</p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlVagas}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Ver Novas Vagas Disponíveis
            </a>
          </div>

          <p style="font-size: 13px; color: #64748b;">Desejamos muito sucesso em sua jornada profissional e esperamos ver sua candidatura em futuras oportunidades da ACI Vagas!</p>
        `;
        break;
      }

      case "email-avanco": {
        const urlMinhasCandidaturas = `${process.env.APP_URL}/candidato/minhas-candidaturas`;
        subject = `🎉 Parabéns! Você avançou na vaga de ${dados.tituloVaga}`;
        conteudoHtml = `
          <h2 style="color: #059669; font-size: 24px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
            Parabéns, ${dados.nome}! 🎉
          </h2>
          
          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
            Temos uma excelente notícia sobre a sua candidatura para a vaga de <strong style="color: #0f172a;">${dados.tituloVaga}</strong> na empresa <strong style="color: #0f172a;">${dados.nomeEmpresa}</strong>.
          </p>

          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
            Você se destacou na triagem inicial e acabou de <strong>avançar no processo seletivo!</strong>
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 18px; border-radius: 8px; margin: 24px 0;">
            <span style="display: block; font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
              Sua nova etapa no processo:
            </span>
            <span style="display: block; font-size: 18px; font-weight: 800; color: #065f46;">
              🎯 ${dados.nomeEtapaDestino}
            </span>
          </div>

          <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-top: 28px; margin-bottom: 12px;">
            O que acontece agora?
          </h3>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 28px;">
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 12px 0;">
              📌 <strong>Acompanhe pela plataforma:</strong> Seu novo status já está liberado no portal ACI Vagas. A empresa poderá disponibilizar instruções, agendas ou recados diretamente no seu painel.
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
              📲 <strong>Fique atento aos seus contatos:</strong> A equipe da <strong>${dados.nomeEmpresa}</strong> também poderá entrar em contato direto via <strong>WhatsApp, E-mail ou Telefone</strong> para passar as orientações detalhadas desta fase.
            </p>
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlMinhasCandidaturas}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 800; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
              Acessar Minhas Candidaturas
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

          <p style="font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; margin: 0;">
            A <strong>Associação Comercial e Industrial de Panambi (ACI Panambi)</strong> parabeniza você por essa conquista profissional e deseja muito sucesso nas próximas etapas! 🚀
          </p>
        `;
        break;
      }

      case "email-aprovacao": {
        const urlMinhasCandidaturas = `${process.env.APP_URL}/candidato/minhas-candidaturas`;
        subject = `🏆 Parabéns! Você foi aprovado(a) na vaga de ${dados.tituloVaga} 🎉`;
        conteudoHtml = `
          <h2 style="color: #059669; font-size: 24px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
            Parabéns, ${dados.nome}! 🏆🎉
          </h2>
          
          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
            Temos a excelente notícia de que a sua candidatura para a vaga de <strong style="color: #0f172a;">${dados.tituloVaga}</strong> foi escolhida na empresa <strong style="color: #0f172a;">${dados.nomeEmpresa}</strong>!
          </p>

          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
            Você foi <strong>aprovado(a) na etapa final</strong> do nosso sistema! A empresa avaliou seu perfil de forma muito positiva e optou pela sua seleção.
          </p>

          <div style="background-color: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
            <span style="display: block; font-size: 13px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
              Status Oficial
            </span>
            <span style="display: block; font-size: 22px; font-weight: 900; color: #059669;">
              🌟 CANDIDATURA APROVADA 🌟
            </span>
          </div>

          <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-top: 28px; margin-bottom: 12px;">
            Próximos passos para admissão / contratação:
          </h3>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 28px;">
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 12px 0;">
              📲 <strong>Fique atento aos seus contatos:</strong> A equipe do RH ou gestão da <strong>${dados.nomeEmpresa}</strong> entrará em contato em breve via <strong>WhatsApp, E-mail ou Telefone</strong> para alinhar exames, documentação e data de início.
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
              📌 <strong>Consulte o Portal:</strong> Acesse o seu painel na ACI Vagas para verificar se há mensagens de boas-vindas ou orientações adicionais deixadas pela empresa.
            </p>
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlMinhasCandidaturas}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 800; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
              Acessar Minhas Candidaturas
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

          <p style="font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; margin: 0;">
            A <strong>Associação Comercial e Industrial de Panambi (ACI Panambi)</strong> tem um imenso orgulho em fazer parte desta sua grande conquista profissional! 🚀✨
          </p>
        `;
        break;
      }

      case "email-contato": {
        to = "comercial@acipanambi.com.br";
        replyTo = dados.emailContato;
        subject = `Nova Mensagem: ${dados.assunto}`;
        conteudoHtml = `
          <h2 style="color: #003366; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Novo Contato Pelo Site</h2>
          <p><strong>Empresa/Responsável:</strong> ${dados.nome}</p>
          <p><strong>E-mail de Retorno:</strong> <a href="mailto:${dados.emailContato}" style="color: #0056b3;">${dados.emailContato}</a></p>
          <p><strong>Assunto:</strong> ${dados.assunto}</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 25px;">
            <p style="margin-top: 0; font-weight: bold; color: #475569; font-size: 14px;">Mensagem:</p>
            <p style="white-space: pre-wrap; margin-bottom: 0; color: #334155;">${dados.mensagem}</p>
          </div>
        `;
        break;
      }

      default:
        throw new Error(`Tipo de job de e-mail desconhecido: ${nomeJob}`);
    }

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: to,
      replyTo: replyTo,
      subject: subject,
      html: this.gerarTemplateEmail(conteudoHtml),
    };

    return await transporter.sendMail(mailOptions);
  }
}
