"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Itens bons (+pontos) e ruins (-1 vida), tema regional do açaí.
const BONS = [
  { emoji: "🫐", nome: "açaí" },
  { emoji: "🍌", nome: "banana" },
  { emoji: "🥥", nome: "tapioca" },
  { emoji: "🌰", nome: "castanha" },
  { emoji: "🍓", nome: "morango" },
  { emoji: "🥜", nome: "castanha" },
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
  rot: number;
  vrot: number;
  age: number;
}

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  maxVida: number;
  cor: string;
  r: number;
}

interface Flutuante {
  x: number;
  y: number;
  vida: number;
  texto: string;
  cor: string;
}

interface Bolha {
  x: number;
  y: number;
  r: number;
  vel: number;
  alpha: number;
}

const PALETA_PARTICULA = ["#ffd23f", "#ff5da2", "#ffffff", "#c084fc", "#a855f7"];

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
  const particulasRef = useRef<Particula[]>([]);
  const flutuantesRef = useRef<Flutuante[]>([]);
  const bolhasRef = useRef<Bolha[]>([]);
  const bowlXRef = useRef(0.5); // posição relativa 0..1
  const dirRef = useRef(0); // -1 esquerda, +1 direita
  const pontosRef = useRef(0);
  const vidasRef = useRef(VIDAS_INICIAIS);
  const comboRef = useRef(0);
  const ultimoSpawnRef = useRef(0);
  const shakeRef = useRef(0);
  const hurtRef = useRef(0);
  const flashBowlRef = useRef(0);
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

    // Bolhas decorativas de fundo.
    const initBolhas = () => {
      const { w, h } = dimRef.current;
      bolhasRef.current = Array.from({ length: 16 }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 4 + Math.random() * 22,
        vel: 8 + Math.random() * 26,
        alpha: 0.04 + Math.random() * 0.08,
      }));
    };
    initBolhas();

    const explodir = (x: number, y: number, cor: string, qtd = 12) => {
      for (let i = 0; i < qtd; i++) {
        const ang = Math.random() * Math.PI * 2;
        const vel = 60 + Math.random() * 180;
        particulasRef.current.push({
          x,
          y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel - 60,
          vida: 0.5 + Math.random() * 0.4,
          maxVida: 0.9,
          cor,
          r: 3 + Math.random() * 4,
        });
      }
    };

    const spawn = (agora: number) => {
      const decorridos = (agora - inicio) / 1000;
      const nivel = decorridos / 12 + pontosRef.current / 150;
      const intervalo = Math.max(1100 - nivel * 120, 380);
      if (agora - ultimoSpawnRef.current < intervalo) return;
      ultimoSpawnRef.current = agora;

      const { w, h } = dimRef.current;
      const bom = Math.random() < 0.7;
      const lista = bom ? BONS : RUINS;
      const escolha = lista[Math.floor(Math.random() * lista.length)];
      const size = Math.max(w * 0.12, 38);
      const velBase = h * (0.26 + nivel * 0.04);
      itensRef.current.push({
        x: size / 2 + Math.random() * (w - size),
        y: -size,
        vy: velBase,
        size,
        emoji: escolha.emoji,
        bom,
        resolvido: false,
        rot: (Math.random() - 0.5) * 0.4,
        vrot: (Math.random() - 0.5) * 1.2,
        age: 0,
      });
    };

    // Desenha a tigela de açaí (roxa, com toppings).
    const desenharTigela = (
      cx: number,
      surfaceY: number,
      w: number,
      h: number,
      flash: number
    ) => {
      const rx = w / 2;
      const ry = w * 0.15;
      const bottomY = surfaceY + h;

      // Sombra no chão.
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.beginPath();
      ctx.ellipse(cx, bottomY + 8, rx * 0.9, ry * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Corpo da tigela.
      const grad = ctx.createLinearGradient(0, surfaceY, 0, bottomY);
      grad.addColorStop(0, flash > 0 ? "#b56ccf" : "#7a2f96");
      grad.addColorStop(1, "#37104d");
      ctx.beginPath();
      ctx.moveTo(cx - rx, surfaceY);
      ctx.bezierCurveTo(cx - rx, surfaceY + h * 0.85, cx - rx * 0.55, bottomY, cx, bottomY);
      ctx.bezierCurveTo(cx + rx * 0.55, bottomY, cx + rx, surfaceY + h * 0.85, cx + rx, surfaceY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Brilho lateral.
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.45, surfaceY + h * 0.45, rx * 0.16, h * 0.32, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Superfície do açaí.
      ctx.beginPath();
      ctx.ellipse(cx, surfaceY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2a0a3d";
      ctx.fill();
      ctx.lineWidth = Math.max(3, w * 0.028);
      ctx.strokeStyle = flash > 0 ? "#ffd23f" : "#9b4db8";
      ctx.stroke();

      // Toppings.
      const toppings: [string, number, number, number][] = [
        ["#ffd23f", -0.4, -0.15, 0.14], // banana
        ["#ff5da2", 0.3, 0.25, 0.12], // morango
        ["#f5deb3", 0.05, -0.4, 0.1], // granola
        ["#8b5a2b", -0.15, 0.4, 0.09], // castanha
        ["#ffffff", 0.5, -0.2, 0.08], // leite condensado
      ];
      for (const [c, ox, oy, sr] of toppings) {
        ctx.beginPath();
        ctx.fillStyle = c;
        ctx.ellipse(cx + rx * ox, surfaceY + ry * oy, w * sr * 0.5, w * sr * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (agora: number) => {
      if (!rodandoRef.current) return;
      const dt = Math.min((agora - ultimo) / 1000, 0.05);
      ultimo = agora;
      const { w, h, dpr } = dimRef.current;

      // Move a tigela.
      const velTigela = 1.9;
      bowlXRef.current = Math.min(
        1,
        Math.max(0, bowlXRef.current + dirRef.current * velTigela * dt)
      );

      spawn(agora);

      const bowlW = Math.max(w * 0.32, 120);
      const bowlH = bowlW * 0.7;
      const bowlCx = bowlXRef.current * (w - bowlW) + bowlW / 2;
      const bottomY = h - 118;
      const surfaceY = bottomY - bowlH;

      let mudouPontos = false;
      let mudouVidas = false;

      for (const it of itensRef.current) {
        it.y += it.vy * dt;
        it.rot += it.vrot * dt;
        it.age += dt;
        if (!it.resolvido && it.y + it.size * 0.25 >= surfaceY && it.y <= surfaceY + bowlH * 0.5) {
          const dx = Math.abs(it.x - bowlCx);
          if (dx < bowlW / 2 + it.size * 0.2) {
            it.resolvido = true;
            if (it.bom) {
              comboRef.current += 1;
              const mult = 1 + Math.floor(comboRef.current / 5);
              const ganho = PONTOS_POR_ITEM * mult;
              pontosRef.current += ganho;
              mudouPontos = true;
              explodir(it.x, surfaceY, PALETA_PARTICULA[Math.floor(Math.random() * PALETA_PARTICULA.length)]);
              flutuantesRef.current.push({
                x: it.x,
                y: surfaceY - 10,
                vida: 1,
                texto: `+${ganho}`,
                cor: mult > 1 ? "#ff5da2" : "#ffd23f",
              });
              flashBowlRef.current = 0.25;
            } else {
              vidasRef.current -= 1;
              comboRef.current = 0;
              mudouVidas = true;
              shakeRef.current = 14;
              hurtRef.current = 1;
              explodir(it.x, surfaceY, "#ff4d4d", 8);
            }
          }
        }
      }
      itensRef.current = itensRef.current.filter(
        (it) => !it.resolvido && it.y < h + it.size
      );

      // Atualiza partículas.
      for (const p of particulasRef.current) {
        p.vy += 320 * dt; // gravidade
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vida -= dt;
      }
      particulasRef.current = particulasRef.current.filter((p) => p.vida > 0);

      // Atualiza flutuantes ("+10").
      for (const f of flutuantesRef.current) {
        f.y -= 60 * dt;
        f.vida -= dt * 1.1;
      }
      flutuantesRef.current = flutuantesRef.current.filter((f) => f.vida > 0);

      // Bolhas de fundo sobem e reaparecem.
      for (const b of bolhasRef.current) {
        b.y -= b.vel * dt;
        if (b.y + b.r < 0) {
          b.y = h + b.r;
          b.x = Math.random() * w;
        }
      }

      // Decai shake / flashes.
      shakeRef.current *= 0.86;
      hurtRef.current = Math.max(0, hurtRef.current - dt * 2);
      flashBowlRef.current = Math.max(0, flashBowlRef.current - dt);

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

      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);

      // Fundo degradê açaí.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#4a1568");
      g.addColorStop(0.55, "#3a1052");
      g.addColorStop(1, "#26093a");
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);

      // Brilhos radiais nos cantos.
      const glow = (gx: number, gy: number, cor: string, raio: number) => {
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, raio);
        rg.addColorStop(0, cor);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      };
      glow(w * 0.15, h * 0.12, "rgba(255,93,162,0.22)", w * 0.7);
      glow(w * 0.9, h * 0.05, "rgba(168,85,247,0.22)", w * 0.7);

      // Bolhas.
      for (const b of bolhasRef.current) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${b.alpha})`;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Itens (com brilho e rotação).
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const it of itensRef.current) {
        const pop = Math.min(1, it.age / 0.14);
        const s = it.size * (0.6 + 0.4 * pop);
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.shadowColor = it.bom ? "rgba(255,215,90,0.6)" : "rgba(255,70,70,0.65)";
        ctx.shadowBlur = s * 0.4;
        ctx.font = `${s}px serif`;
        ctx.fillText(it.emoji, 0, 0);
        ctx.restore();
      }

      // Tigela.
      desenharTigela(bowlCx, surfaceY, bowlW, bowlH, flashBowlRef.current);

      // Partículas.
      for (const p of particulasRef.current) {
        ctx.globalAlpha = Math.max(0, p.vida / p.maxVida);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Flutuantes ("+10").
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const f of flutuantesRef.current) {
        ctx.globalAlpha = Math.max(0, f.vida);
        ctx.font = "800 26px system-ui, sans-serif";
        ctx.fillStyle = f.cor;
        ctx.fillText(f.texto, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      // Vinheta vermelha ao errar.
      if (hurtRef.current > 0) {
        const rg = ctx.createRadialGradient(
          w / 2,
          h / 2,
          h * 0.3,
          w / 2,
          h / 2,
          h * 0.75
        );
        rg.addColorStop(0, "rgba(255,0,0,0)");
        rg.addColorStop(1, `rgba(255,0,0,${0.45 * hurtRef.current})`);
        ctx.fillStyle = rg;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      }

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
        <div className="hud-pill hud-vidas">
          {Array.from({ length: VIDAS_INICIAIS }).map((_, i) => (
            <span key={i} style={{ opacity: i < vidas ? 1 : 0.2 }}>
              {i < vidas ? "❤️" : "🤍"}
            </span>
          ))}
        </div>
        <div className="hud-pill hud-pontos">
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
