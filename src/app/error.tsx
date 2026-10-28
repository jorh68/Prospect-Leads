"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      title="Algo ha fallado"
      description={error.digest ? `Error ${error.digest}. Revisa los logs del servidor.` : "Revisa los logs del servidor."}
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  );
}
