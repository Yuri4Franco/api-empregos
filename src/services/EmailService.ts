import { transporter } from "../config/mailer.js";


export class EmailService {
  // ============================================================================
  // TEMPLATE BASE DE E-MAIL (Header e Footer)
  // ============================================================================
  private gerarTemplateEmail(conteudoHtml: string): string {
    // ⚠️ SUBSTITUA ESTES LINKS PELAS URLS REAIS DAS SUAS LOGOS APÓS HOSPEDÁ-LAS
    const logoAciVagas = "https://acivagas.com.br/logo-aci-vagas.png";
    const logoAciPanambi =
      "https://acivagas.com.br/logo-site-aci-transparente.png";
    const linkWhatsApp = "https://wa.me/555533759350"; // Link direto pro WhatsApp

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
  // MÉTODOS DE ENVIO (Usando o template base)
  // ============================================================================

  async enviarEmailAtivacao(email: string, nome: string, token: string) {
    const urlAtivacao = `${process.env.APP_URL}/ativar/${token}`;

    const conteudo = `
      <h2 style="color: #003366; margin-top: 0;">Olá, ${nome}!</h2>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Ative sua conta - ACI Vagas",
      html: this.gerarTemplateEmail(conteudo), // ✨ Aplicando o template
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailAvisoExclusao(email: string, nome: string, token: string) {
    const urlAtivacao = `${process.env.APP_URL}/ativar/${token}`;

    const conteudo = `
      <h2 style="color: #003366; margin-top: 0;">Olá, ${nome}!</h2>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Aviso: Sua conta será excluída em 5 dias",
      html: this.gerarTemplateEmail(conteudo),
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailAvisoOcultacao(email: string, nome: string) {
    const urlLogin = `${process.env.APP_URL}/entrar`;

    const conteudo = `
      <h2 style="color: #003366; margin-top: 0;">Sentimos sua falta, ${nome}!</h2>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Aviso: Seu currículo ficará oculto em 20 dias",
      html: this.gerarTemplateEmail(conteudo),
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailPerfilOcultado(email: string, nome: string) {
    const urlLogin = `${process.env.APP_URL}/entrar`;

    const conteudo = `
      <h2 style="color: #333; margin-top: 0;">Seu perfil foi ocultado temporariamente</h2>
      <p>Olá, ${nome}. Como seu último acesso à <strong>ACI Vagas</strong> foi há mais de 6 meses, seu perfil foi movido para o modo oculto para as empresas da região.</p>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Seu perfil foi ocultado por inatividade - ACI Vagas",
      html: this.gerarTemplateEmail(conteudo),
    };

    return await transporter.sendMail(mailOptions);
  }


  async enviarEmailContatoEmpresa(
    nome: string,
    emailContato: string,
    assunto: string,
    mensagem: string,
  ) {
    const conteudo = `
      <h2 style="color: #003366; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Novo Contato Pelo Site</h2>
      <p><strong>Empresa/Responsável:</strong> ${nome}</p>
      <p><strong>E-mail de Retorno:</strong> <a href="mailto:${emailContato}" style="color: #0056b3;">${emailContato}</a></p>
      <p><strong>Assunto:</strong> ${assunto}</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 25px;">
        <p style="margin-top: 0; font-weight: bold; color: #475569; font-size: 14px;">Mensagem:</p>
        <p style="white-space: pre-wrap; margin-bottom: 0; color: #334155;">${mensagem}</p>
      </div>
    `;

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: "comercial@acipanambi.com.br",
      replyTo: emailContato,
      subject: `Nova Mensagem: ${assunto}`,
      html: this.gerarTemplateEmail(conteudo), // ✨ Aplicando o template
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailRecuperacao(email: string, nome: string, token: string) {
    const urlRecuperacao = `${process.env.APP_URL}/recuperar-senha/${token}`;

    const conteudo = `
      <h2 style="color: #003366; margin-top: 0;">Olá, ${nome}!</h2>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Recuperação de Senha - ACI Vagas",
      html: this.gerarTemplateEmail(conteudo),
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailLembretePerfil(email: string, nome: string) {
    const urlPainel = `${process.env.APP_URL}/painel/curriculo`;

    const conteudo = `
      <h2 style="color: #003366; margin-top: 0;">Olá, ${nome}!</h2>
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

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Aumente suas chances: complete seu perfil na ACI Vagas",
      html: this.gerarTemplateEmail(conteudo),
    };

    return await transporter.sendMail(mailOptions);
  }
}
