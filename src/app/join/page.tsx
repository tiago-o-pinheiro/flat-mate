"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { enterGoogle, enterInvite } from "@/app/actions";
import { Logo } from "@/components/logo";
import { LoaderCircle } from "lucide-react";
export default function Join() {
  const router = useRouter(),
    started = useRef(false),
    [error, setError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", "/join");
    if (!token) {
      queueMicrotask(() =>
        setError(
          "Falta tu enlace personal. Pide al administrador que te lo envíe de nuevo.",
        ),
      );
      return;
    }
    enterInvite(token)
      .then((result) => {
        if (!result.ok) setError(result.error);
        else if (result.value === "google") setGoogleReady(true);
        else {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() =>
        setError(
          "No se pudo abrir tu invitación. Vuelve a intentarlo desde el enlace original.",
        ),
      );
  }, [router]);
  return (
    <main className="login-page">
      <div className="login-card">
        <Logo />
        <h1>Ya estás en casa.</h1>
        {error ? (
          <p role="alert" className="error-box">
            {error}
          </p>
        ) : googleReady ? (
          <form action={enterGoogle}>
            <p>
              Confirma tu cuenta de Google para vincularla a tu plaza en la
              casa. Este enlace ya no podrá utilizarse después.
            </p>
            <button className="button button-primary" type="submit">
              Continuar con Google
            </button>
          </form>
        ) : (
          <p className="inline-center">
            <LoaderCircle className="spin" size={20} /> Abriendo tu invitación…
          </p>
        )}
      </div>
    </main>
  );
}
