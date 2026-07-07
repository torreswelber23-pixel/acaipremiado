import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { garantirCicloAtivo, posicaoDoScore } from "@/lib/ciclo";
import { emitirCupom } from "@/lib/cupom";
import {
  pontosPlausiveis,
  sanitizarNome,
  sanitizarWhatsapp,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/score  { transacao_id, nome, whatsapp, pontos }
// Valida que a transação está paga e ainda não gerou score. Grava no ciclo ativo,
// emite o cupom e retorna a posição no ranking.
export async function POST(req: Request) {
  let body: {
    transacao_id?: number;
    nome?: string;
    whatsapp?: string;
    pontos?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const transacaoId = Number(body.transacao_id);
  const nome = sanitizarNome(body.nome);
  const whatsapp = sanitizarWhatsapp(body.whatsapp);

  if (!Number.isInteger(transacaoId) || transacaoId <= 0) {
    return NextResponse.json({ erro: "transacao_id inválido" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ erro: "nome obrigatório (1–25 caracteres)" }, { status: 400 });
  }
  if (!pontosPlausiveis(body.pontos)) {
    return NextResponse.json({ erro: "pontuação inválida" }, { status: 400 });
  }
  const pontos = body.pontos as number;

  const ciclo = await garantirCicloAtivo();

  try {
    const resultado = await withTransaction(async (client) => {
      // Trava a transação para evitar corrida (duas partidas com o mesmo Pix).
      const txRes = await client.query<{
        id: number;
        status: string;
        motorista_id: number | null;
      }>(
        "SELECT id, status, motorista_id FROM transacoes WHERE id = $1 FOR UPDATE",
        [transacaoId]
      );
      const tx = txRes.rows[0];
      if (!tx) {
        return { erro: "transação não encontrada", http: 404 } as const;
      }
      if (tx.status !== "pago") {
        return { erro: "transação não está paga", http: 402 } as const;
      }

      // Uma transação = um score (também garantido por UNIQUE no banco).
      const jaTem = await client.query<{ id: number }>(
        "SELECT id FROM scores WHERE transacao_id = $1",
        [transacaoId]
      );
      if (jaTem.rows.length > 0) {
        return { erro: "esta ficha já registrou uma pontuação", http: 409 } as const;
      }

      const scoreRes = await client.query<{ id: number }>(
        `INSERT INTO scores (ciclo_id, nome_jogador, whatsapp, pontos, motorista_id, transacao_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [ciclo.id, nome, whatsapp, pontos, tx.motorista_id, transacaoId]
      );
      const scoreId = scoreRes.rows[0].id;

      const cupom = await emitirCupom(client, scoreId);

      return { scoreId, cupom, http: 200 } as const;
    });

    if ("erro" in resultado) {
      return NextResponse.json({ erro: resultado.erro }, { status: resultado.http });
    }

    const posicao = await posicaoDoScore(ciclo.id, resultado.scoreId);

    return NextResponse.json({
      score_id: resultado.scoreId,
      pontos,
      posicao,
      cupom: resultado.cupom
        ? {
            codigo: resultado.cupom.codigo,
            expira_em: resultado.cupom.expira_em,
          }
        : null,
    });
  } catch (err: unknown) {
    // Violação de UNIQUE (transacao_id) em corrida = ficha já usada.
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json(
        { erro: "esta ficha já registrou uma pontuação" },
        { status: 409 }
      );
    }
    console.error("Erro em /api/score:", err);
    return NextResponse.json(
      { erro: "Erro no servidor ao salvar a pontuação. Tente de novo." },
      { status: 500 }
    );
  }
}
