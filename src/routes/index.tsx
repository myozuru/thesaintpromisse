import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

// After a hot update or new deploy, the old chunk URL can 404 ("Failed to fetch
// dynamically imported module"). Retry once, then reload the page once.
// A failed dynamic import is cached per URL, so retrying the same URL is
// useless — reload the page (at most once every 15s to avoid loops).
const TpFichasApp = lazy(async () => {
  try {
    return await import("@/components/TpFichasApp");
  } catch (err) {
    const key = "tp-chunk-reload-at";
    if (typeof window !== "undefined") {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => {});
      }
    }
    throw err;
  }
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Promisse — TP Fichas" },
      {
        name: "description",
        content: "Gerencie fichas, combate, itens, mapas e campanhas de The Promisse.",
      },
      { property: "og:title", content: "The Promisse — TP Fichas" },
      {
        property: "og:description",
        content: "Painel completo para a campanha de RPG The Promisse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TpFichasApp />
    </Suspense>
  );
}