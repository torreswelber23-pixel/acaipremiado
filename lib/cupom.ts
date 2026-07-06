import type { PoolClient } from "pg";

export interface Cupom {
  id: number;
  parceiro_id: number;
  score_id: number;
  codigo: string;
  emitido_em: string;
  expira_em: string;
  resgatado: boolean;
  resgatado_em: string | null;
}

// Emite um cupom para um score, dentro de uma transação existente.
// Escolhe o parceiro ativo mais antigo. Código único no formato ACAI0001.
export async function emitirCupom(
  client: PoolClient,
  scoreId: number
): Promise<Cupom | null> {
  const parceiroRes = await client.query<{
    id: number;
    validade_dias: number;
  }>(
    "SELECT id, validade_dias FROM parceiros WHERE status = 'ativo' ORDER BY id ASC LIMIT 1"
  );
  const parceiro = parceiroRes.rows[0];
  if (!parceiro) return null; // sem parceiro configurado, não emite cupom

  // Insere com código temporário curto (único) e depois grava o código final
  // baseado no id sequencial. Tudo na mesma transação.
  const insRes = await client.query<{ id: number }>(
    `INSERT INTO cupons (parceiro_id, score_id, codigo, expira_em)
     VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)
     RETURNING id`,
    [parceiro.id, scoreId, `T${scoreId}`, String(parceiro.validade_dias)]
  );
  const id = insRes.rows[0].id;

  const finalRes = await client.query<Cupom>(
    `UPDATE cupons
     SET codigo = 'ACAI' || lpad(id::text, 4, '0')
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return finalRes.rows[0];
}
