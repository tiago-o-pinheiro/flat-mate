import { enterDemo, enterGoogle } from "@/app/actions";
import { demoMode } from "@/lib/server/config";
import { HouseIllustration } from "@/components/house-illustration";
import { Logo } from "@/components/logo";
import { ArrowRight, ShieldCheck } from "lucide-react";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <div className="login-card">
        <Logo />
        <div className="login-art">
          <HouseIllustration />
        </div>
        <span className="eyebrow">MENOS CUENTAS. MÁS CONVIVENCIA.</span>
        <h1>
          Compartir casa.
          <br />
          <em>Sentirse en casa.</em>
        </h1>
        <p>
          Los gastos, los turnos y las pequeñas cosas del día a día. Por fin,
          juntos en un mismo lugar.
        </p>
        {error && (
          <div role="alert" className="error-box">
            No se pudo iniciar sesión. Comprueba tu acceso o inténtalo de nuevo.
          </div>
        )}
        {process.env.AUTH_GOOGLE_ID && (
          <form action={enterGoogle}>
            <button className="button button-primary login-cta" type="submit">
              Continuar con Google <ArrowRight size={17} />
            </button>
          </form>
        )}
        {demoMode() && (
          <form action={enterDemo}>
            <button className="button button-primary login-cta" type="submit">
              Explorar la casa de demo <ArrowRight size={17} />
            </button>
          </form>
        )}
        {!demoMode() && !process.env.AUTH_GOOGLE_ID && (
          <p className="error-box">
            Falta configurar el acceso con Google. Consulta las instrucciones de
            despliegue.
          </p>
        )}
        <div className="login-foot">
          <ShieldCheck size={15} />
          <span>¿Te han invitado? Entra con tu enlace personal.</span>
        </div>
      </div>
      <p className="login-bottom">
        Hecho para las personas con las que compartes hogar.
      </p>
    </main>
  );
}
