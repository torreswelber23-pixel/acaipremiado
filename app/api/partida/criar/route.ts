import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { garantirCicloAtivo } from "@/lib/ciclo";
import { getPixProvider } from "@/lib/pix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALOR_FICHA = Number(process.env.VALOR_FICHA || "2.00");

// POST /api/partida/criar  { qr_token }
// Cria uma transação Pix pendente vinculada ao motorista do QR e devolve o
// copia-e-cola para o passageiro pagar.
export async function POST(req: Request) {
  let body: { qr_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const qrToken = (body.qr_token || "").trim();
  if (!qrToken) {
    return NextResponse.json({ erro: "qr_token obrigatório" }, { status: 400 });
  }

  const motorista = await queryOne<{ id: number; ativo: boolean }>(
    "SELECT id, ativo FROM motoristas WHERE qr_token = $1",
    [qrToken]
  );
  if (!motorista || !motorista.ativo) {
    return NextResponse.json(
      { erro: "QR do motorista inválido ou inativo" },
      { status: 404 }
    );
  }

  await garantirCicloAtivo();

  // Cria a transação pendente.
  const transacao = await queryOne<{ id: number }>(
    `INSERT INTO transacoes (motorista_id, valor, status)
     VALUES ($1, $2, 'pendente')
     RETURNING id`,
    [motorista.id, VALOR_FICHA]
  );
  const transacaoId = transacao!.id;

  // Gera a cobrança no provedor Pix.
  const pix = getPixProvider();
  const cobranca = await pix.criarCobranca({
    transacaoId,
    valor: VALOR_FICHA,
    descricao: "CarPet Açaí - ficha",
  });

  await queryOne(
    "UPDATE transacoes SET txid = $1, copia_e_cola = $2 WHERE id = $3 RETURNING id",
    [cobranca.txid, cobranca.copiaECola, transacaoId]
  );

  return NextResponse.json({
    transacao_id: transacaoId,
    valor: VALOR_FICHA,
    copia_e_cola: cobranca.copiaECola,
    provedor: pix.nome,
    // Em modo dev o pagamento é confirmado automaticamente no primeiro polling.
    modo_dev: pix.autoConfirma,
  });
}
