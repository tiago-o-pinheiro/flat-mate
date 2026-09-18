import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
export const metadata: Metadata = {
  title: "Flat Mate · Todo lo de casa, en su sitio",
  description:
    "Gastos compartidos, turnos y pequeñas cosas de casa. Un espacio para vivir mejor juntos.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
