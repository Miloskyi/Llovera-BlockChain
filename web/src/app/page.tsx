import Link from "next/link";
import { LiveTerms } from "@/components/LiveTerms";
import { SetupWallet } from "@/components/SetupWallet";
import { LiveHeroMap, LiveStats, LiveTicker } from "@/components/LiveRadar";
import { Money } from "@/components/Money";
import { RiderScene } from "@/components/landing/RiderScene";
import { RainSimulator } from "@/components/landing/RainSimulator";
import { DayTimeline } from "@/components/landing/DayTimeline";
import { CountUp, Reveal } from "@/components/landing/Reveal";

const BADGES = [
  { icon: "⚡", text: "Pago en menos de 1 s" },
  { icon: "📍", text: "25 zonas del valle" },
  { icon: "🧾", text: "Cero papeleo" },
];

const FAQ = [
  {
    q: "¿Para qué piden mi ubicación?",
    a: "Solo para saber en qué zona estás al empezar el turno y ofrecerte la cobertura de esa zona. La ubicación no se guarda ni se publica en la blockchain.",
  },
  {
    q: "¿Tengo que demostrar que estaba trabajando?",
    a: "No. Lloverá es paramétrico: si la lluvia en tu zona supera el umbral con la cobertura activa, el contrato paga solo. Nadie revisa nada a mano.",
  },
  {
    q: "¿Y si compro cuando ya veo nubes negras?",
    a: "No se puede: la cobertura tiene un tiempo de espera, la venta se cierra si ya está lloviendo y el precio sube cuando el riesgo de tormenta es alto.",
  },
  {
    q: "¿De dónde sale la plata de los pagos?",
    a: "De un fondo de liquidez. Quien deposita gana las primas de los días secos y asume los pagos de los días de tormenta. Cada zona tiene un cupo diario para que un aguacero en todo el valle no quiebre el fondo.",
  },
  {
    q: "¿Qué es tUSDC?",
    a: "Un dólar digital de prueba en Monad Testnet. No tiene valor real; sirve para probar el producto completo. En la app ves todo en tu moneda (pesos, soles, euros…) con la tasa del día.",
  },
  {
    q: "¿Esto es un seguro?",
    a: "Es un prototipo de fondo mutual de protección de ingresos. Operarlo con dinero real en Colombia requeriría cumplir la regulación de la Superintendencia Financiera.",
  },
];

function Heading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mb-8 max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-lg text-muted">{sub}</p>}
    </Reveal>
  );
}

