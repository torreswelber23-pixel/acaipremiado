"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Game from "@/components/Game";
import { pedir } from "@/lib/clientApi";

type Fase = "inicio" | "pagando" | "jogar" | "fim" | "resultado" | "erro";

interface Partida {
  transacao_id: number;
  valor: number;
  copia_e_cola: string;
  modo_dev: boolean;
}

interface Resultado {
  pontos: number;
  posicao: number;
  cupom: { codigo: string; expira_em: string } | null;
}

export default function Home() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [qrToken, setQrToken] = useState("demo");
  const [partida, setPartida] = useState<Partida | null>(null);
  const [pontos, setPontos] = useState(0);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lê o QR do motorista da URL (?c=token). Sem token, usa "demo".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c") || params.get("qr") || "demo";
    setQrToken(c);
  }, []);

  const limparPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => limparPoll(), []);

  const criarPartida = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const { ok, data, erro } = await pedir<Partida>("/api/partida/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_token: qrToken }),
    });
    setCarregando(false);
    if (!ok || !data) {
      setErro(erro || "Erro ao criar partida");
      setFase("erro");
      return;
    }
    setPartida(data);
    setFase("pagando");
  }, [qrToken]);

  // Polling do pagamento.
  useEffect(() => {
    if (fase !== "pagando" || !partida) return;
    limparPoll();
    pollRef.current = setInterval(async () => {
      const { data } = await pedir<{ liberado?: boolean }>(
        `/api/partida/status/${partida.transacao_id}`
      );
      if (data?.liberado) {
        limparPoll();
        setFase("jogar");
      }
    }, 1500);
    return () => limparPoll();
  }, [fase, partida]);

  const aoFimDoJogo = useCallback((p: number) => {
    setPontos(p);
    setFase("fim");
  }, []);

  const enviarScore = useCallback(async () => {
    if (!partida) return;
    setCarregando(true);
    setErro("");
    const { ok, data, erro } = await pedir<Resultado>("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transacao_id: partida.transacao_id,
        nome,
        whatsapp,
        pontos,
      }),
    });
    setCarregando(false);
    if (!ok || !data) {
      setErro(erro || "Erro ao enviar pontuação");
      return;
    }
    setResultado(data);
    setFase("resultado");
  }, [partida, nome, whatsapp, pontos]);

  const jogarDeNovo = () => {
    setPartida(null);
    setResultado(null);
    setPontos(0);
    setNome("");
    setWhatsapp("");
    setFase("inicio");
  };

  // ---------- Render ----------
  if (fase === "jogar") {
    return <Game onFim={aoFimDoJogo} />;
  }

  return (
    <main className="tela">
      {fase === "inicio" && (
        <div className="cartao">
          <div className="logo">🍧</div>
          <h1>CarPet Açaí</h1>
          <p className="sub">O joguinho de açaí de Macapá</p>
          <ul className="lista-beneficios">
            <li>🎟️ Cupom de desconto garantido</li>
            <li>🏆 Entra no ranking da semana</li>
            <li>🥤 1º lugar leva 1 litro de açaí</li>
          </ul>
          <button className="btn btn-grande" onClick={criarPartida} disabled={carregando}>
            {carregando ? "..." : "Jogar por R$ 2"}
          </button>
          <Link className="link-secundario" href="/ranking">
            Ver ranking da semana →
          </Link>
        </div>
      )}

      {fase === "pagando" && partida && (
        <div className="cartao">
          <h2>Pague R$ {partida.valor.toFixed(2)} no Pix</h2>
          <p className="sub">Copie o código abaixo no app do seu banco</p>
          <div className="pix-box">
            <code>{partida.copia_e_cola}</code>
          </div>
          <button
            className="btn"
            onClick={() => navigator.clipboard?.writeText(partida.copia_e_cola)}
          >
            Copiar código Pix
          </button>
          <div className="aguardando">
            <span className="spinner" /> Aguardando pagamento…
          </div>
          {partida.modo_dev && (
            <p className="aviso-dev">
              Modo teste: o pagamento é confirmado automaticamente.
            </p>
          )}
        </div>
      )}

      {fase === "fim" && (
        <div className="cartao">
          <div className="logo">🏁</div>
          <h2>Fim de jogo!</h2>
          <p className="pontos-final">{pontos} pontos</p>
          <p className="sub">Cadastre-se pra entrar no ranking e receber o cupom</p>
          <input
            className="campo"
            placeholder="Seu nome"
            maxLength={25}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className="campo"
            placeholder="WhatsApp (pra avisar se ganhar)"
            inputMode="numeric"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          {erro && <p className="erro">{erro}</p>}
          <button
            className="btn btn-grande"
            onClick={enviarScore}
            disabled={carregando || nome.trim().length < 1}
          >
            {carregando ? "Enviando..." : "Entrar no ranking"}
          </button>
        </div>
      )}

      {fase === "resultado" && resultado && (
        <div className="cartao">
          <div className="logo">🎉</div>
          <h2>Você fez {resultado.pontos} pontos!</h2>
          <p className="posicao">
            Sua posição no ranking: <strong>{resultado.posicao}º</strong>
          </p>
          {resultado.cupom && (
            <div className="cupom-card">
              <p>Seu cupom de desconto:</p>
              <div className="cupom-codigo">{resultado.cupom.codigo}</div>
              <p className="cupom-obs">Mostre no parceiro para resgatar</p>
            </div>
          )}
          <button className="btn btn-grande" onClick={jogarDeNovo}>
            Jogar de novo
          </button>
          <Link className="link-secundario" href="/ranking">
            Ver ranking completo →
          </Link>
        </div>
      )}

      {fase === "erro" && (
        <div className="cartao">
          <div className="logo">😕</div>
          <h2>Ops</h2>
          <p className="erro">{erro}</p>
          <button className="btn" onClick={() => setFase("inicio")}>
            Tentar de novo
          </button>
        </div>
      )}
    </main>
  );
}
