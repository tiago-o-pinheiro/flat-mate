"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dispatch } from "@/app/actions";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
export function Welcome({ name, house }: { name: string; house: string }) {
  const [avatar, setAvatar] = useState(0),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition(),
    router = useRouter();
  return (
    <main className="login-page">
      <div className="login-card">
        <Logo />
        <span className="eyebrow">BIENVENIDO A {house.toUpperCase()}</span>
        <h1>Hazte un hueco.</h1>
        <p>Cuéntanos cómo te llamas y elige tu avatar.</p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await dispatch({
                type: "profile.save",
                name: data.get("name"),
                avatar,
              });
              if (!result.ok) setError(result.error);
              else {
                router.replace("/");
                router.refresh();
              }
            });
          }}
        >
          <label>
            Tu nombre
            <input name="name" defaultValue={name} required maxLength={80} />
          </label>
          <div
            className="avatar-picker"
            role="group"
            aria-label="Elige tu avatar"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <button
                type="button"
                key={i}
                className={avatar === i ? "selected" : ""}
                onClick={() => setAvatar(i)}
                aria-label={`Avatar ${i + 1}`}
                aria-pressed={avatar === i}
              >
                <Avatar name={`Avatar ${i + 1}`} index={i} size={58} />
              </button>
            ))}
          </div>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={pending}>
            {pending ? "Guardando…" : "Entrar en casa"}
          </button>
        </form>
      </div>
    </main>
  );
}
