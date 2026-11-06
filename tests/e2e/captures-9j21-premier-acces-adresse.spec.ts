import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * 9J21-PORTAIL-FINITIONS-INVITATION, point 6 — L'ADRESSE AFFICHÉE EN LECTURE
 * SEULE SUR `/premier-acces`.
 *
 * `?email=` n'est PAS lu en base au GET (voir l'en-tête de
 * `premier-acces/page.tsx`) : comme `9g6-point3-premier-acces.spec.ts`, un
 * jeton quelconque suffit pour éprouver l'écran — ce fichier ne teste que ce
 * que la PAGE affiche, jamais la base. La plomberie qui pose `?email=` sur le
 * lien envoyé (`inviterClientAuPortail`, `redirectTo`) est éprouvée côté
 * isolation (`tests/isolation/invitation-portail-client.test.ts`).
 */
test("affiche l'adresse invitée, en lecture seule, quand le lien la porte", async ({
  page,
}) => {
  const ADRESSE_INVITEE = "contact@codima.test";
  await page.goto(
    `/premier-acces?token=jeton-de-test&email=${encodeURIComponent(ADRESSE_INVITEE)}`,
  );

  // L'ADRESSE EST UNE DONNÉE DE LA SCÈNE, PAS UN LIBELLÉ DU PRODUIT (D26) :
  // elle ne vient jamais du dictionnaire, et une comparaison directe sur le
  // texte brut — plutôt qu'un `getByText`/`toContainText` sur CETTE chaîne —
  // n'a donc rien à y chercher.
  const bloc = page.getByText(fr["premier_acces.compte"]).locator("..");
  const texte = await bloc.first().innerText();
  expect(texte.includes(ADRESSE_INVITEE)).toBe(true);

  // JAMAIS UN CHAMP NOMMÉ : rien de ce nom n'est soumis au serveur.
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
});

test("n'affiche rien de plus quand le lien ne porte aucune adresse (compatibilité)", async ({
  page,
}) => {
  await page.goto("/premier-acces?token=jeton-de-test");
  await expect(page.getByText(fr["premier_acces.compte"])).toHaveCount(0);
});
