import { transporter } from "../config/mailer";

export class EmailService {
  async enviarEmailAtivacao(email: string, nome: string, token: string) {
    const urlAtivacao = `${process.env.APP_URL}/ativar/${token}`;

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Ative sua conta - ACI Vagas",
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Olá, ${nome}!</h2>
          <p>Seja bem-vindo à plataforma <strong>ACI Vagas</strong>.</p>
          <p>Para concluir seu cadastro e começar a se candidatar às vagas, clique no botão abaixo:</p>
          <a href="${urlAtivacao}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Ativar Minha Conta
          </a>
          <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p>${urlAtivacao}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Este link é válido para ativação imediata. </p>
        </div>
      `,
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailContatoEmpresa(
    nome: string,
    emailContato: string,
    assunto: string,
    mensagem: string,
  ) {
    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: "comercial@acipanambi.com.br",
      replyTo: emailContato,
      subject: `Novo Contato pelo Site: ${assunto}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; color: #333; background-color: #f4f7f6; padding: 20px; border-radius: 8px;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #0056b3; margin-top: 0;">Novo formulário de contato - ACI Vagas</h2>
            <p style="font-size: 16px;"><strong>Empresa/Responsável:</strong> ${nome}</p>
            <p style="font-size: 16px;"><strong>E-mail:</strong> ${emailContato}</p>
            <p style="font-size: 16px;"><strong>Assunto:</strong> ${assunto}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 16px; font-weight: bold;">Mensagem:</p>
            <p style="white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">${mensagem}</p>
          </div>
        </div>
      `,
    };

    return await transporter.sendMail(mailOptions);
  }

  async enviarEmailRecuperacao(email: string, nome: string, token: string) {
    // O seu Front-end deve ter uma rota que receba este token na URL
    const urlRecuperacao = `${process.env.APP_URL}/recuperar-senha/${token}`;

    const mailOptions = {
      from: `"ACI Vagas" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Recuperação de Senha - ACI Vagas",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; color: #333;">
          <h2>Olá, ${nome}!</h2>
          <p>Recebemos um pedido para redefinir a senha da sua conta no ACI Vagas.</p>
          <p>Se foi você que fez a solicitação, clique no botão abaixo para criar uma nova senha:</p>
          <a href="${urlRecuperacao}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 20px 0;">
            Redefinir Minha Senha
          </a>
          <p>Ou copie e cole o link abaixo no seu navegador:</p>
          <p style="word-break: break-all; color: #666;">${urlRecuperacao}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">
            Este link tem validade de 1 hora. Se você não solicitou a troca de senha, pode ignorar este e-mail. Sua conta continuará segura.
          </p>
        </div>
      `,
    };

    return await transporter.sendMail(mailOptions);
  }
}
