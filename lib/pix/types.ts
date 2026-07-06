export interface CriarCobrancaInput {
  transacaoId: number;
  valor: number; // em reais, ex: 2.00
  descricao: string;
}

export interface CriarCobrancaResult {
  txid: string; // id da cobrança no provedor
  copiaECola: string; // payload Pix (BR Code) para copia-e-cola / QR
}

// Resultado da interpretação de um webhook do provedor.
export interface WebhookResult {
  txid: string;
  pago: boolean;
}

export interface PixProvider {
  nome: string;
  criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResult>;
  // Interpreta o corpo do webhook do provedor e diz qual txid foi pago.
  interpretarWebhook(body: unknown, headers: Headers): Promise<WebhookResult | null>;
  // dev = confirma pagamento sozinho (sem provedor externo).
  autoConfirma: boolean;
}
