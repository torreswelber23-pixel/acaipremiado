// Schema e seed embutidos como string, para o endpoint /api/setup poder
// criar as tabelas em qualquer Postgres (útil no deploy, sem rodar SQL na mão).
// Mantenha em sincronia com db/schema.sql e db/seed.sql.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS motoristas (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL,
  whatsapp      VARCHAR(20) NOT NULL,
  qr_token      VARCHAR(40) NOT NULL UNIQUE,
  comissao_pct  NUMERIC(4,2) NOT NULL DEFAULT 25.00,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parceiros (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(100) NOT NULL,
  texto_cupom      VARCHAR(255) NOT NULL,
  validade_dias    INT NOT NULL DEFAULT 7,
  status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
  paga_mensalidade BOOLEAN NOT NULL DEFAULT false,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ciclos (
  id                SERIAL PRIMARY KEY,
  data_inicio       TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim          TIMESTAMPTZ NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'ativo',
  vencedor_score_id INT,
  patrocinador_id   INT REFERENCES parceiros(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_um_ciclo_ativo
  ON ciclos ((status)) WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS transacoes (
  id            SERIAL PRIMARY KEY,
  motorista_id  INT REFERENCES motoristas(id),
  valor         NUMERIC(6,2) NOT NULL DEFAULT 2.00,
  status        VARCHAR(20) NOT NULL DEFAULT 'pendente',
  txid          VARCHAR(64) UNIQUE,
  copia_e_cola  TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scores (
  id            SERIAL PRIMARY KEY,
  ciclo_id      INT NOT NULL REFERENCES ciclos(id),
  nome_jogador  VARCHAR(25) NOT NULL,
  whatsapp      VARCHAR(20),
  pontos        INT NOT NULL,
  motorista_id  INT REFERENCES motoristas(id),
  transacao_id  INT UNIQUE REFERENCES transacoes(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scores_ranking ON scores (ciclo_id, pontos DESC);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ciclos_vencedor_score_id_fkey'
  ) THEN
    ALTER TABLE ciclos
      ADD CONSTRAINT ciclos_vencedor_score_id_fkey
      FOREIGN KEY (vencedor_score_id) REFERENCES scores(id);
  END IF;
END $do$;

CREATE TABLE IF NOT EXISTS cupons (
  id            SERIAL PRIMARY KEY,
  parceiro_id   INT NOT NULL REFERENCES parceiros(id),
  score_id      INT NOT NULL REFERENCES scores(id),
  codigo        VARCHAR(20) NOT NULL UNIQUE,
  emitido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     TIMESTAMPTZ NOT NULL,
  resgatado     BOOLEAN NOT NULL DEFAULT false,
  resgatado_em  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons (codigo);
`;

export const SEED_SQL = `
INSERT INTO parceiros (nome, texto_cupom, validade_dias, status, paga_mensalidade)
SELECT 'Açaiteria do Ponto', '10% de desconto em qualquer tamanho de açaí', 7, 'ativo', false
WHERE NOT EXISTS (SELECT 1 FROM parceiros);

INSERT INTO motoristas (nome, whatsapp, qr_token, comissao_pct, ativo)
SELECT 'Motorista Teste', '5596990000000', 'demo', 25.00, true
WHERE NOT EXISTS (SELECT 1 FROM motoristas WHERE qr_token = 'demo');
`;
