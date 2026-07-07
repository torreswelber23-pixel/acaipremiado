"use client";

import { useState } from "react";
import { pedir } from "@/lib/clientApi";

interface Relatorio {
  motorista: string;
  comissao_pct: number;
  fichas_pagas: number;
  total_bruto: number;
  comissao_devida: number;
}

export default function MotoristaPage() {
  const [token, setToken] = useState("");
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const buscar = async () => {
    setCarregando(true);
    setErro("");
    setRel(null);
    const { ok, data, erro } = await pedir<Relatorio>(
      `/api/motorista/${encodeURIComponent(token.trim())}/relatorio`
    );
    setCarregando(false);
    if (!ok || !data) {
      setErro(erro || "Erro");
      return;
    }
    setRel(data);
  };

  return (
    <main className="tela">
      <div className="cartao">
        <div className="logo">🚗</div>
        <h1>Comissão do Motorista</h1>
        <p className="sub">Digite seu código (QR token).</p>
        <input
          className="campo"
          placeholder="demo"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
        />
        <button
          className="btn btn-grande"
          onClick={buscar}
          disabled={carregando || token.trim().length < 1}
        >
          {carregando ? "..." : "Ver comissão"}
        </button>

        {rel && (
          <div className="relatorio">
            <h2>{rel.motorista}</h2>
            <div className="rel-linha">
              <span>Fichas pagas</span>
              <strong>{rel.fichas_pagas}</strong>
            </div>
            <div className="rel-linha">
              <span>Total arrecadado</span>
              <strong>R$ {rel.total_bruto.toFixed(2)}</strong>
            </div>
            <div className="rel-linha">
              <span>Sua comissão ({rel.comissao_pct}%)</span>
              <strong className="destaque">R$ {rel.comissao_devida.toFixed(2)}</strong>
            </div>
          </div>
        )}
        {erro && <p className="erro">{erro}</p>}
      </div>
    </main>
  );
}
