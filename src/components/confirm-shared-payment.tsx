"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dispatch } from "@/app/actions";
import { Button } from "./ui/button";

export function ConfirmSharedPayment({
  month,
  amount,
  pendingClaim,
}: {
  month: string;
  amount: number;
  pendingClaim: boolean;
}) {
  const [value, setValue] = useState((amount / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (pendingClaim)
    return (
      <p role="status">
        Tu pago de gastos comunes está pendiente de validación por el
        administrador.
      </p>
    );
  if (amount <= 0)
    return <p>No tienes gastos comunes pendientes de confirmar.</p>;
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const result = await dispatch({
          type: "payment.claim",
          month,
          amount: value,
          purpose: "shared",
        });
        setMessage(
          result.ok
            ? "Pago declarado. El administrador lo validará al recibirlo."
            : result.error,
        );
        setBusy(false);
        if (result.ok) router.refresh();
      }}
    >
      <label>
        Importe pagado por gastos comunes (€)
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={busy}>
        Confirmar pago
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
