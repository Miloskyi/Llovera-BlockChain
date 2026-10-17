"use client";

import { useEffect, useRef, useState } from "react";

/** Hace aparecer su contenido con un deslizamiento suave cuando entra en pantalla. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref);
  const Comp = Tag as "div"; // div, section y li aceptan las mismas props aquí
  return (
    <Comp ref={ref} className={`reveal ${shown ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Comp>
  );
}

export function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.15) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, shown, threshold]);
  return shown;
}

/** Número que cuenta desde 0 cuando aparece en pantalla. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1400 }: { to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useInView(ref);
  const [value, setValue] = useState(0);
  const current = useRef(0);
  current.current = value;
  useEffect(() => {
    if (!shown) return;
    // Si el número cambia (datos en vivo), anima desde el valor actual y no desde cero.
    const from = current.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setValue(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shown, to, duration]);
  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
