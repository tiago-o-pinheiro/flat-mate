"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enterGoogleShare,
  redeemPersonalShareLink,
  shareDemoMode,
} from "@/app/actions";
import { Logo } from "@/components/logo";

const key = "flatmate-personal-share-token";
const authKey = "flatmate-personal-share-auth";

export default function OpenPersonalShare() {
  const router = useRouter();
  const [stage, setStage] = useState<"loading" | "auth" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function redeem(saved: string) {
      const result = await redeemPersonalShareLink(saved);
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(authKey);
      if (result.ok && result.value)
        router.replace(`/share/member/${result.value}`);
      else {
        setError(result.ok ? "No se pudo abrir la tarjeta." : result.error);
        setStage("error");
      }
    }
    const token = window.location.hash.slice(1);
    if (token) {
      sessionStorage.setItem(key, token);
      sessionStorage.removeItem(authKey);
      window.history.replaceState(null, "", "/share/open");
      void shareDemoMode().then((demo) => {
        if (demo) void redeem(token);
        else setStage("auth");
      });
      return;
    }
    const saved = sessionStorage.getItem(key);
    if (!saved) {
      queueMicrotask(() => {
        setError(
          "Este enlace ya no está disponible. Pide uno nuevo al administrador.",
        );
        setStage("error");
      });
      return;
    }
    if (sessionStorage.getItem(authKey) !== "yes") {
      queueMicrotask(() => setStage("auth"));
      return;
    }
    void redeem(saved);
  }, [router]);

  return (
    <main className="login-page">
      <div className="login-card">
        <Logo />
        <h1>Tu tarjeta de gastos</h1>
        {stage === "auth" ? (
          <>
            <p>
              Confirma tu identidad con la cuenta de Google vinculada a tu
              plaza. El enlace se invalidará al abrirlo.
            </p>
            <form
              action={enterGoogleShare}
              onSubmit={() => sessionStorage.setItem(authKey, "yes")}
            >
              <button className="button button-primary" type="submit">
                Continuar con Google
              </button>
            </form>
          </>
        ) : stage === "error" ? (
          <p className="error-box" role="alert">
            {error}
          </p>
        ) : (
          <p>Abriendo la tarjeta…</p>
        )}
      </div>
    </main>
  );
}
