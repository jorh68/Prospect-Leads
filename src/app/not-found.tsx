import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="No encontrado"
      description="La página o el registro que buscas no existe o se ha eliminado."
      action={<ButtonLink href="/">Volver al dashboard</ButtonLink>}
    />
  );
}
