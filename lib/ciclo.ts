import { query, queryOne, withTransaction } from "./db";
import { proximoDomingo2359 } from "./time";

export interface Ciclo {
  id: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  vencedor_score_id: number | null;
  patrocinador_id: number | null;
}

// Garante que existe exatamente um ciclo 'ativo' e o retorna.
// Se não existir, cria um novo com data_fim = próximo domingo 23:59 (Belém).
export async function garantirCicloAtivo(): Promise<Ciclo> {
  const existente = await queryOne<Ciclo>(
    "SELECT * FROM ciclos WHERE status = 'ativo' ORDER BY id DESC LIMIT 1"
  );
  if (existente) return existente;

  const dataFim = proximoDomingo2359();
  // Escolhe um patrocinador ativo (o mais antigo), se houver.
  const patrocinador = await queryOne<{ id: number }>(
    "SELECT id FROM parceiros WHERE status = 'ativo' ORDER BY id ASC LIMIT 1"
  );
  const novo = await queryOne<Ciclo>(
    `INSERT INTO ciclos (data_fim, status, patrocinador_id)
     VALUES ($1, 'ativo', $2)
     RETURNING *`,
    [dataFim.toISOString(), patrocinador?.id ?? null]
  );
  return novo!;
}

export interface LinhaRanking {
  posicao: number;
  nome_jogador: string;
  pontos: number;
  score_id: number;
}

// Ranking do ciclo: MELHOR score único por jogador (mais justo e simples).
// Empate desfeito por quem alcançou o score primeiro.
export async function rankingDoCiclo(
  cicloId: number,
  limite = 20
): Promise<LinhaRanking[]> {
  const rows = await query<{
    nome_jogador: string;
    pontos: number;
    score_id: number;
  }>(
    `SELECT DISTINCT ON (nome_jogador)
        nome_jogador, pontos, id AS score_id
     FROM scores
     WHERE ciclo_id = $1
     ORDER BY nome_jogador, pontos DESC, criado_em ASC`,
    [cicloId]
  );
  rows.sort((a, b) => b.pontos - a.pontos || a.score_id - b.score_id);
  return rows
    .slice(0, limite)
    .map((r, i) => ({ posicao: i + 1, ...r }));
}

// Posição de um score específico dentro do ranking (melhor score por jogador).
export async function posicaoDoScore(
  cicloId: number,
  scoreId: number
): Promise<number> {
  const todos = await rankingDoCiclo(cicloId, 100000);
  const linha = todos.find((l) => l.score_id === scoreId);
  if (linha) return linha.posicao;
  // Jogador tem um score melhor que este: devolve a posição do jogador.
  const jogador = await queryOne<{ nome_jogador: string }>(
    "SELECT nome_jogador FROM scores WHERE id = $1",
    [scoreId]
  );
  const porNome = todos.find((l) => l.nome_jogador === jogador?.nome_jogador);
  return porNome?.posicao ?? todos.length + 1;
}

// Fecha o ciclo ativo, define o vencedor e abre um novo ciclo.
// Retorna o ciclo encerrado e o vencedor (se houver scores).
export async function fecharCicloAtivo(): Promise<{
  encerrado: Ciclo | null;
  vencedor: { score_id: number; nome_jogador: string; whatsapp: string | null; pontos: number } | null;
  novo: Ciclo | null;
}> {
  return withTransaction(async (client) => {
    const ativoRes = await client.query<Ciclo>(
      "SELECT * FROM ciclos WHERE status = 'ativo' ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );
    const ativo = ativoRes.rows[0];
    if (!ativo) return { encerrado: null, vencedor: null, novo: null };

    // Maior score do ciclo (desempate pelo primeiro a alcançar).
    const vencRes = await client.query<{
      id: number;
      nome_jogador: string;
      whatsapp: string | null;
      pontos: number;
    }>(
      `SELECT id, nome_jogador, whatsapp, pontos
       FROM scores
       WHERE ciclo_id = $1
       ORDER BY pontos DESC, criado_em ASC
       LIMIT 1`,
      [ativo.id]
    );
    const venc = vencRes.rows[0] ?? null;

    await client.query(
      "UPDATE ciclos SET status = 'encerrado', vencedor_score_id = $1 WHERE id = $2",
      [venc?.id ?? null, ativo.id]
    );

    const dataFim = proximoDomingo2359();
    const novoRes = await client.query<Ciclo>(
      `INSERT INTO ciclos (data_fim, status, patrocinador_id)
       VALUES ($1, 'ativo', $2)
       RETURNING *`,
      [dataFim.toISOString(), ativo.patrocinador_id]
    );

    return {
      encerrado: { ...ativo, status: "encerrado", vencedor_score_id: venc?.id ?? null },
      vencedor: venc
        ? { score_id: venc.id, nome_jogador: venc.nome_jogador, whatsapp: venc.whatsapp, pontos: venc.pontos }
        : null,
      novo: novoRes.rows[0],
    };
  });
}
