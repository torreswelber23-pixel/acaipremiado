import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getPixProvider } from "@/lib/pix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pix/webhook
// O provedor Pix chama aqui ao confirmar o pagamento. Marca a transação 'pago'.
export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // alguns provedores mandam corpo vazio + query params; seguimos assim mesmo
  }

  const pix = getPixProvider();
  const resultado = await pix.interpretarWebhook(body, req.headers);

  if (!resultado || !resultado.txid) {
    return NextResponse.json({ ok: false, motivo: "webhook não reconhecido" }, { status: 400 });
  }

  if (!resultado.pago) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const atualizada = await queryOne<{ id: number }>(
    `UPDATE transacoes
     SET status = 'pago', pago_em = now()
     WHERE txid = $1 AND status = 'pendente'
     RETURNING id`,
    [resultado.txid]
  );

  // Idempotente: se já estava paga (ou não existe), respondemos ok mesmo assim
  // para o provedor não ficar reenviando.
  return NextResponse.json({ ok: true, transacao_id: atualizada?.id ?? null });
}
