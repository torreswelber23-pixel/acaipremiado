import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { garantirCicloAtivo, rankingDoCiclo } from "@/lib/ciclo";
import { msRestantes, formatarRestante } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ranking?limite=20
// Top N do ciclo ativo + tempo restante até domingo + patrocinador da semana.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limite = Math.min(Math.max(Number(searchParams.get("limite") || 20), 1), 100);

  const ciclo = await garantirCicloAtivo();
  const top = await rankingDoCiclo(ciclo.id, limite);

  let patrocinador: { nome: string; texto_cupom: string } | null = null;
  if (ciclo.patrocinador_id) {
    patrocinador = await queryOne<{ nome: string; texto_cupom: string }>(
      "SELECT nome, texto_cupom FROM parceiros WHERE id = $1",
      [ciclo.patrocinador_id]
    );
  }

  const fim = new Date(ciclo.data_fim);
  const restanteMs = msRestantes(fim);

  return NextResponse.json({
    ciclo_id: ciclo.id,
    fecha_em: ciclo.data_fim,
    tempo_restante: formatarRestante(restanteMs),
    tempo_restante_ms: restanteMs,
    patrocinador,
    ranking: top,
  });
}