export default function Home() {
  return (
    <div className="space-y-24 sm:space-y-28">
      {/* Portada */}
      <section className="grid items-center gap-10 pt-2 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)]">
        <div className="rise">
          <p className="chip border-accent/40 text-accent">
            <span className="live-dot" /> Micro-seguro de lluvia · Valle de Aburrá
          </p>
          <h1 className="font-display mt-5 text-[clamp(2.7rem,7.5vw,5.4rem)] font-extrabold leading-[0.95]">
            Si cae el aguacero,{" "}
            <span className="relative inline-block text-accent">
              cobras.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
                <path d="M2 8c40-6 80-6 120-2s60 2 76-2" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" className="check-draw" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
            Para repartidores y conductores que se mojan para ganarse el día. Pagas{" "}
            <Money value={250_000n} extraDecimals className="font-semibold text-ink" /> por tu zona y, si llueve duro, te llegan{" "}
            <Money value={3_500_000n} className="font-semibold text-accent" /> en segundos.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/asegurar" className="btn btn-accent btn-xl">
              Empezar mi turno →
            </Link>
            <a href="#pruebalo" className="btn btn-ghost btn-xl">
              Ver cómo funciona
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
            {BADGES.map((b, i) => (
              <li key={b.text} className="rise flex items-center gap-2 text-sm font-semibold text-muted" style={{ animationDelay: `${400 + i * 120}ms` }}>
                <span className="text-lg" aria-hidden>
                  {b.icon}
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rise float" style={{ animationDelay: "150ms" }}>
          <RiderScene />
        </div>
      </section>

      <div className="-mx-4 sm:-mx-6">
        <LiveTicker />
      </div>

      {/* Simulador */}
      <section id="pruebalo" className="scroll-mt-24">
        <Heading eyebrow="Así de simple" title="Mientras más llueve, más cerca estás de cobrar." sub="El pago no depende de nadie: lo decide la lluvia medida en tu zona." />
        <Reveal>
          <RainSimulator />
        </Reveal>
      </section>

      {/* Un día */}
      <section>
        <Heading eyebrow="Un día con Lloverá" title="De la primera carrera al primer aguacero." />
        <DayTimeline />
      </section>

      {/* Radar en vivo */}
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <Heading eyebrow="En vivo" title="El radar ahora mismo." sub="Lluvia real de las 25 zonas del valle, publicada en Monad por el oráculo de Lloverá." />
          <Reveal delay={100}>
            <LiveStats />
          </Reveal>
          <Reveal delay={200} className="mt-6">
            <Link href="/asegurar" className="btn btn-accent btn-xl w-full sm:w-auto">
              Ver mi zona →
            </Link>
          </Reveal>
        </div>
        <Reveal delay={150}>
          <LiveHeroMap />
        </Reveal>
      </section>

      {/* Tarifa y wallet */}
      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <Heading eyebrow="Tarifa" title="Lo que pagas y lo que recibes" />
          <Reveal>
            <LiveTerms />
          </Reveal>
        </div>
        <div>
          <Heading eyebrow="Antes de empezar" title="Prepara tu wallet en 4 pasos" />
          <Reveal delay={120}>
            <SetupWallet />
          </Reveal>
        </div>
      </section>

      {/* Por qué Monad */}
      <Reveal as="section" className="panel relative overflow-hidden p-8 md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(70,224,255,.12)" }} aria-hidden />
        <div className="relative grid gap-8 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Por qué Monad</p>
            <h2 className="font-display mt-2 text-3xl font-extrabold">Un seguro de centavos solo funciona en una cadena así.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="border-l-2 border-cyan/40 pl-4">
              <p className="font-display text-4xl font-extrabold text-cyan">
                <CountUp to={0.4} decimals={1} suffix=" s" />
              </p>
              <p className="mt-2 text-muted">por bloque: el pago llega mientras sigue lloviendo</p>
            </div>
            <div className="border-l-2 border-cyan/40 pl-4">
              <p className="font-display text-4xl font-extrabold text-cyan">
                <CountUp to={10000} />
              </p>
              <p className="mt-2 text-muted">transacciones por segundo para pagarle a todo el valle a la vez</p>
            </div>
            <div className="border-l-2 border-cyan/40 pl-4">
              <p className="font-display text-4xl font-extrabold text-cyan">&lt; 1¢</p>
              <p className="mt-2 text-muted">de comisión: cobrar y pagar centavos sí es viable</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Preguntas */}
      <section>
        <Heading eyebrow="Preguntas" title="Lo que más nos preguntan" />
        <div className="grid gap-3 md:grid-cols-2">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={(i % 2) * 100}>
              <details className="panel group p-5">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {f.q}
                  <span className="font-data shrink-0 text-2xl text-accent transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <Reveal as="section" className="relative overflow-hidden rounded-[28px] bg-accent px-6 py-14 text-center text-accent-ink sm:px-12">
        <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="drop-fall absolute h-6 w-1 rounded-full bg-accent-ink"
              style={{ left: `${(i * 41) % 100}%`, top: `${(i * 23) % 80}%`, animationDelay: `${(i % 6) * 0.15}s` }}
            />
          ))}
        </div>
        <h2 className="font-display relative text-4xl font-extrabold sm:text-5xl">Que la lluvia no te deje sin el día.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-lg opacity-80">Activa tu ubicación, asegura tu zona y sigue rodando tranquilo.</p>
        <Link href="/asegurar" className="btn relative mt-8 bg-accent-ink px-8 py-4 text-lg text-accent">
          Empezar mi turno →
        </Link>
      </Reveal>
    </div>
  );
}
