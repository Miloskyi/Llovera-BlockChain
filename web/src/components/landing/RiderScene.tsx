"use client";

import { useCurrency } from "@/lib/currency";

const DROPS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 53) % 480,
  y: (i * 37) % 120,
  d: ((i * 17) % 10) / 10,
  len: 12 + ((i * 7) % 10),
}));

const WINDOWS = Array.from({ length: 26 }, (_, i) => ({
  x: 20 + ((i * 71) % 430),
  y: 168 + ((i * 29) % 70),
  d: ((i * 13) % 30) / 10,
}));

/**
 * Escena en bucle (9 s): un repartidor en moto, llega la nube, cae el aguacero, el medidor pasa
 * de 15 mm/h y al celular le llega el pago. Solo SVG + CSS (ver .sc-* en globals.css).
 */
export function RiderScene() {
  const { format } = useCurrency();
  const payout = format(3_500_000n);

  return (
    <div className="panel relative overflow-hidden p-0">
      <svg viewBox="0 0 480 380" className="block h-auto w-full" role="img" aria-label="Un repartidor en moto recibe un pago cuando empieza a llover fuerte">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1a33" />
            <stop offset="1" stopColor="#0a1324" />
          </linearGradient>
          <linearGradient id="skyStorm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1430" />
            <stop offset="1" stopColor="#0b1020" />
          </linearGradient>
          <linearGradient id="meter" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--r1)" />
            <stop offset=".45" stopColor="var(--r3)" />
            <stop offset=".75" stopColor="var(--r4)" />
            <stop offset="1" stopColor="var(--r5)" />
          </linearGradient>
          <clipPath id="meterClip">
            <rect x="436" y="44" width="16" height="150" rx="8" />
          </clipPath>
        </defs>

        {/* Cielo que se oscurece */}
        <rect width="480" height="380" fill="url(#sky)" />
        <rect width="480" height="380" fill="url(#skyStorm)" className="sc-storm-sky" />
        <rect width="480" height="380" fill="#fff" className="sc-flash" />

        {/* Luna / sol tenue */}
        <circle cx="330" cy="54" r="24" fill="var(--accent)" opacity=".18" className="sc-sun" />

        {/* Montañas del valle */}
        <path d="M0 210 L60 150 L120 185 L190 120 L260 175 L330 128 L400 170 L480 140 L480 260 L0 260Z" fill="#101c33" />
        <path d="M0 235 L80 190 L150 215 L230 175 L300 210 L380 185 L480 205 L480 270 L0 270Z" fill="#13213b" />

        {/* Ciudad con ventanas que titilan */}
        <g fill="#0c1628">
          <rect x="10" y="190" width="40" height="80" />
          <rect x="55" y="165" width="34" height="105" />
          <rect x="95" y="200" width="46" height="70" />
          <rect x="150" y="175" width="30" height="95" />
          <rect x="190" y="205" width="52" height="65" />
          <rect x="250" y="160" width="36" height="110" />
          <rect x="295" y="195" width="44" height="75" />
          <rect x="345" y="180" width="30" height="90" />
          <rect x="385" y="205" width="60" height="65" />
        </g>
        {WINDOWS.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="4" height="5" fill="var(--accent)" className="sc-window" style={{ animationDelay: `${w.d}s` }} />
        ))}

        {/* Calle */}
        <rect x="0" y="270" width="480" height="110" fill="#0a111f" />
        <line x1="0" y1="330" x2="480" y2="330" stroke="#2a3a5c" strokeWidth="4" strokeDasharray="26 22" className="sc-road" />
        <rect x="0" y="270" width="480" height="4" fill="#1b2741" />
        {/* Reflejos de agua en la calle durante la lluvia */}
        <g className="sc-puddles">
          <ellipse cx="90" cy="300" rx="40" ry="4" fill="var(--cyan)" opacity=".18" />
          <ellipse cx="350" cy="350" rx="55" ry="5" fill="var(--cyan)" opacity=".15" />
        </g>

        {/* Nube */}
        <g className="sc-cloud">
          <path d="M150 92a26 26 0 0 1 9-50 34 34 0 0 1 63-6 24 24 0 0 1 36 21 22 22 0 0 1-4 35z" fill="#aab6cc" className="sc-cloud-light" />
          <path d="M150 92a26 26 0 0 1 9-50 34 34 0 0 1 63-6 24 24 0 0 1 36 21 22 22 0 0 1-4 35z" fill="#3a4a6a" className="sc-cloud-dark" />
          <path d="M205 92l-10 22h12l-8 22 22-30h-13l9-14z" fill="var(--accent)" className="sc-bolt" />
        </g>

        {/* Lluvia */}
        <g className="sc-rain">
          {DROPS.map((d, i) => (
            <line
              key={i}
              x1={d.x}
              y1={d.y}
              x2={d.x - 5}
              y2={d.y + d.len}
              stroke="#9fdcff"
              strokeOpacity=".7"
              strokeWidth="2"
              strokeLinecap="round"
              className="sc-drop"
              style={{ animationDelay: `${d.d}s` }}
            />
          ))}
        </g>

        {/* Repartidor en moto */}
        <g transform="translate(118 196)">
          <g className="sc-bob">
            {/* Caja de domicilios con el logo de Lloverá */}
            <rect x="8" y="10" width="54" height="46" rx="6" fill="var(--accent)" />
            <rect x="8" y="10" width="54" height="10" rx="5" fill="#e6bd2a" />
            <path d="M35 26c5 6.5 7.5 10 7.5 13.5a7.5 7.5 0 0 1-15 0c0-3.5 2.5-7 7.5-13.5z" fill="var(--accent-ink)" />
            {/* Monedas que caen en la caja */}
            <circle cx="35" cy="-40" r="7" fill="var(--accent)" stroke="#b8901a" strokeWidth="2" className="sc-coin" />
            <circle cx="22" cy="-40" r="6" fill="var(--accent)" stroke="#b8901a" strokeWidth="2" className="sc-coin sc-coin-2" />

            {/* Moto */}
            <path d="M40 70 L120 70 L150 52 L172 54 L160 76 L60 84 Z" fill="#e8eef9" />
            <path d="M58 70 L96 70 L104 58 L70 56 Z" fill="#c9d3e6" />
            <rect x="146" y="40" width="6" height="18" rx="2" fill="#8b97b0" transform="rotate(-20 149 49)" />
            <circle cx="172" cy="56" r="5" fill="var(--accent)" className="sc-headlight" />
            {/* Conductor con impermeable */}
            <path d="M80 20 C80 8 98 4 106 14 L120 54 L84 58 Z" fill="var(--cyan)" />
            <path d="M104 26 L138 46 L134 52 L100 36 Z" fill="#2fb6d6" />
            <circle cx="96" cy="2" r="14" fill="#f5f8ff" />
            <path d="M84 -2 A14 14 0 0 1 110 -2 L110 4 L84 4Z" fill="#26365a" />
            <rect x="98" y="-4" width="14" height="6" rx="3" fill="#46e0ff" opacity=".7" />
            <path d="M92 58 L110 58 L118 80 L104 82 Z" fill="#26365a" />
          </g>
          {/* Ruedas */}
          <g transform="translate(60 92)">
            <circle r="22" fill="#0b1222" stroke="#e8eef9" strokeWidth="5" />
            <g className="sc-wheel">
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#56627c" strokeWidth="3" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#56627c" strokeWidth="3" />
            </g>
          </g>
          <g transform="translate(158 92)">
            <circle r="22" fill="#0b1222" stroke="#e8eef9" strokeWidth="5" />
            <g className="sc-wheel">
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#56627c" strokeWidth="3" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#56627c" strokeWidth="3" />
            </g>
          </g>
          {/* Salpicaduras */}
          <g className="sc-splash">
            <path d="M30 112 q-10 -14 -22 -8" stroke="#9fdcff" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M188 112 q10 -14 22 -8" stroke="#9fdcff" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* Medidor de lluvia */}
        <g>
          <rect x="436" y="44" width="16" height="150" rx="8" fill="#0b1222" stroke="#26365a" />
          <g clipPath="url(#meterClip)">
            <rect x="436" y="44" width="16" height="150" fill="url(#meter)" className="sc-meter" />
          </g>
          <line x1="428" y1="80" x2="460" y2="80" stroke="#fff" strokeWidth="2" strokeDasharray="4 3" />
          <text x="424" y="84" textAnchor="end" fontSize="11" fill="#c9d3e6" className="font-data">
            15 mm/h
          </text>
          <text x="444" y="212" textAnchor="middle" fontSize="10" fill="#8b97b0" className="font-data">
            LLUVIA
          </text>
        </g>

        {/* Notificación de pago */}
        <g className="sc-notif">
          <rect x="250" y="112" width="190" height="66" rx="16" fill="#111b30" stroke="var(--accent)" strokeWidth="2" />
          <circle cx="280" cy="145" r="16" fill="var(--ok)" />
          <path d="M272 145l6 6 11-12" stroke="#04130e" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="304" y="137" fontSize="12" fill="#c9d3e6">
            Lloverá te pagó
          </text>
          <text x="304" y="161" fontSize="22" fontWeight="800" fill="var(--accent)" className="font-display">
            +{payout}
          </text>
        </g>
      </svg>
    </div>
  );
}
