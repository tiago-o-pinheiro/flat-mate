export default function Loading() {
  return (
    <main className="loading-page" aria-label="Cargando tu casa">
      <div className="skeleton" style={{ height: 32, width: 180 }} />
      <div className="skeleton" style={{ height: 230 }} />
      <div className="skeleton" style={{ height: 280 }} />
    </main>
  );
}
