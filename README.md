# Flat Mate

Una app para compartir casa: gastos mensuales, liquidación con el administrador, turnos, ausencias y un tablón de anuncios. Next.js App Router, TypeScript, PostgreSQL/Neon, Drizzle y Auth.js. Interfaz en español, EUR y zona horaria Europe/Madrid.

## Probar en local

Requiere Node.js 22.12 o posterior.

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000` y pulsa **Explorar la casa de demo**. Sin `DATABASE_URL`, el entorno de desarrollo utiliza datos ficticios locales en `.data/`. Cada entrada a la demo crea una comunidad independiente; los enlaces de invitación sí comparten esa comunidad. Los cambios sobreviven a reinicios del servidor local.

Si el puerto 3000 está ocupado, configura la URL exacta para que las invitaciones apunten al puerto correcto:

```bash
APP_URL=http://localhost:3001 npm run dev -- --port 3001
```

La demo permite probar las operaciones de la app, incluidos enlaces, visitas, gastos, pagos, comentarios, anuncios, calendarios y rotaciones. Conectar Google requiere credenciales propias. El modo local no es un almacenamiento para Vercel: su sistema de archivos es efímero y no compartido entre instancias. En producción usa PostgreSQL y `DEMO_MODE=false`.

## Conectar una base de datos real

1. Crea un proyecto PostgreSQL en Neon y copia su conexión con pooling y TLS.
2. Copia `.env.example` a `.env.local` y completa las variables:

| Variable               | Valor                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Conexión PostgreSQL, por ejemplo la URL con pooling de Neon y `sslmode=require`. |
| `AUTH_SECRET`          | Secreto aleatorio, generado con `openssl rand -base64 32`.                       |
| `AUTH_GOOGLE_ID`       | ID del cliente OAuth de Google.                                                  |
| `AUTH_GOOGLE_SECRET`   | Secreto del mismo cliente OAuth.                                                 |
| `APP_URL`              | Origen exacto de la aplicación, sin barra final.                                 |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes en hexadecimal: `openssl rand -hex 32`.                                 |
| `CRON_SECRET`          | Otro secreto aleatorio: `openssl rand -hex 32`.                                  |
| `DEMO_MODE`            | `false` para utilizar la base de datos real.                                     |

3. Ejecuta `npm run db:migrate`.
4. Entra con Google y crea tu comunidad. El administrador se incluye en el reparto. Cada inquilino vincula su cuenta Google al abrir su primera invitación.

Para datos ficticios en una **base de pruebas**, define `SEED_GOOGLE_SUB` con el identificador `sub` de tu cuenta Google y ejecuta `npm run db:seed`. No es la dirección de correo. El seed añade una comunidad; no borra datos. No lo ejecutes sobre una comunidad real existente del mismo propietario.

## Google: acceso y calendario compartido

En Google Cloud, habilita **Google Calendar API** y configura un cliente OAuth de tipo aplicación web y la pantalla de consentimiento. Durante las pruebas añade las cuentas del administrador y de los inquilinos a los usuarios de prueba.

Registra estas URL de retorno, sustituyendo el origen por tu dominio:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/google/callback
https://tu-app.vercel.app/api/auth/callback/google
https://tu-app.vercel.app/api/google/callback
```

El login inicial pide la identidad de Google. La conexión del calendario es una autorización separada desde **Ajustes → Google Calendar** y solicita:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- Acceso sin conexión para sincronizar cuando el administrador no está conectado.

Después de conectar, selecciona un calendario en el que el administrador tenga permiso de escritura. Los demás compañeros necesitan Google para entrar en la app, pero no necesitan autorizar Google Calendar. Para uso continuado revisa la configuración de publicación y verificación del consentimiento de Google; el modo de pruebas puede requerir reautorizar periódicamente.

La app crea y mantiene solo sus propios eventos en el calendario elegido. No importa eventos externos ni cambios realizados en Google. Las ausencias incluyen el último día seleccionado; el adaptador convierte ese dato al final exclusivo de Google. No se añaden invitados ni se envían correos de invitación.

La sincronización intenta ejecutarse después de guardar. Los cambios pendientes permanecen en PostgreSQL, con versión, error y un identificador estable de Google. El botón de reintento y el cron diario vuelven a procesarlos sin duplicar eventos. Un error de Google nunca revierte el evento local. Las credenciales se cifran con AES-256-GCM; los errores de renovación requieren reconectar. Desconectar no borra los eventos publicados en Google.

