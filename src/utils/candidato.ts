export function calcularPontuacaoCandidato(c: any): number {
  if (!c) return 0;

  let pontuacao = 0;

  // 📌 1. Dados Básicos e Contato (15 pontos)
  if (c.cpf) pontuacao += 5;
  if (c.data_nascimento) pontuacao += 5;
  if (c.whatsapp) pontuacao += 5;

  // 📌 2. Endereço Completo (15 pontos - 2.5 cada)
  if (c.endereco?.cep) pontuacao += 2.5;
  if (c.endereco?.logradouro) pontuacao += 2.5;
  if (c.endereco?.numero) pontuacao += 2.5;
  if (c.endereco?.bairro) pontuacao += 2.5;
  if (c.endereco?.cidade) pontuacao += 2.5;
  if (c.endereco?.uf) pontuacao += 2.5;

  // 📌 3. Áreas de Atuação (15 pontos)
  if (c.areas_atuacao?.length > 0) pontuacao += 15;

  // 📌 4. Experiência Profissional (20 pontos - Aumentamos o peso aqui)
  // ✨ Se marcou "primeiro emprego", ganha a pontuação total de experiência automaticamente,
  // mesmo que o array de experiências venha vazio.
  if (c.primeiro_emprego === true || c.experiencias?.length > 0) {
    pontuacao += 20;
  }

  // 📌 5. Formação Acadêmica (20 pontos)
  if (c.formacoes?.length > 0) pontuacao += 20;

  // 📌 6. Competências/Habilidades (10 pontos)
  if (c.competencias?.length > 0) pontuacao += 10;

  // 📌 7. Textos de Apresentação (5 pontos no total - Peso reduzido)
  if (c.resumo_profissional) pontuacao += 2.5;
  if (c.objetivo_profissional) pontuacao += 2.5;

  return Math.round(pontuacao);
}
