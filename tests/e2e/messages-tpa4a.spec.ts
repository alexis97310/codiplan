import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9BP-TP-A4a-MESSAGES (audit du 28/09/2026) — QUATRE ÉCRANS, EN LECTURE
 * SEULE.
 *
 * Aucune écriture : chaque scénario navigue avec des paramètres d'URL choisis
 * pour ne rien trouver dans la société de l'épreuve — un préfixe `TPA4-`
 * garanti absent du semis et des scènes des autres spécimens du même run
 * (`fullyParallel`) — ou n'ouvre aucune session du tout (`/connexion`).
 */

test.describe("IN-07 — la période inversée se nomme, et « Tout effacer » reste là", () => {
  test("une fin de période avant son début affiche le motif et le lien", async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/interventions?du=2026-10-10&au=2026-10-01");

    await expect(
      page.getByText(fr["interventions.refus.periode_inversee"]),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: fr["interventions.puce_tout_effacer"] })
        .first(),
    ).toBeVisible();
  });
});

test.describe("IN-12 — le registre ne confond plus « vide » et « filtré, sans résultat »", () => {
  test("une recherche qui ne trouve rien affiche le texte du filtre, jamais celui du registre vide", async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/interventions?q=TPA4-AUCUN");

    await expect(page.getByText(fr["interventions.vide_filtre"])).toBeVisible();
    await expect(page.getByText(fr["interventions.vide"])).not.toBeVisible();
  });
});

test.describe("PV-36 — même distinction sur le registre VGP", () => {
  test("une recherche qui ne trouve rien affiche le texte du filtre et « Voir tout le registre »", async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/vgp?q=TPA4-AUCUN");

    await expect(page.getByText(fr["vgp.vide_filtre"])).toBeVisible();
    await expect(
      page.getByRole("link", { name: fr["vgp.filtre_retirer"] }),
    ).toBeVisible();
  });
});

test.describe("TR-31 — une panne technique à la connexion ne dit pas « vérifiez vos identifiants »", () => {
  test("le motif « indisponible » affiche son propre texte, distinct du refus", async ({
    page,
  }) => {
    await page.goto("/connexion?motif=auth.indisponible");

    await expect(page.getByText(fr["auth.indisponible"])).toBeVisible();
    await expect(page.getByText(fr["auth.refus"])).not.toBeVisible();
  });
});