Referencias: [configuración de Auth.js](https://authjs.dev/getting-started), [permisos de Calendar](https://developers.google.com/workspace/calendar/api/auth), [crear eventos](https://developers.google.com/workspace/calendar/api/guides/create-events).

## Desplegar en Vercel

1. Publica este repositorio en tu proveedor Git e impórtalo en Vercel como proyecto Next.js.
2. Configura las variables anteriores en Production. Usa una base separada para Preview.
3. Ajusta `APP_URL` al dominio definitivo y registra los callbacks en Google.
4. Aplica `npm run db:migrate` contra la base de producción antes del primer despliegue y cuando se añadan migraciones. No se ejecutan migraciones destructivas durante el build.
5. Despliega. `vercel.json` configura `/api/cron` una vez al día a las 05:00 UTC, con autenticación mediante `CRON_SECRET`.
6. Comprueba login, creación de comunidad, invitación en otro navegador y conexión al calendario compartido.

Al actualizar desde una versión con invitaciones reutilizables, las sesiones de miembros basadas solo en el enlace dejan de ser válidas. El administrador debe generar una invitación nueva para que cada persona vincule Google. En la demo local, el acceso de prueba no requiere Google, pero también consume las invitaciones al primer uso.

El cambio de tablero depende de la fecha local de Madrid y se resuelve al acceder, no del cron. El cron amplía los turnos a 90 días y reintenta sincronizaciones. Revisa los logs de Vercel y los indicadores de Google en Ajustes para detectar fallos. La app no genera notificaciones externas propias.

## Modelo y decisiones de implementación

Los tipos de dominio están en `src/lib/domain/types.ts`; las reglas y la validación Zod, en `src/lib/domain/commands.ts`.

- Comunidad: propietario Google, personas, categorías, tableros, gastos, cuotas, pagos, comentarios, anuncios, calendarios, eventos, rotaciones y auditoría.
- PostgreSQL conserva cada comunidad como un agregado tipado en JSONB. Cada operación bloquea solo su fila con `SELECT FOR UPDATE` y guarda la transacción completa. Esto mantiene atómicos el gasto, su reparto y la auditoría, sin introducir un backend separado ni transacciones repartidas entre múltiples entidades. Hay un índice de propietario y una tabla independiente para límites de acceso.
- Es una decisión para comunidades pequeñas. Las entidades están separadas en los tipos y las reglas, pero no son tablas independientes. Si el volumen exige consultas analíticas entre comunidades, se pueden normalizar sin cambiar la interfaz pública.
- El navegador recibe una proyección sin identificador Google del propietario, hashes de acceso ni credenciales. Todas las lecturas y mutaciones autentican la comunidad; cada comando valida autoría y permisos de nuevo dentro de la transacción.
- Los participantes permanentes activos entran por defecto. Las visitas se seleccionan expresamente y solo dentro de su mes. Un gasto conserva su reparto aunque cambie la composición de la casa.
- Los importes son céntimos enteros. Los restos se asignan por orden estable de ID. Cada gasto común se reparte por igual entre sus participantes. La comunidad elige una dinámica para todos sus gastos: descontar anticipos del saldo o mantener cuotas iguales mientras el administrador reembolsa cada recibo adelantado. Cambiar la dinámica recalcula también los gastos existentes. Las comunidades nuevas empiezan con reembolso; las anteriores conservan el descuento hasta que el administrador cambie la configuración.
- El alquiler se asigna por persona y mes de inicio y figura como pagado automáticamente; el administrador puede cambiar su estado por mes. La fianza es un dato privado informativo. `Pendiente = alquiler marcado pendiente + gastos cobrables − adelantos descontables − pagos al admin + devoluciones`. Los gastos incluidos en el alquiler no se cobran otra vez y los reembolsos de recibos se registran aparte.
- El administrador no registra movimientos consigo mismo. Ve su cuota, lo adelantado, lo que debe cobrar y lo que debe devolver.
- Borrar o corregir gastos conserva pagos y genera auditoría. Los movimientos erróneos se anulan conservando importe, autor y fecha. Las deudas históricas siguen en su mes y se muestran separadas.
- Los enlaces de invitación y de tarjeta personal son secretos aleatorios de 256 bits; solo se guarda su hash. Viajan en el fragmento de la URL y se consumen una sola vez. La invitación vincula la primera cuenta Google que la utiliza. Revocar el acceso invalida las sesiones de esa persona. Cada tarjeta personal exige una autenticación Google nueva en el dispositivo antes de consumir el enlace. Sesiones JWT de Auth.js en cookies HttpOnly durante 30 días.
- Las tarjetas compartidas solo muestran gastos comunes. El alquiler y la fianza se sirven únicamente al propio inquilino y al administrador dentro de la app. Los inquilinos solo declaran pagos de gastos comunes; la validación del administrador crea el movimiento contable. El estado del alquiler lo cambia exclusivamente el administrador.
- Los turnos se materializan con IDs estables a 90 días. Modificar una serie reemplaza únicamente los futuros pendientes. Las ausencias son informativas; no alteran repartos ni saltan turnos automáticamente.

### Interfaces

- `dispatch(command)` es la Server Action para comandos de dominio, validados por `commandSchema`. Devuelve `{ok: true, value?}` o `{ok: false, error}`.
- Server Actions separadas gestionan invitaciones, acceso, alta de comunidad y conexión del calendario. No hay API pública sin sesión.
- `/api/auth/[...nextauth]`: OAuth de Google e intercambio de invitaciones.
- `/api/google/connect` y `/api/google/callback`: autorización de calendario con estado y PKCE.
- `/api/cron`: mantenimiento autenticado.
- `/share/common/...` y `/share/member/...`: tarjetas mensuales protegidas; `/api/share/image` genera el PNG.

## Verificación

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest verifica importes, reparto, visitantes, liquidación, permisos, revocación, históricos, fechas, turnos, cifrado, persistencia concurrente y el adaptador de Google con respuestas simuladas. Playwright recorre las pantallas en escritorio y móvil, crea y modifica gastos, comenta, crea eventos y turnos, publica anuncios y comprueba invitaciones desde navegadores independientes. Axe comprueba accesibilidad.

Las pruebas E2E compilan y levantan un servidor de producción aislado en el puerto 3002, con datos temporales nuevos en cada ejecución y salida de compilación en `.next-e2e/`. No reutilizan la demo ni acceden a datos reales. Las pruebas unitarias usan una carpeta temporal independiente. La comprobación real del consentimiento OAuth, del almacenamiento Neon y del calendario requiere las credenciales del propietario.

Fuera de esta versión: transferencias bancarias, OCR, adjuntos, gastos recurrentes, notificaciones propias y sincronización de Google hacia la app.
