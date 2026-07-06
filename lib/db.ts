import { Pool, type PoolClient, type QueryResultRow } from "pg";

// Pool único reaproveitado entre invocações (importante em serverless).
declare global {
  // eslint-disable-next-line no-var
  var _acaiPool: Pool | undefined;
}

function createPool(): Pool {
  // Aceita DATABASE_URL (padrão) ou POSTGRES_URL (Vercel Postgres injeta esse nome).
  const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.example para .env.local e preencha."
    );
  }
  // Supabase e a maioria dos Postgres gerenciados exigem SSL.
  const ssl =
    process.env.DATABASE_SSL === "disable"
      ? undefined
      : { rejectUnauthorized: false };
  return new Pool({ connectionString, ssl, max: 5 });
}

export function getPool(): Pool {
  if (!global._acaiPool) {
    global._acaiPool = createPool();
  }
  return global._acaiPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Executa uma função dentro de uma transação (BEGIN/COMMIT/ROLLBACK).
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
