import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * 9AW-GR17-SURCHARGE-MARQUE, M15 — LA MARQUE SUR LA PAGE DE CONNEXION.
 *
 * Décision d'Alexis du 27/09/2026 : le triangle et « CODI »+« PLAN » que le
 * chrome de navigation affiche déjà (`barre.tsx`, `MarqueClaire` — désormais
 * dans `components/navigation/marque.tsx`) se rendent aussi avant toute
 * session, au-dessus du formulaire. `barre-sans-session.spec.ts` établit déjà
 * qu'AUCUNE barre de navigation ne coiffe cet écran (R2-16) — ce scénario ne
 * le rejoue pas, il éprouve ce qui remplace son absence.
 *
 * `a[href="/"]` désigne la marque sans ambiguïté : c'est le seul lien de cet
 * écran qui mène à l'accueil du produit — les autres cibles sont des routes
 * d'API (`action` du formulaire).
 */
test("la marque est visible sur /connexion, et le formulaire reste utilisable", async ({
  page,
}) => {
  await page.goto("/connexion");

  const marque = page.locator('a[href="/"]');
  await expect(marque).toBeVisible();
  await expect(marque).toContainText(fr["nav.marque_debut"]);
  await expect(marque).toContainText(fr["nav.marque_fin"]);

  // LE FORMULAIRE RESTE UTILISABLE : la marque ne doit rien lui masquer ni
  // lui retirer.
  await expect(page.getByLabel(fr["connexion.email"])).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["connexion.valider"] }),
  ).toBeVisible();
});

test("l'onglet de /connexion porte une icône qui répond", async ({
  page,
  request,
}) => {
  await page.goto("/connexion");
  const icone = page.locator('link[rel="icon"]').first();
  await expect(icone).toHaveCount(1);
  const href = await icone.getAttribute("href");
  expect(href).not.toBeNull();

  // Sans session, jamais authentifié : cette URL doit répondre d'elle-même,
  // aucun contrôle de session ne doit s'interposer.
  const reponse = await request.get(href as string);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"] ?? "").toContain("image");
});
