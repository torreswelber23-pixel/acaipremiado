// Aplica o schema e o seed no banco apontado por DATABASE_URL.
// Uso: node scripts/setup-db.mjs   (carrega .env.local / .env se existir)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Carrega variáveis de .env.local / .env sem dependência externa.
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (existsSync(p)) {
    for (const linha of readFileSync(p, "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida. Preencha .env.local (veja .env.example).");
  process.exit(1);
}

const ssl =
  process.env.DATABASE_SSL === "disable" ? undefined : { rejectUnauthorized: false };

const client = new pg.Client({ connectionString, ssl });

const schema = readFileSync(join(root, "db", "schema.sql"), "utf8");
const seed = readFileSync(join(root, "db", "seed.sql"), "utf8");

try {
  await client.connect();
  console.log("Aplicando schema...");
  await client.query(schema);
  console.log("Aplicando seed...");
  await client.query(seed);
  console.log("✅ Banco pronto.");
} catch (err) {
  console.error("❌ Erro ao configurar o banco:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
