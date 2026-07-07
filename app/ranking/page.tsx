"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pedir } from "@/lib/clientApi";

interface LinhaRanking {
  posicao: number;
  nome_jogador: string;
  pontos: number;
}
interface RankingResp {
  tempo_restante: string;
  tempo_restante_ms: number;
  patrocinador: { nome: string; texto_cupom: string } | null;
  ranking: LinhaRanking[];
}

const MEDALHAS = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
  const [dados, setDados] = useState<RankingResp | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    pedir<RankingResp>("/api/ranking?limite=20").then(({ ok, data, erro }) => {
      if (!ok || !data) {
        setErro(erro || "Não foi possível carregar o ranking.");
        return;
      }
      setDados(data);
    });
  }, []);

  return (
    <main className="tela">
      <div className="cartao cartao-largo">
        <div className="logo">🏆</div>
        <h1>Ranking da Semana</h1>
        {dados && (
          <p className="sub">
            Fecha em <strong>{dados.tempo_restante}</strong>
          </p>
        )}
        {dados?.patrocinador && (
          <p className="patrocinador">
            Prêmio 1 litro de açaí • {dados.patrocinador.nome}
          </p>
        )}

        {erro && <p className="erro">{erro}</p>}

        {dados && dados.ranking.length === 0 && (
          <p className="sub">Ninguém jogou ainda essa semana. Seja o primeiro! 🫐</p>
        )}

        <ol className="ranking-lista">
          {dados?.ranking.map((l) => (
            <li key={l.posicao} className={l.posicao <= 3 ? "top3" : ""}>
              <span className="rk-pos">
                {MEDALHAS[l.posicao - 1] || `${l.posicao}º`}
              </span>
              <span className="rk-nome">{l.nome_jogador}</span>
              <span className="rk-pts">{l.pontos}</span>
            </li>
          ))}
        </ol>

        <Link className="btn btn-grande" href="/">
          Jogar
        </Link>
      </div>
    </main>
  );
}
