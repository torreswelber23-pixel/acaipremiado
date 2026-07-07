import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { SCHEMA_SQL, SEED_SQL } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST/GET /api/setup?secret=<CRON_SECRET>
// Cria as tabelas (idempotente) e o seed no banco apontado por DATABASE_URL.
// Rode uma vez após conectar um banco novo. Protegido pelo CRON_SECRET.
async function setup(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const informado = url.searchParams.get("secret") || "";
  const auth = req.headers.get("authorization");

  if (!secret) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurado. Defina-o nas variáveis de ambiente antes de rodar o setup." },
      { status: 400 }
    );
  }
  if (informado !== secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado (secret inválido)" }, { status: 401 });
  }

  try {
    await query(SCHEMA_SQL);
    await query(SEED_SQL);
    const tabelas = await query<{ tabela: string }>(
      `SELECT table_name AS tabela FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`
    );
    return NextResponse.json({
      ok: true,
      mensagem: "Banco configurado com sucesso.",
      tabelas: tabelas.map((t) => t.tabela),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: "Falha ao configurar o banco.", detalhe: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return setup(req);
}
export async function POST(req: Request) {
  return setup(req);
}
