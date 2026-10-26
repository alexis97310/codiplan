import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9G6-FORMULAIRES, point 2 — LE RETOUR MÈNE AU BON ENDROIT.
 *
 * Avant ce lot, « Annuler » et le fil d'ariane de `/interventions/nouvelle`
 * menaient TOUJOURS à `/planning`, même en arrivant d'une fiche client ou
 * site par « + Intervention » (`?client=`/`?site=`). `?depuis=` porte
 * maintenant le chemin d'origine — accepté seulement s'il s'agit d'un
 * chemin INTERNE, jamais une URL externe (redirection ouverte).
 *
 * `Annuler` se cible par son texte (unique dans la page) plutôt que par son
 * `href` : le fil d'ariane porte le MÊME `href`, en deux copies (mobile et
 * bureau, `components/navigation/fil-d-ariane.tsx`), dont une seule visible
 * selon le viewport — viser `href` seul tomberait sur le mauvais lien.
 *
 * Aucune donnée créée : ces quatre scènes ne lisent que l'URL.
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

function lienAnnuler(page: import("@playwright/test").Page) {
  return page.getByRole("link", {
    name: fr["intervention.creation.annuler"],
  });
}

test("sans ?depuis=, Annuler reste sur /planning (défaut inchangé)", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await expect(lienAnnuler(page)).toHaveAttribute("href", "/planning");
});

test("?depuis=/clients/abc mène Annuler et le fil d'ariane vers cette fiche client", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle?depuis=%2Fclients%2Fabc");
  await expect(lienAnnuler(page)).toHaveAttribute("href", "/clients/abc");
  // LES DEUX COPIES DU FIL D'ARIANE (mobile et bureau) PLUS « ANNULER »
  // PORTENT LE MÊME `href` — la navigation PERMANENTE du back-office garde
  // son propre lien « Planning » vers `/planning`, sans rapport avec `depuis`.
  await expect(page.locator('a[href="/clients/abc"]')).toHaveCount(3);
});

test("une URL externe dans ?depuis= est refusée, retour au défaut /planning", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?depuis=" +
      encodeURIComponent("https://exemple-externe.test/piege"),
  );
  await expect(lienAnnuler(page)).toHaveAttribute("href", "/planning");
  await expect(
    page.locator('a[href="https://exemple-externe.test/piege"]'),
  ).toHaveCount(0);
});

test("un ?depuis= en protocole relatif (//) est refusé, retour au défaut", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?depuis=" +
      encodeURIComponent("//exemple-externe.test/piege"),
  );
  await expect(lienAnnuler(page)).toHaveAttribute("href", "/planning");
});
