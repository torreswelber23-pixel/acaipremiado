import type { PixProvider } from "./types";
import { devPix } from "./dev";

export type { PixProvider } from "./types";

// Seleciona o provedor Pix conforme PIX_PROVIDER.
//
// V1 traz apenas o provedor "dev" (auto-confirma, sem cobrança real), suficiente
// para rodar o piloto do loop completo. Para produção, implemente um provider
// que satisfaça a interface PixProvider (lib/pix/types.ts) para o seu PSP —
// Mercado Pago, Efí (Gerencianet) ou Asaas — e registre-o aqui:
//
//   case "mercadopago": return mercadoPagoPix;
//
// O contrato é: criarCobranca() gera a cobrança e devolve { txid, copiaECola };
// interpretarWebhook() lê o corpo/headers do POST do PSP e devolve { txid, pago }.
export function getPixProvider(): PixProvider {
  const nome = (process.env.PIX_PROVIDER || "dev").toLowerCase();
  switch (nome) {
    case "dev":
      return devPix;
    default:
      throw new Error(
        `Provedor Pix "${nome}" não implementado. ` +
          `Implemente em lib/pix/ seguindo a interface PixProvider e registre em lib/pix/index.ts. ` +
          `Para testar sem Pix real, use PIX_PROVIDER=dev.`
      );
  }
}
