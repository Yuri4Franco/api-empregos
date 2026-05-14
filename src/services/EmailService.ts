import { transporter } from "../config/mailer";

export class EmailService {
  async enviarEmailAtivacao(email: string, nome: string, token: string) {
    const urlAtivacao = `${process.env.APP_URL}/ativar/${token}`;

    const mailOptions = {
      from: `"ACI Empregos" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Ative sua conta - ACI Empregos Panambi",
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Olá, ${nome}!</h2>
          <p>Seja bem-vindo à plataforma <strong>ACI Empregos</strong>.</p>
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
}
