import { NextResponse } from "next/server";
import { fecharCicloAtivo } from "@/lib/ciclo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fecha o ciclo da semana, define o vencedor e abre um novo ciclo.
// Agendado pelo Vercel Cron (ver vercel.json): domingo 23:59 America/Belem
// = segunda 02:59 UTC → "59 2 * * 1".
//
// Proteção: exige o header Authorization: Bearer <CRON_SECRET>.
// O Vercel Cron envia automaticamente esse header quando CRON_SECRET existe.
async function fechar(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }
  }

  const resultado = await fecharCicloAtivo();

  if (!resultado.encerrado) {
    return NextResponse.json({ ok: true, mensagem: "nenhum ciclo ativo para fechar" });
  }

  // TODO: notificar o vencedor por WhatsApp (resultado.vencedor.whatsapp)
  // para combinar a retirada do litro de açaí no parceiro.
  return NextResponse.json({
    ok: true,
    ciclo_encerrado: resultado.encerrado.id,
    novo_ciclo: resultado.novo?.id ?? null,
    vencedor: resultado.vencedor,
  });
}

export async function GET(req: Request) {
  return fechar(req);
}
export async function POST(req: Request) {
  return fechar(req);
}
