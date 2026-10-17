import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

// Fuentes locales (Fontsource): next/font/google falla en el build de Vercel al descargar de Google Fonts.
const bricolage = localFont({
  variable: "--font-bricolage",
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
});
const instrument = localFont({
  variable: "--font-instrument",
  src: [
    { path: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-italic.woff2", style: "italic" },
  ],
  weight: "400 700",
});
const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  title: "Lloverá",
  description: "Micro-seguro paramétrico para repartidores del Valle de Aburrá. Si cae el aguacero en tu zona, cobras al instante en Monad.",
  appleWebApp: { capable: true, title: "Lloverá", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#060a13", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${bricolage.variable} ${instrument.variable} ${plexMono.variable} antialiased`}>
        <Providers>
          <div className="relative z-10">
            <Header />
            <main className="has-bottom-nav mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6">{children}</main>
            <footer className="hidden border-t border-line md:block">
              <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-dim sm:flex-row sm:justify-between sm:px-6">
                <p>Lloverá · Hackathon Monad · Prototipo de fondo mutual de protección de ingresos, no es un seguro regulado.</p>
                <p>Límites: DANE (MGN, CC BY 4.0) y Alcaldía de Medellín · Clima: Open-Meteo</p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
