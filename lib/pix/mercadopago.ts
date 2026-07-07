import type {
  PixProvider,
  CriarCobrancaInput,
  CriarCobrancaResult,
  WebhookResult,
} from "./types";

const MP_API = "https://api.mercadopago.com";

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurado. Defina o Access Token do Mercado Pago nas variáveis de ambiente."
    );
  }
  return t;
}

function webhookUrl(): string | undefined {
  const explicit = process.env.PIX_WEBHOOK_URL;
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/api/pix/webhook`;
  return undefined;
}

// Provedor Pix real via Mercado Pago.
// O dinheiro cai na conta MP dona do MERCADOPAGO_ACCESS_TOKEN (a chave Pix é
// configurada dentro da própria conta Mercado Pago).
export const mercadoPagoPix: PixProvider = {
  nome: "mercadopago",
  autoConfirma: false,

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResult> {
    const notification = webhookUrl();
    const body = {
      transaction_amount: Number(input.valor),
      description: input.descricao,
      payment_method_id: "pix",
      external_reference: String(input.transacaoId),
      payer: { email: `passageiro-${input.transacaoId}@carpetacai.com.br` },
      ...(notification ? { notification_url: notification } : {}),
    };

    const r = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `carpet-${input.transacaoId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await r.json().catch(() => null)) as
      | {
          id?: number | string;
          point_of_interaction?: {
            transaction_data?: { qr_code?: string };
          };
          message?: string;
        }
      | null;

    if (!r.ok || !data?.id) {
      throw new Error(
        `Mercado Pago recusou a cobrança (${r.status}): ${data?.message || "erro desconhecido"}`
      );
    }

    const qr = data.point_of_interaction?.transaction_data?.qr_code;
    if (!qr) {
      throw new Error("Mercado Pago não retornou o código Pix (qr_code).");
    }

    return { txid: String(data.id), copiaECola: qr };
  },

  async interpretarWebhook(rawBody: unknown): Promise<WebhookResult | null> {
    // O Mercado Pago notifica com { type: "payment", data: { id } }.
    const b = rawBody as
      | { type?: string; action?: string; data?: { id?: string | number } }
      | null;
    const tipo = b?.type || b?.action || "";
    if (!b?.data?.id || !`${tipo}`.includes("payment")) return null;

    const paymentId = String(b.data.id);
    // Busca o pagamento para saber o status real (não confie só no webhook).
    const r = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!r.ok) return null;
    const pag = (await r.json().catch(() => null)) as { status?: string } | null;

    return { txid: paymentId, pago: pag?.status === "approved" };
  },
};
