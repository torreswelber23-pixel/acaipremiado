import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/motorista/:qrToken/relatorio?desde=YYYY-MM-DD
// Relatório de comissão: total de fichas pagas e comissão devida no período.
export async function GET(
  req: Request,
  { params }: { params: { qrToken: string } }
) {
  const qrToken = (params.qrToken || "").trim();
  if (!qrToken) {
    return NextResponse.json({ erro: "qr_token obrigatório" }, { status: 400 });
  }

  const motorista = await queryOne<{
    id: number;
    nome: string;
    comissao_pct: string;
  }>("SELECT id, nome, comissao_pct FROM motoristas WHERE qr_token = $1", [qrToken]);

  if (!motorista) {
    return NextResponse.json({ erro: "motorista não encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde"); // opcional, ISO date

  const filtroData = desde ? "AND pago_em >= $2" : "";
  const paramsArr: unknown[] = desde ? [motorista.id, desde] : [motorista.id];

  const resumo = await queryOne<{ fichas: string; total: string }>(
    `SELECT COUNT(*)::int AS fichas, COALESCE(SUM(valor), 0) AS total
     FROM transacoes
     WHERE motorista_id = $1 AND status = 'pago' ${filtroData}`,
    paramsArr
  );

  const fichas = Number(resumo?.fichas || 0);
  const totalBruto = Number(resumo?.total || 0);
  const comissaoPct = Number(motorista.comissao_pct);
  const comissao = Number(((totalBruto * comissaoPct) / 100).toFixed(2));

  return NextResponse.json({
    motorista: motorista.nome,
    comissao_pct: comissaoPct,
    fichas_pagas: fichas,
    total_bruto: totalBruto,
    comissao_devida: comissao,
    desde: desde || null,
  });
}
