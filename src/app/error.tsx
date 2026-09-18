"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>
          No hemos podido
          <br />
          abrir la casa.
        </h1>
        <p>Comprueba tu conexión e inténtalo de nuevo.</p>
        <button className="button button-primary" onClick={reset}>
          Volver a intentar
        </button>
        <Link className="text-link" href="/login">
          Volver al acceso
        </Link>
      </div>
    </main>
  );
}
