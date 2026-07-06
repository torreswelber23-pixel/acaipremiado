import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cupom/resgatar  { codigo }
// Parceiro informa o código no balcão; marca como resgatado (uma única vez).
export async function POST(req: Request) {
  let body: { codigo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const codigo = (body.codigo || "").trim().toUpperCase();
  if (!codigo) {
    return NextResponse.json({ erro: "código obrigatório" }, { status: 400 });
  }

  const resultado = await withTransaction(async (client) => {
    const cupomRes = await client.query<{
      id: number;
      codigo: string;
      resgatado: boolean;
      resgatado_em: string | null;
      expira_em: string;
      texto_cupom: string;
      parceiro_nome: string;
    }>(
      `SELECT c.id, c.codigo, c.resgatado, c.resgatado_em, c.expira_em,
              p.texto_cupom, p.nome AS parceiro_nome
       FROM cupons c
       JOIN parceiros p ON p.id = c.parceiro_id
       WHERE c.codigo = $1
       FOR UPDATE OF c`,
      [codigo]
    );
    const cupom = cupomRes.rows[0];
    if (!cupom) {
      return { erro: "cupom não encontrado", http: 404 } as const;
    }
    if (new Date(cupom.expira_em).getTime() < Date.now()) {
      return { erro: "cupom expirado", http: 410, cupom } as const;
    }
    if (cupom.resgatado) {
      return {
        erro: "cupom já resgatado",
        http: 409,
        cupom,
      } as const;
    }

    const upd = await client.query<{ resgatado_em: string }>(
      "UPDATE cupons SET resgatado = true, resgatado_em = now() WHERE id = $1 RETURNING resgatado_em",
      [cupom.id]
    );
    return { ok: true, cupom, resgatado_em: upd.rows[0].resgatado_em } as const;
  });

  if ("erro" in resultado) {
    return NextResponse.json(
      {
        erro: resultado.erro,
        cupom: resultado.cupom
          ? {
              codigo: resultado.cupom.codigo,
              texto_cupom: resultado.cupom.texto_cupom,
              parceiro: resultado.cupom.parceiro_nome,
              resgatado_em: resultado.cupom.resgatado_em,
            }
          : null,
      },
      { status: resultado.http }
    );
  }

  return NextResponse.json({
    ok: true,
    codigo: resultado.cupom.codigo,
    texto_cupom: resultado.cupom.texto_cupom,
    parceiro: resultado.cupom.parceiro_nome,
    resgatado_em: resultado.resgatado_em,
  });
}
