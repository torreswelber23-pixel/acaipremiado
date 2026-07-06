import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getPixProvider } from "@/lib/pix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/partida/status/:transacaoId
// Frontend faz polling. Retorna se a partida já pode começar.
export async function GET(
  _req: Request,
  { params }: { params: { transacaoId: string } }
) {
  const id = Number(params.transacaoId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "transacao_id inválido" }, { status: 400 });
  }

  let transacao = await queryOne<{
    id: number;
    status: string;
  }>("SELECT id, status FROM transacoes WHERE id = $1", [id]);

  if (!transacao) {
    return NextResponse.json({ erro: "transação não encontrada" }, { status: 404 });
  }

  // Em modo dev, confirma o pagamento automaticamente (simula o passageiro pagando).
  const pix = getPixProvider();
  if (pix.autoConfirma && transacao.status === "pendente") {
    transacao =
      (await queryOne<{ id: number; status: string }>(
        "UPDATE transacoes SET status = 'pago', pago_em = now() WHERE id = $1 AND status = 'pendente' RETURNING id, status",
        [id]
      )) ?? transacao;
  }

  // Já existe score gerado por esta transação?
  const scoreExistente = await queryOne<{ id: number }>(
    "SELECT id FROM scores WHERE transacao_id = $1",
    [id]
  );

  return NextResponse.json({
    status: transacao.status,
    liberado: transacao.status === "pago" && !scoreExistente,
    ja_jogou: !!scoreExistente,
  });
}
