import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

// After a hot update or new deploy, the old chunk URL can 404 ("Failed to fetch
// dynamically imported module"). Retry once, then reload the page once.
const TpFichasApp = lazy(async () => {
  try {
    return await import("@/components/TpFichasApp");
  } catch (err) {
    try {
      return await import("@/components/TpFichasApp");
    } catch {
      const key = "tp-chunk-reload";
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  }
});
if (typeof window !== "undefined") {
  setTimeout(() => sessionStorage.removeItem("tp-chunk-reload"), 10000);
}

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