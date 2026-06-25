import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ZephyrLogo } from "@/components/brand/ZephyrLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <ZephyrLogo variant="dark" size={36} />
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
