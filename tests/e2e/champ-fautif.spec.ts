import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { choisirPriorite } from "./setup/formulaire-creation";
import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M14 (audit GR du 26/09/2026, constat M14) — LE CHAMP EN CAUSE D'UN
 * REFUS DE SAISIE EST ENCADRÉ ET FOCALISÉ.
 *
 * ## Le constat
 *
 * Après un refus de saisie, `/interventions/nouvelle` montrait le motif en
 * bandeau (`role="status"`) — mais AUCUN champ n'était marqué : le
 * bandeau était le seul repère, et un lecteur d'écran ne le lie à rien.
 *
 * ## Ce que ce fichier prouve
 *
 * `tests/unit/interventions/champ-en-cause.test.ts` éprouve `champEnCause`,
 * pure. Ce fichier prouve qu'un écran RÉEL encadre et focalise le bon champ
 * — aucune donnée créée, l'URL porte le motif directement, comme un retour
 * de `versLeFormulaire` (`app/api/interventions/creer/formulaire.ts`).
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la panne manquante encadre et focalise la description", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.panne_manquante",
  );
  const textarea = page.locator('textarea[name="description"]');
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(textarea).toBeFocused();
  await expect(page.locator('select[name="type"]')).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("la nature manquante encadre et focalise le select", async ({ page }) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.nature_manquante",
  );
  const select = page.locator('select[name="type"]');
  await expect(select).toHaveAttribute("aria-invalid", "true");
  await expect(select).toBeFocused();
  await expect(
    page.locator('textarea[name="description"]'),
  ).not.toHaveAttribute("aria-invalid", "true");
});

/**
 * LA PANNE TROP LONGUE (constat 1 de l'audit fonctionnel 9F5,
 * `docs/audits/9F5-fonctionnel/rapport.md`) — MÊME champ que la panne
 * manquante, mais un bandeau NOMMÉ distinct : le message affiché ne doit
 * jamais dire « obligatoire » pour un texte qui ne l'est pas.
 */
test("la panne trop longue encadre et focalise la description, avec son propre message", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.panne_trop_longue",
  );
  const textarea = page.locator('textarea[name="description"]');
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(textarea).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "trop long" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "obligatoire" }),
  ).toHaveCount(0);
});

/**
 * LA PRIORITÉ MANQUANTE (décision 15 d'Alexis du 05/10/2026,
 * TP-UX5-1-FORMULAIRES) — même discipline, sur le groupe de boutons radio
 * (`components/ui/choix.tsx`) plutôt qu'un `<select>`.
 */
test("la priorité manquante encadre et focalise le groupe de boutons radio", async ({
  page,
}) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.priorite_manquante",
  );
  const groupe = page
    .getByRole("radiogroup")
    .filter({ has: page.locator('input[name="priorite"]') });
  await expect(groupe).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('input[name="priorite"]').first()).toBeFocused();
  await expect(page.locator('select[name="type"]')).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("le repli « lieu inconnu » n'encadre aucun champ", async ({ page }) => {
  await page.goto(
    "/interventions/nouvelle?motif=intervention.refus.lieu_inconnu",
  );
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});

/**
 * 9G6-FORMULAIRES, point 1 — UN SITE TAPÉ SANS ÊTRE CHOISI DANS LA LISTE
 * BLOQUE L'ENVOI, CÔTÉ CLIENT, ET GARDE LE TEXTE.
 *
 * Avant ce lot, le champ caché `site` restait vide tant qu'aucune
 * proposition n'était choisie : `required` ne portait que sur le champ texte
 * VISIBLE, jamais sur la sélection elle-même. Le formulaire partait donc au
 * serveur, qui refusait (« Ce lieu n'existe pas... ») en PERDANT le texte
 * tapé — `versLeFormulaire` ne reçoit que `champsResoumis.site`, un
 * identifiant validé, jamais un texte libre.
 *
 * Aucune donnée créée : le blocage est entièrement côté client, avant tout
 * appel réseau vers `/api/interventions/creer`.
 */
test("un site tapé sans être choisi bloque l'envoi et garde le texte", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  const champSite = page.locator('[data-selecteur="site"] input[type="text"]');
  await champSite.fill("Un site qui n'a jamais été choisi");
  // Les AUTRES champs obligatoires sont remplis pour isoler le champ en
  // cause : seul le site doit rester invalide à l'envoi.
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill("Une panne quelconque, pour isoler le champ Site.");
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();

  await expect(page).toHaveURL(/\/interventions\/nouvelle$/);
  await expect(champSite).toHaveValue("Un site qui n'a jamais été choisi");
  await expect(champSite).toHaveAttribute("aria-invalid", "true");
  await expect(champSite).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: fr["selecteur.choix_requis"] }),
  ).toBeVisible();
});
