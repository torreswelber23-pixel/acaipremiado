-- Seed inicial para testar o loop sem provisionar nada externo.
-- Cria um parceiro (açaiteria) e um motorista de teste.
-- O ciclo ativo é criado automaticamente pela aplicação (lib/ciclo.ts) se não existir.

INSERT INTO parceiros (nome, texto_cupom, validade_dias, status, paga_mensalidade)
SELECT 'Açaiteria do Ponto', '10% de desconto em qualquer tamanho de açaí', 7, 'ativo', false
WHERE NOT EXISTS (SELECT 1 FROM parceiros);

INSERT INTO motoristas (nome, whatsapp, qr_token, comissao_pct, ativo)
SELECT 'Motorista Teste', '5596990000000', 'demo', 25.00, true
WHERE NOT EXISTS (SELECT 1 FROM motoristas WHERE qr_token = 'demo');
