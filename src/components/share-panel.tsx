"use client";
import { useState } from "react";
import { createPersonalShareLink } from "@/app/actions";
import type { PublicCommunity } from "@/lib/domain/types";
import { Button } from "./ui/button";

export function SharePanel({
  state,
  month,
  baseUrl,
}: {
  state: PublicCommunity;
  month: string;
  baseUrl: string;
}) {
  const members = state.members.filter((m) => m.role === "member" && m.active);
  const [selected, setSelected] = useState(members[0]?.id ?? "");
  const [personalLink, setPersonalLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const commonLink = `${baseUrl}/share/common/${state.id}/${month}`;
  const commonImage = `/api/share/image?scope=common&communityId=${encodeURIComponent(state.id)}&month=${encodeURIComponent(month)}`;
  const personalImage = `/api/share/image?scope=member&memberId=${encodeURIComponent(selected)}&month=${encodeURIComponent(month)}`;
  async function shareImage(url: string, link: string, filename: string) {
    setMessage("");
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const file = new File([await response.blob()], filename, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: link });
      } else {
        const objectUrl = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        setMessage("Imagen descargada. Ya puedes adjuntarla en WhatsApp.");
      }
    } catch {
      setMessage("No se pudo generar la imagen. Inténtalo de nuevo.");
    }
  }
  return (
    <section className="panel share-panel">
      <div className="panel-header">
        <div>
          <h2>Compartir gastos</h2>
          <p>Envía el resumen de la casa o una cuota personal.</p>
        </div>
      </div>
      <div className="share-panel-grid">
        <div className="share-option">
          <h3>Gastos de la casa</h3>
          <p>El total y las categorías de este mes, sin alquileres.</p>
          <div className="share-actions">
            <Button
              type="button"
              onClick={() =>
                void shareImage(
                  commonImage,
                  commonLink,
                  `gastos-casa-${month}.png`,
                )
              }
            >
              Compartir total de gastos
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(commonLink)
                  .then(() => setMessage("Enlace general copiado."))
              }
            >
              Copiar enlace general
            </Button>
            <a
              className="button button-secondary"
              href={`https://wa.me/?text=${encodeURIComponent(commonLink)}`}
              target="_blank"
              rel="noreferrer"
            >
              Enviar enlace por WhatsApp
            </a>
          </div>
        </div>
        {!!members.length && (
          <div className="share-option">
            <h3>Tarjeta individual</h3>
            <p>
              Solo muestra gastos comunes. El enlace pide Google y se usa una
              vez; la imagen no incluye alquiler ni fianza.
            </p>
            <label className="share-member-select">
              Tarjeta individual para
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setPersonalLink("");
                }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="share-actions">
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await createPersonalShareLink({
                    memberId: selected,
                    month,
                  });
                  if (result.ok) {
                    setPersonalLink(result.value ?? "");
                    setMessage(
                      "Enlace personal creado. Solo se puede abrir una vez.",
                    );
                  } else setMessage(result.error);
                  setBusy(false);
                }}
              >
                Crear enlace individual
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void shareImage(
                    personalImage,
                    personalLink,
                    `gastos-personales-${month}.png`,
                  )
                }
              >
                Compartir imagen individual
              </Button>
            </div>
            {personalLink && (
              <div className="share-link-box">
                <label>
                  Enlace de un solo uso
                  <input
                    aria-label="Enlace individual de un solo uso"
                    readOnly
                    value={personalLink}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <div className="share-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(personalLink)
                        .then(() => setMessage("Enlace individual copiado."))
                    }
                  >
                    Copiar enlace individual
                  </Button>
                  <a
                    className="button button-secondary"
                    href={`https://wa.me/?text=${encodeURIComponent(personalLink)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Enviar enlace por WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {message && (
        <p className="share-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
