-- CarPet Açaí — Schema V1 (Postgres / Supabase)
-- Idempotente: pode rodar mais de uma vez.
-- Ordem de criação respeita as foreign keys.

-- =========================================================
-- Motoristas (comissão pura sobre fichas)
-- =========================================================
CREATE TABLE IF NOT EXISTS motoristas (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL,
  whatsapp      VARCHAR(20) NOT NULL,
  qr_token      VARCHAR(40) NOT NULL UNIQUE,      -- identifica o carro pela URL do QR
  comissao_pct  NUMERIC(4,2) NOT NULL DEFAULT 25.00,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- Parceiros (comércios que dão desconto / patrocinam)
-- =========================================================
CREATE TABLE IF NOT EXISTS parceiros (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(100) NOT NULL,
  texto_cupom      VARCHAR(255) NOT NULL,           -- "10% de desconto em qualquer lanche"
  validade_dias    INT NOT NULL DEFAULT 7,
  status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
  paga_mensalidade BOOLEAN NOT NULL DEFAULT false,  -- false = parceiro "aperto de mão"
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- Ciclos de ranking de 7 dias
-- =========================================================
CREATE TABLE IF NOT EXISTS ciclos (
  id                SERIAL PRIMARY KEY,
  data_inicio       TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim          TIMESTAMPTZ NOT NULL,                    -- domingo 23:59 (America/Belem)
  status            VARCHAR(20) NOT NULL DEFAULT 'ativo',    -- 'ativo' | 'encerrado'
  vencedor_score_id INT,                                     -- preenchido no fechamento
  patrocinador_id   INT REFERENCES parceiros(id),            -- açaiteria que banca o prêmio da semana
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Garante no máximo um ciclo ativo por vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_um_ciclo_ativo
  ON ciclos ((status)) WHERE status = 'ativo';

-- =========================================================
-- Transações Pix
-- =========================================================
CREATE TABLE IF NOT EXISTS transacoes (
  id            SERIAL PRIMARY KEY,
  motorista_id  INT REFERENCES motoristas(id),
  valor         NUMERIC(6,2) NOT NULL DEFAULT 2.00,
  status        VARCHAR(20) NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'pago' | 'expirado'
  txid          VARCHAR(64) UNIQUE,                       -- id do provedor Pix
  copia_e_cola  TEXT,                                     -- payload Pix (BR Code) devolvido pelo provedor
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em       TIMESTAMPTZ
);

-- =========================================================
-- Scores das partidas (uma linha por partida jogada)
-- =========================================================
CREATE TABLE IF NOT EXISTS scores (
  id            SERIAL PRIMARY KEY,
  ciclo_id      INT NOT NULL REFERENCES ciclos(id),
  nome_jogador  VARCHAR(25) NOT NULL,
  whatsapp      VARCHAR(20),                              -- contato do vencedor + lista B2B
  pontos        INT NOT NULL,
  motorista_id  INT REFERENCES motoristas(id),            -- de qual carro veio a jogada
  transacao_id  INT UNIQUE REFERENCES transacoes(id),     -- Pix que pagou esta partida (1 score por Pix)
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scores_ranking ON scores (ciclo_id, pontos DESC);

-- FK circular ciclos.vencedor_score_id -> scores.id (adicionada depois que scores existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ciclos_vencedor_score_id_fkey'
  ) THEN
    ALTER TABLE ciclos
      ADD CONSTRAINT ciclos_vencedor_score_id_fkey
      FOREIGN KEY (vencedor_score_id) REFERENCES scores(id);
  END IF;
END $$;

-- =========================================================
-- Cupons emitidos (rastreamento de resgate = argumento B2B)
-- =========================================================
CREATE TABLE IF NOT EXISTS cupons (
  id            SERIAL PRIMARY KEY,
  parceiro_id   INT NOT NULL REFERENCES parceiros(id),
  score_id      INT NOT NULL REFERENCES scores(id),
  codigo        VARCHAR(20) NOT NULL UNIQUE,      -- ex: ACAI0001
  emitido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     TIMESTAMPTZ NOT NULL,
  resgatado     BOOLEAN NOT NULL DEFAULT false,
  resgatado_em  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons (codigo);
