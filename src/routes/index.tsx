import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

const TpFichasApp = lazy(() => import("@/components/TpFichasApp"));

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