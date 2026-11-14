import { useEffect, useRef, useState } from "react";
import gameLogo from "@/assets/brand/supercar-highway-dash-logo.webp.asset.json";
import { uiSounds } from "@/game/ui-sounds";

/** Forza-style attract screen: cinematic cars, small logo, "press to continue". */
export function TitleScreen({ prompt, onContinue, onReady }: { prompt: string; onContinue: () => void; onReady?: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let scene: import("@/game/title-scene").TitleScene | null = null;
    let ro: ResizeObserver | null = null;
    void import("@/game/title-scene").then(({ TitleScene }) => {
      const canvas = canvasRef.current, wrap = wrapRef.current;
      if (disposed || !canvas || !wrap) return;
      scene = new TitleScene(canvas, fadeRef.current, () => {
        wrap.dataset["titleReady"] = "true";
        setReady(true);
        onReadyRef.current?.();
      });
      scene.resize(wrap.clientWidth, wrap.clientHeight);
      if (import.meta.env.DEV) (window as Window & { __title?: unknown }).__title = scene;
      ro = new ResizeObserver(() => scene?.resize(wrap.clientWidth, wrap.clientHeight));
      ro.observe(wrap);
    });
    return () => { disposed = true; ro?.disconnect(); scene?.dispose(); };
  }, []);

  useEffect(() => {
    const go = () => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      uiSounds.unlock();
      uiSounds.confirm();
      setLeaving(true);
      setTimeout(onContinue, 450);
    };
    const key = (e: KeyboardEvent) => { if (e.repeat) return; e.preventDefault(); e.stopPropagation(); go(); };
    window.addEventListener("keydown", key, { capture: true });
    const el = wrapRef.current;
    el?.addEventListener("pointerup", go);
    return () => { window.removeEventListener("keydown", key, { capture: true }); el?.removeEventListener("pointerup", go); };
  }, [onContinue]);

  return (
    <div
      ref={wrapRef}
      role="button"
      tabIndex={0}
      aria-label={prompt}
      className={`title-screen absolute inset-0 z-[80] cursor-pointer overflow-hidden bg-background transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div ref={fadeRef} className="pointer-events-none absolute inset-0 bg-background opacity-100" />
      <div className="title-vignette pointer-events-none absolute inset-0" />
      <div className="title-letterbox pointer-events-none absolute inset-x-0 top-0 h-[7%]" />
      <div className="title-letterbox pointer-events-none absolute inset-x-0 bottom-0 h-[7%]" />

      <img
        src={gameLogo.url}
        alt="Supercar Highway Dash"
        width={680}
        height={540}
        className="title-logo pointer-events-none absolute left-[max(env(safe-area-inset-left),20px)] top-[max(env(safe-area-inset-top),16px)] h-16 w-auto sm:h-20"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-[11%] flex flex-col items-center gap-2">
        {ready ? (
          <p className="title-prompt animate-title-blink font-display text-2xl tracking-[0.35em] sm:text-3xl">
            {prompt}
          </p>
        ) : (
          <p className="title-prompt animate-pulse-soft font-display text-lg tracking-[0.4em]">…</p>
        )}
        <span className="title-rule h-px w-48" />
      </div>
    </div>
  );
}
