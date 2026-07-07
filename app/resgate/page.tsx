"use client";

import { useState } from "react";
import { pedir } from "@/lib/clientApi";

interface RespOk {
  ok: true;
  codigo: string;
  texto_cupom: string;
  parceiro: string;
  resgatado_em: string;
}

export default function ResgatePage() {
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState<RespOk | null>(null);
  const [erro, setErro] = useState("");

  const resgatar = async () => {
    setCarregando(true);
    setErro("");
    setResposta(null);
    const { ok, data, erro } = await pedir<RespOk>("/api/cupom/resgatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    setCarregando(false);
    if (!ok || !data) {
      setErro(erro || "Erro ao resgatar");
      return;
    }
    setResposta(data);
    setCodigo("");
  };

  return (
    <main className="tela">
      <div className="cartao">
        <div className="logo">🎟️</div>
        <h1>Resgate de Cupom</h1>
        <p className="sub">Painel do parceiro. Digite o código do cliente.</p>
        <input
          className="campo campo-codigo"
          placeholder="ACAI0001"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && resgatar()}
        />
        <button
          className="btn btn-grande"
          onClick={resgatar}
          disabled={carregando || codigo.trim().length < 3}
        >
          {carregando ? "..." : "Validar e resgatar"}
        </button>

        {resposta && (
          <div className="resgate-ok">
            <div className="logo">✅</div>
            <p>
              <strong>{resposta.codigo}</strong> resgatado!
            </p>
            <p className="sub">{resposta.texto_cupom}</p>
            <p className="sub">{resposta.parceiro}</p>
          </div>
        )}
        {erro && <p className="erro">{erro}</p>}
      </div>
    </main>
  );
}
