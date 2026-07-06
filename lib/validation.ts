// Anti-fraude mínimo da V1.

// Teto de pontos plausível por partida.
// Partida-alvo 60–120s, +10 por item bom, ~1 item bom/seg no pico razoável.
// 500 pontos já é um jogo excelente; acima disso é suspeito.
export const TETO_PONTOS = 2000;

export function pontosPlausiveis(pontos: unknown): pontos is number {
  return (
    typeof pontos === "number" &&
    Number.isInteger(pontos) &&
    pontos >= 0 &&
    pontos <= TETO_PONTOS
  );
}

// Sanitiza e valida o nome do jogador (VARCHAR(25)).
export function sanitizarNome(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const limpo = nome.trim().replace(/\s+/g, " ").slice(0, 25);
  if (limpo.length < 1) return null;
  return limpo;
}

// Sanitiza WhatsApp: mantém só dígitos, valida tamanho BR (10–13 dígitos).
export function sanitizarWhatsapp(whatsapp: unknown): string | null {
  if (whatsapp == null || whatsapp === "") return null;
  if (typeof whatsapp !== "string") return null;
  const digitos = whatsapp.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return null;
  return digitos;
}
