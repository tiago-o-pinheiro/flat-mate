import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setupCommunity } from "@/app/actions";
import { Logo } from "@/components/logo";
export default async function Onboarding() {
  const session = await auth();
  if (!session?.user.ownerKey) redirect("/login");
  return (
    <main className="login-page">
      <div className="login-card">
        <Logo />
        <h1>
          Un lugar para
          <br />
          vuestra casa.
        </h1>
        <p>Crea tu comunidad. Después podrás invitar a tus compañeros.</p>
        <form action={setupCommunity} className="form-stack">
          <label>
            Nombre de la comunidad
            <input
              name="name"
              placeholder="La casa de los jueves"
              required
              maxLength={80}
            />
          </label>
          <button className="button button-primary">Crear mi comunidad</button>
        </form>
      </div>
    </main>
  );
}
