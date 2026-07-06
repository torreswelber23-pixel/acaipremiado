"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Itens bons (+pontos) e ruins (-1 vida), tema regional do açaí.
const BONS = [
  { emoji: "🫐", nome: "açaí" },
  { emoji: "🍌", nome: "banana" },
  { emoji: "🥥", nome: "tapioca" },
  { emoji: "🌰", nome: "castanha" },
  { emoji: "🍓", nome: "morango" },
  { emoji: "🥣", nome: "granola" },
];
const RUINS = [
  { emoji: "🪨", nome: "pedra" },
  { emoji: "🍂", nome: "folha seca" },
  { emoji: "🐛", nome: "inseto" },
  { emoji: "🗑️", nome: "estragado" },
];

const VIDAS_INICIAIS = 3;
const PONTOS_POR_ITEM = 10;

interface Item {
  x: number;
  y: number;
  vy: number;
  size: number;
  emoji: string;
  bom: boolean;
  resolvido: boolean;
}

export default function Game({ onFim }: { onFim: (pontos: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [fase, setFase] = useState<"contagem" | "jogando">("contagem");
  const [contagem, setContagem] = useState(3);
  const [pontos, setPontos] = useState(0);
  const [vidas, setVidas] = useState(VIDAS_INICIAIS);
  const [combo, setCombo] = useState(0);

  // Estado do loop (refs para não re-renderizar a cada frame).
  const itensRef = useRef<Item[]>([]);
  const bowlXRef = useRef(0.5); // posição relativa 0..1
  const dirRef = useRef(0); // -1 esquerda, +1 direita
  const pontosRef = useRef(0);
  const vidasRef = useRef(VIDAS_INICIAIS);
  const comboRef = useRef(0);
  const ultimoSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const rodandoRef = useRef(false);
  const dimRef = useRef({ w: 360, h: 640, dpr: 1 });

  // Ajusta o tamanho do canvas ao container (retrato).
  const ajustarTamanho = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    dimRef.current = { w, h, dpr };
  }, []);

  useEffect(() => {
    ajustarTamanho();
    window.addEventListener("resize", ajustarTamanho);
    return () => window.removeEventListener("resize", ajustarTamanho);
  }, [ajustarTamanho]);

  // Contagem regressiva 3..2..1.
  useEffect(() => {
    if (fase !== "contagem") return;
    if (contagem <= 0) {
      setFase("jogando");
      return;
    }
    const t = setTimeout(() => setContagem((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [fase, contagem]);

  const encerrar = useCallback(() => {
    rodandoRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onFim(pontosRef.current);
  }, [onFim]);

  // Loop principal.
  useEffect(() => {
    if (fase !== "jogando") return;
    rodandoRef.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let ultimo = performance.now();
    const inicio = ultimo;
    ultimoSpawnRef.current = ultimo;

    const spawn = (agora: number) => {
      const decorridos = (agora - inicio) / 1000;
      // Dificuldade progressiva: intervalo cai, velocidade sobe com o tempo/pontos.
      const nivel = decorridos / 12 + pontosRef.current / 150;
      const intervalo = Math.max(1100 - nivel * 120, 380);
      if (agora - ultimoSpawnRef.current < intervalo) return;
      ultimoSpawnRef.current = agora;

      const { w } = dimRef.current;
      const bom = Math.random() < 0.7;
      const lista = bom ? BONS : RUINS;
      const escolha = lista[Math.floor(Math.random() * lista.length)];
      const size = Math.max(w * 0.11, 34);
      const velBase = (dimRef.current.h) * (0.28 + nivel * 0.04);
      itensRef.current.push({
        x: size / 2 + Math.random() * (w - size),
        y: -size,
        vy: velBase,
        size,
        emoji: escolha.emoji,
        bom,
        resolvido: false,
      });
    };

    const frame = (agora: number) => {
      if (!rodandoRef.current) return;
      const dt = Math.min((agora - ultimo) / 1000, 0.05);
      ultimo = agora;
      const { w, h, dpr } = dimRef.current;

      // Move a tigela.
      const velTigela = 1.9; // largura/seg
      bowlXRef.current = Math.min(
        1,
        Math.max(0, bowlXRef.current + dirRef.current * velTigela * dt)
      );

      spawn(agora);

      const bowlW = Math.max(w * 0.26, 96);
      const bowlH = bowlW * 0.62;
      const bowlCx = bowlXRef.current * (w - bowlW) + bowlW / 2;
      const bowlTopY = h - bowlH - 90; // acima dos botões
      const linhaPega = bowlTopY + bowlH * 0.35;

      let mudouPontos = false;
      let mudouVidas = false;

      for (const it of itensRef.current) {
        it.y += it.vy * dt;
        if (!it.resolvido && it.y + it.size / 2 >= linhaPega && it.y <= h) {
          const dx = Math.abs(it.x - bowlCx);
          if (dx < bowlW / 2 + it.size * 0.25) {
            it.resolvido = true;
            if (it.bom) {
              comboRef.current += 1;
              const mult = 1 + Math.floor(comboRef.current / 5);
              pontosRef.current += PONTOS_POR_ITEM * mult;
              mudouPontos = true;
            } else {
              vidasRef.current -= 1;
              comboRef.current = 0;
              mudouVidas = true;
            }
          }
        }
      }
      // Remove itens resolvidos ou que sairam da tela.
      itensRef.current = itensRef.current.filter(
        (it) => !it.resolvido && it.y < h + it.size
      );

      if (mudouPontos) {
        setPontos(pontosRef.current);
        setCombo(comboRef.current);
      }
      if (mudouVidas) {
        setVidas(vidasRef.current);
        setCombo(0);
      }

      // ---- Render ----
      ctx.save();
      ctx.scale(dpr, dpr);
      // Fundo degradê açaí.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#3a1052");
      g.addColorStop(1, "#5b1a7a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Itens.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const it of itensRef.current) {
        ctx.font = `${it.size}px serif`;
        ctx.fillText(it.emoji, it.x, it.y);
      }

      // Tigela (desenhada + emoji).
      ctx.font = `${bowlW * 0.9}px serif`;
      ctx.fillText("🥣", bowlCx, bowlTopY + bowlH * 0.35);

      ctx.restore();

      if (vidasRef.current <= 0) {
        encerrar();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      rodandoRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fase, encerrar]);

  // Controles: pressionar botão define a direção enquanto segura.
  const segurar = (d: number) => () => {
    dirRef.current = d;
  };
  const soltar = () => {
    dirRef.current = 0;
  };

  // Suporte a teclado (útil para testar no desktop).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") dirRef.current = -1;
      if (e.key === "ArrowRight") dirRef.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") dirRef.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div ref={wrapRef} className="game-wrap">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* HUD */}
      <div className="hud">
        <div className="hud-vidas">
          {Array.from({ length: VIDAS_INICIAIS }).map((_, i) => (
            <span key={i} style={{ opacity: i < vidas ? 1 : 0.2 }}>
              ❤️
            </span>
          ))}
        </div>
        <div className="hud-pontos">
          {pontos}
          {combo >= 5 && <span className="hud-combo"> x{1 + Math.floor(combo / 5)}</span>}
        </div>
      </div>

      {/* Contagem regressiva */}
      {fase === "contagem" && (
        <div className="contagem">
          <div className="contagem-num">{contagem > 0 ? contagem : "VAI!"}</div>
          <p>Pegue os ingredientes bons, desvie do lixo!</p>
        </div>
      )}

      {/* Botões gigantes */}
      {fase === "jogando" && (
        <div className="controles">
          <button
            aria-label="Esquerda"
            className="ctrl-btn"
            onPointerDown={segurar(-1)}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            onPointerCancel={soltar}
          >
            ◀
          </button>
          <button
            aria-label="Direita"
            className="ctrl-btn"
            onPointerDown={segurar(1)}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            onPointerCancel={soltar}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
