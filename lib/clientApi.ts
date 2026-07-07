// Helper de fetch para o cliente que NUNCA estoura ao ler a resposta.
// Trata corpo vazio / não-JSON (ex.: 500 sem body) e devolve um erro amigável.
export interface Resp<T> {
  ok: boolean;
  status: number;
  data: T | null;
  erro: string | null;
}

export async function pedir<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<Resp<T>> {
  try {
    const r = await fetch(url, opts);
    const txt = await r.text();
    let data: unknown = null;
    if (txt) {
      try {
        data = JSON.parse(txt);
      } catch {
        // resposta não-JSON (página de erro, corpo vazio, etc.)
      }
    }
    const obj = data as { erro?: string } | null;
    const erro = !r.ok
      ? obj?.erro || `Servidor indisponível (${r.status}). Tente de novo.`
      : data == null
      ? "Resposta inválida do servidor."
      : null;
    return { ok: r.ok && data != null, status: r.status, data: data as T, erro };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      erro: "Sem conexão com o servidor. Verifique sua internet.",
    };
  }
}
