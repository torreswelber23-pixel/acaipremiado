import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — diagnóstico rápido: a variável de ambiente está setada?
// O banco responde? Sempre devolve JSON (mesmo em falha), pra facilitar o debug.
export async function GET() {
  const envConfigurada = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  try {
    const r = await queryOne<{ um: number }>("SELECT 1 AS um");
    return NextResponse.json({
      ok: true,
      banco: "conectado",
      env_configurada: envConfigurada,
      teste: r?.um ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        banco: "falha na conexão",
        env_configurada: envConfigurada,
        detalhe: (e as Error).message,
        dica: envConfigurada
          ? "A DATABASE_URL está setada mas a conexão falhou. Confira senha, host e porta (use o Transaction pooler, porta 6543)."
          : "Defina DATABASE_URL nas Environment Variables da Vercel e faça Redeploy.",
      },
      { status: 500 }
    );
  }
}
