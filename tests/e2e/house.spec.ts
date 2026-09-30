import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explorar la casa de demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Qué bien estar en casa." }),
  ).toBeVisible();
});
test("inicio, navegación y diseño sin desbordamientos", async ({
  page,
}, info) => {
  await expect(page.locator(".house-context")).toContainText("Casa del Sol");
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  for (const [path, heading] of [
    ["/gastos", "Compartir sin complicarse."],
    ["/calendario", "La vida en casa."],
    ["/tablon", "Se dice por casa."],
    ["/settings", "Las cosas de casa."],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});
test("añadir, editar y eliminar un gasto conservando el tablero", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Añadir gasto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("¿Qué habéis pagado?").fill("Compra de prueba");
  await dialog.getByLabel("Importe (€)").fill("10,01");
  await expect(dialog.getByText("2,51 €", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Añadir gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/gastos");
  await expect(
    page.getByText("Compra de prueba", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar Compra de prueba", exact: true })
    .click();
  await dialog.getByLabel("Importe (€)").fill("20");
  await dialog.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(dialog).not.toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Eliminar Compra de prueba", exact: true })
    .click();
  await expect(page.getByText("Compra de prueba", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Comentario del mes").fill("Todo revisado.");
  await page.getByRole("button", { name: "Publicar comentario" }).click();
  await expect(page.getByText("Todo revisado.", { exact: true })).toBeVisible();
});
test("eventos, turnos y anuncios", async ({ page }) => {
  await page.goto("/calendario");
  await page
    .getByRole("button", { name: "Añadir evento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título", { exact: true }).fill("Cena de bienvenida");
  await dialog.getByRole("button", { name: "Añadir al calendario" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Cena de bienvenida", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear turnos" }).click();
  await dialog.getByLabel("Tarea", { exact: true }).fill("Ordenar cocina");
  await dialog
    .getByRole("button", { name: "Crear turnos", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Completar Ordenar cocina", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Reabrir Ordenar cocina", exact: true }),
  ).toBeVisible();
  await page.goto("/tablon");
  await page.getByRole("button", { name: "Dejar un mensaje" }).click();
  await dialog.getByLabel("Tu mensaje").fill("Hay tarta para todos.");
  await dialog.getByRole("button", { name: "Publicar mensaje" }).click();
  await expect(page.getByText("Hay tarta para todos.")).toBeVisible();
});
test("invitación, registro, acceso desde otro dispositivo y revocación", async ({
  page,
  browser,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre de tu compañero").fill("Marta");
  await dialog.getByRole("button", { name: "Crear invitación" }).click();
  const link = await dialog.getByLabel("Enlace personal").inputValue();
  expect(link).toContain("/join#");
  await dialog.getByRole("button", { name: "Listo" }).click();
  const guestContext = await browser.newContext(),
    guest = await guestContext.newPage();
  await guest.goto(link);
  await expect(
    guest.getByRole("heading", { name: "Hazte un hueco." }),
  ).toBeVisible();
  expect(guest.url()).not.toContain("#");
  await guest.getByLabel("Tu nombre").fill("Marta");
  await guest.getByRole("button", { name: "Avatar 4", exact: true }).click();
  await guest.getByRole("button", { name: "Entrar en casa" }).click();
  await expect(
    guest.getByRole("heading", { name: "Qué bien estar en casa." }),
  ).toBeVisible();
  await guest.goto(new URL("/settings", link).href);
  await expect(
    guest.getByRole("button", { name: "Invitar", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Persona", exact: true })
    .selectOption({ label: "Marta" });
  await page.getByLabel("Alquiler mensual (€)").fill("380");
  await page.getByRole("button", { name: "Guardar alquiler" }).click();
  await page.getByLabel("Fianza entregada (€)").fill("700");
  await page.getByRole("button", { name: "Guardar fianza" }).click();
  await guest.reload();
  await expect(guest.getByText("380,00 €")).toBeVisible();
  await expect(guest.getByText("700,00 €")).toBeVisible();
  await page.goto("/gastos");
  await page.getByRole("button", { name: "Añadir gasto", exact: true }).click();
  const expenseDialog = page.getByRole("dialog");
  await expenseDialog
    .getByLabel("¿Qué habéis pagado?")
    .fill("Compra con Marta");
  await expenseDialog.getByLabel("Importe (€)").fill("50");
  await expenseDialog
    .getByRole("button", { name: "Añadir gasto", exact: true })
    .click();
  await expect(expenseDialog).not.toBeVisible();
  await page
    .getByLabel("Tarjeta individual para")
    .selectOption({ label: "Marta" });
  await page.getByRole("button", { name: "Crear enlace individual" }).click();
  const shareLink = await page
    .getByLabel("Enlace individual de un solo uso")
    .inputValue();
  await guest.goto(shareLink);
  await expect(
    guest.getByRole("heading", { name: "Gastos de Marta" }),
  ).toBeVisible();
  await expect(guest.locator(".share-card")).not.toContainText("Fianza");
  await expect(guest.locator(".share-card")).not.toContainText("380,00 €");
  await expect(guest.locator(".share-card")).not.toContainText("700,00 €");
  await expect(guest.locator(".share-card-total")).toContainText("10,00 €");
  const cardMonth = guest.url().split("/").at(-1);
  const image = await guest.request.get(
    `/api/share/image?scope=member&month=${cardMonth}`,
  );
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  await guest.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(
    guest.getByText("Tu pago de gastos comunes está pendiente de validación"),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Validar" }).click();
  await guest.reload();
  await expect(guest.locator(".share-card-total")).toContainText("0,00 €");
  await guest.goto(shareLink);
  await expect(
    guest.getByRole("alert").filter({ hasText: "utilizado" }),
  ).toContainText("utilizado");
  const otherContext = await browser.newContext(),
    other = await otherContext.newPage();
  await other.goto(link);
  await expect(
    other.getByRole("alert").filter({ hasText: "revocado" }),
  ).toBeVisible();
  await page.goto("/settings");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revocar acceso de Marta" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await guest.goto("/settings");
  await expect(guest).toHaveURL(/\/login/);
  await other.goto(link);
  await expect(
    other.getByRole("alert").filter({ hasText: "revocado" }),
  ).toContainText("revocado");
  await guestContext.close();
  await otherContext.close();
});
test("accesibilidad de estructura, controles y contraste", async ({ page }) => {
  for (const path of ["/", "/gastos", "/calendario", "/tablon", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (results.violations.length)
      await test.info().attach(`a11y-${path.replaceAll("/", "home")}`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
    expect(
      results.violations.map((v) => ({
        path,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});

test("visita temporal, división individual y pago parcial tras una corrección", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Añadir una visita temporal" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Invitado test");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/gastos");
  await page.getByRole("button", { name: "Añadir gasto", exact: true }).click();
  await dialog.getByLabel("¿Qué habéis pagado?").fill("Café visita");
  await dialog.getByLabel("Importe (€)").fill("10,01");
  await dialog.getByRole("checkbox", { name: /División especial/ }).check();
  for (const check of await dialog.locator(".participant-checks input").all())
    await check.uncheck();
  await dialog.getByRole("checkbox", { name: /Invitado test/ }).check();
  await expect(dialog.locator(".split-preview")).toContainText("10,01 €");
  await dialog
    .getByRole("button", { name: "Añadir gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Registrar pago de Invitado test",
      exact: true,
    })
    .click();
  await dialog.getByLabel("Importe (€)").fill("4");
  await dialog
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".balance-row").filter({ hasText: "Invitado test" }),
  ).toContainText("6,01 €");
  await page
    .getByRole("button", { name: "Editar Café visita", exact: true })
    .click();
  await dialog.getByLabel("Importe (€)").fill("12,01");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".balance-row").filter({ hasText: "Invitado test" }),
  ).toContainText("8,01 €");
  await expect(
    page.locator(".payment-row").filter({ hasText: "Invitado test" }),
  ).toContainText("4,00 €");
});

test("el diálogo conserva foco, permite teclado y cierra con Escape", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Añadir gasto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("¿Qué habéis pagado?")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Importe (€)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Añadir gasto", exact: true }),
  ).toBeFocused();
});
