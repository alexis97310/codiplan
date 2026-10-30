import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS (point 4) — même
 * discipline que `captures-9i6b-lien-acces-a-copier.spec.ts` : rien n'est
 * écrit sur disque sans `CAPTURES_9I7D`, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * Quatre scènes : la ligne d'un compte de DIRECTION (sans « Copier un
 * nouveau lien », décision B, D223) et d'un ADV (avec), le motif NOMMÉ d'un
 * refus affiché par `BoutonCopierLien` (B5), la saisie des mentions légales
 * après un refus (point 3).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I7D ?? "";

const NOM_DIRECTION = "9I7D-CAP — Compte de direction protégé";
const COURRIEL_DIRECTION = "direction@9i7dcap.e2e.test";
const NOM_ADV = "9I7D-CAP — Compte ADV témoin";
const COURRIEL_ADV = "adv@9i7dcap.e2e.test";
const NOM_REFUS = "9I7D-CAP — Compte pour le refus nommé";
const COURRIEL_REFUS = "refus@9i7dcap.e2e.test";

let idDirection = "";
let idAdv = "";
let idRefus = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function supprimerIdentite(id: string): Promise<void> {
  if (id === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      id,
    );
    await client.utilisateurSociete.deleteMany({ where: { utilisateur_id: id } });
    await client.utilisateur.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test.afterAll(async () => {
  await supprimerIdentite(idDirection);
  await supprimerIdentite(idAdv);
  await supprimerIdentite(idRefus);
});

async function capturerAuxDeuxLargeurs(page: Page, nom: string): Promise<void> {
  for (const largeur of [1280, 375] as const) {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (DOSSIER === "") continue;
    mkdirSync(DOSSIER, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("prépare les deux comptes de bureau (direction protégé, ADV témoin)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  const creationDirection = await page.request.post(
    "/api/equipe/bureau/creer",
    {
      form: { nom: NOM_DIRECTION, courriel: COURRIEL_DIRECTION, role: Role.direction },
      maxRedirects: 0,
    },
  );
  expect(creationDirection.status()).toBe(303);
  const creationAdv = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_ADV, courriel: COURRIEL_ADV, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creationAdv.status()).toBe(303);
  const creationRefus = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_REFUS, courriel: COURRIEL_REFUS, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creationRefus.status()).toBe(303);

  const client = admin();
  try {
    idDirection = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_DIRECTION },
        select: { id: true },
      })
    ).id;
    idAdv = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_ADV },
        select: { id: true },
      })
    ).id;
    idRefus = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_REFUS },
        select: { id: true },
      })
    ).id;
  } finally {
    await client.$disconnect();
  }

  // ACTIVATION DIRECTE DES COMPTES (hors sujet de ce fichier) — pour que
  // l'écran affiche le menu « … » plutôt que le bouton « Envoyer ». Le
  // compte « refus » garde volontairement SON mot de passe à `null` ici :
  // c'est l'objet même du test 4 (la course de D65).
  await page.request.post(`/api/equipe/bureau/${idDirection}/copier-lien`);
  await page.request.post(`/api/equipe/bureau/${idAdv}/copier-lien`);
  await page.request.post(`/api/equipe/bureau/${idRefus}/copier-lien`);
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idDirection,
    );
  } finally {
    await clientActivation.$disconnect();
  }
});

test("captures — la ligne d'un compte de direction, sans « Copier un nouveau lien » (D223)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligne = page.getByRole("row", { name: new RegExp(NOM_DIRECTION) });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: new RegExp(fr["equipe.menu.nouveau_lien"]),
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", {
      name: new RegExp(fr["equipe.acces.copier_lien"]),
    }),
  ).toHaveCount(0);
  await capturerAuxDeuxLargeurs(page, "equipe-bureau-direction-sans-copier");
});

test("captures — la ligne d'un compte ADV, avec « Copier un nouveau lien » (témoin)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // L'ADV N'EST PAS ENCORE ACTIF (son mot de passe n'a pas été posé) : la
  // capture témoin exige le menu « … », donc l'activer ici — hors sujet de
  // ce test, au même titre que la préparation ci-dessus.
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idAdv,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  await page.goto("/parametres/equipe?onglet=bureau");
  const ligne = page.getByRole("row", { name: new RegExp(NOM_ADV) });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: new RegExp(fr["equipe.acces.copier_lien"]),
    }),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-bureau-adv-avec-copier");
});

test("capture — le motif NOMMÉ d'un refus, affiché par le bouton « Copier » (B5)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/parametres/equipe?onglet=bureau");

  // LA LIGNE EST ENCORE DANS SON ÉTAT « LIEN ENVOYÉ » (le bouton « Copier le
  // lien d'accès » du PREMIER envoi) : l'instant d'après, le compte choisit
  // son mot de passe AILLEURS (un autre appareil, une autre session) —
  // exactement la course que le cliquet de D65 referme, et que B5 doit
  // désormais NOMMER plutôt que montrer « Le lien n'a pas pu être copié. ».
  const ligne = page.getByRole("row", { name: new RegExp(NOM_REFUS) });
  await expect(ligne).toBeVisible();
  const boutonCopier = ligne.getByRole("button", {
    name: fr["equipe.acces.copier_lien"],
    exact: true,
  });
  await expect(boutonCopier).toBeVisible();

  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idRefus,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  await boutonCopier.click();
  await expect(
    ligne.getByText(fr["equipe.bureau.acces.refus.deja_un_mot_de_passe"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-bouton-copier-refus-nomme");
});

test("capture — la saisie des mentions légales, après un refus (texte trop long)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // POSTÉ DIRECTEMENT (requête forgée) — `maxLength` (point 3, 9I7D) empêche
  // désormais la ZONE DE TEXTE elle-même de dépasser 1 000 caractères :
  // cette capture montre le bandeau de refus APRÈS un aller-retour serveur
  // réel, pas la saisie bloquée côté client.
  const refus = await page.request.post(
    "/api/parametres/societe/mentions-legales",
    {
      form: { mentions_legales: "a".repeat(1001) },
      maxRedirects: 0,
    },
  );
  expect(refus.status()).toBe(303);
  const suite = refus.headers()["location"] ?? "/parametres";
  await page.goto(suite);
  await expect(page).toHaveURL(/motif=mentions_legales\.refus\.taille/);
  await expect(
    page.getByText(fr["mentions_legales.refus.taille"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "parametres-mentions-legales-refus");
});
