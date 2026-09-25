import { Link, useRouterState } from "@tanstack/react-router";

const NotFound = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-2 text-xl text-muted-foreground">Página não encontrada</p>
        <p className="mb-4 text-sm text-muted-foreground">{pathname}</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
