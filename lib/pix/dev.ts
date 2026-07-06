import type {
  PixProvider,
  CriarCobrancaInput,
  CriarCobrancaResult,
  WebhookResult,
} from "./types";

// Provedor de desenvolvimento: NÃO cobra ninguém.
// Gera um "copia-e-cola" falso e confirma o pagamento automaticamente,
// permitindo testar o loop completo (partida -> score -> cupom) sem Pix real.
export const devPix: PixProvider = {
  nome: "dev",
  autoConfirma: true,

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResult> {
    const rand = Math.random().toString(36).slice(2, 10);
    return {
      txid: `dev-${input.transacaoId}-${rand}`,
      copiaECola:
        `00020126BR.GOV.BCB.PIX-DEV520400005303986540${input.valor.toFixed(2)}` +
        `5802BR5909CARPETACAI6008MACAPA62070503***6304DEV0`,
    };
  },

  async interpretarWebhook(body: unknown): Promise<WebhookResult | null> {
    // Em dev aceitamos um corpo simples { txid, pago }.
    if (body && typeof body === "object" && "txid" in body) {
      const b = body as { txid: string; pago?: boolean };
      return { txid: b.txid, pago: b.pago !== false };
    }
    return null;
  },
};
