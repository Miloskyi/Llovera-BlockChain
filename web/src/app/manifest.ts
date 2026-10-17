import type { MetadataRoute } from "next";

/** Permite instalar Lloverá en la pantalla de inicio del celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lloverá · Micro-seguro de lluvia",
    short_name: "Lloverá",
    description: "Si cae el aguacero en tu zona, cobras al instante.",
    start_url: "/asegurar",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060a13",
    theme_color: "#060a13",
    lang: "es-CO",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
