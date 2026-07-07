# 🍧 CarPet Açaí

Joguinho casual de açaí para o navegador do celular do passageiro em carros de app
em **Macapá-AP**. O passageiro paga **R$ 2 via Pix**, joga uma partida curta e:

- ganha um **cupom de desconto garantido** em parceiro local (o produto que justifica o R$ 2);
- entra no **ranking semanal**; o 1º lugar ao fim de 7 dias leva **1 litro de açaí**.

Três lados ganham: passageiro (diversão + desconto + prêmio), motorista (comissão por
ficha) e comércio local (clientes qualificados).

> V1 buildável conforme o briefing técnico. Loop completo funcionando:
> **jogo → Pix → score → cupom → ranking → ciclo de 7 dias**.

---

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API serverless.
- **Postgres** (Supabase ou qualquer Postgres) via `pg`.
- **Vercel Cron** para fechar o ciclo semanal.
- Jogo em **HTML5 Canvas** (sem assets externos, emojis regionais).

## Estrutura

```
app/
  page.tsx                     Fluxo do passageiro (QR → Pix → jogo → cupom)
  ranking/                     Ranking da semana
  resgate/                     Painel do parceiro (resgatar cupom)
  motorista/                   Relatório de comissão do motorista
  api/
    partida/criar              Cria transação Pix e devolve copia-e-cola
    partida/status/[id]        Polling do pagamento
    pix/webhook                Confirmação do provedor Pix
    score                      Grava pontuação + emite cupom
    ranking                    Top N + tempo restante + patrocinador
    cupom/resgatar             Marca cupom como resgatado
    cron/fechar-ciclo          Fecha ciclo, define vencedor, abre o próximo
    motorista/[qr]/relatorio   Comissão do motorista
components/Game.tsx            Jogo Canvas (tigela, itens, vidas, dificuldade)
lib/                           db, ciclo, cupom, time (timezone), validação, pix/
db/schema.sql                  Schema completo (idempotente)
db/seed.sql                    Parceiro + motorista de teste
vercel.json                   Agendamento do Cron
```

## Rodando localmente

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Configure o ambiente** — copie `.env.example` para `.env.local` e preencha
   `DATABASE_URL` (Supabase: Project Settings → Database → Connection string).
   Deixe `PIX_PROVIDER=dev` para testar sem Pix real.

3. **Crie as tabelas e o seed**
   ```bash
   npm run db:setup
   ```

4. **Suba o app**
   ```bash
   npm run dev
   ```
   Abra <http://localhost:3000>. Sem QR na URL, usa o motorista `demo` do seed.
   No modo `dev`, o pagamento Pix é confirmado automaticamente.

## URLs úteis

| Rota | Para quem |
|------|-----------|
| `/?c=<qr_token>` | Passageiro (o QR do carro carrega o `qr_token`) |
| `/ranking` | Passageiro / divulgação |
| `/resgate` | Parceiro (balcão) digita o código do cupom |
| `/motorista` | Motorista consulta sua comissão |

## Ciclo semanal e timezone

- Sempre existe **um** ciclo `ativo`. Ao abrir, `data_fim` = próximo **domingo 23:59**
  em **America/Belem (UTC-3, sem horário de verão)**.
- O ranking usa o **melhor score único por jogador** (mais justo e simples).
- O Cron do Vercel (`vercel.json`) roda **segunda 02:59 UTC** = domingo 23:59 Belém:
  fecha o ciclo, define o vencedor (maior score, desempate por quem chegou primeiro)
  e abre o próximo ciclo.
- O endpoint `/api/cron/fechar-ciclo` é protegido por `CRON_SECRET`
  (o Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`).

## Pix

`lib/pix/` traz uma **abstração de provedor**. Provedores incluídos:

- **`dev`** — não cobra ninguém, confirma sozinho (para testar o loop).
- **`mercadopago`** — cobrança Pix real via Mercado Pago. Defina
  `PIX_PROVIDER=mercadopago` e `MERCADOPAGO_ACCESS_TOKEN` (credencial de produção).
  O dinheiro cai na conta MP dona do token; a chave Pix é a configurada nessa conta.
  Configure também o webhook `https://SEU_DOMINIO/api/pix/webhook` no painel do
  Mercado Pago (ou deixe `NEXT_PUBLIC_BASE_URL` setado que o app manda a
  `notification_url` automaticamente).

Para outro PSP (Efí / Asaas), implemente a interface `PixProvider`
(`lib/pix/types.ts`) e registre em `lib/pix/index.ts`. O contrato:

- `criarCobranca()` → gera a cobrança e devolve `{ txid, copiaECola }`;
- `interpretarWebhook()` → lê o POST do PSP e devolve `{ txid, pago }`.

## Anti-fraude (V1)

- Score só é aceito com `transacao_id` **paga** e **ainda não usada**
  (garantido também por `UNIQUE` no banco).
- Teto de pontos plausível por partida (`lib/validation.ts`).
- Nome e WhatsApp sanitizados.

## Deploy (Vercel + Supabase)

1. Crie um projeto no **Supabase** e rode `db/schema.sql` (SQL Editor) — ou
   aponte `DATABASE_URL` e rode `npm run db:setup`.
2. Importe o repo na **Vercel**. Defina as env vars (`DATABASE_URL`, `PIX_PROVIDER`,
   `CRON_SECRET`, `VALOR_FICHA`). O Cron de `vercel.json` é criado automaticamente.
3. Cadastre o(s) motorista(s) na tabela `motoristas` e gere o QR apontando para
   `https://SEU_DOMINIO/?c=<qr_token>`.

## Observações jurídicas

O R$ 2 compra um **cupom garantido** (venda de voucher, não aposta). O prêmio do
ranking é **produto físico de baixo valor** (1 litro de açaí), idealmente bancado
pela açaiteria parceira. **Valide com um advogado antes de escalar** — isto não é
aconselhamento jurídico.
