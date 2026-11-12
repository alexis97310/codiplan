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
 * LES CAPTURES DE 9I8D1-REPRISE-9I8D (point 5) — même discipline que
 * `captures-9i7d-reserves-de-revue-acces-et-mentions.spec.ts`, son modèle :
 * rien n'est écrit sur disque sans `CAPTURES_9I8D1`, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * Trois scènes : la ligne d'un compte PARTAGÉ entre deux sociétés (sans
 * « Copier un nouveau lien », D226), d'un compte EXCLUSIF (avec, témoin), et
 * le motif NOMMÉ du refus affiché par `BoutonCopierLien` pour une requête
 * forgée contre le compte partagé.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I8D1 ?? "";

const NOM_PARTAGE = "9I8D1-CAP — Compte partagé entre deux sociétés";
const COURRIEL_PARTAGE = "partage@9i8d1cap.e2e.test";
const NOM_EXCLUSIF = "9I8D1-CAP — Compte exclusif témoin";
const COURRIEL_EXCLUSIF = "exclusif@9i8d1cap.e2e.test";
const NOM_COURSE = "9I8D1-CAP — Compte pour le refus nommé";
const COURRIEL_COURSE = "course@9i8d1cap.e2e.test";

let idPartage = "";
let idExclusif = "";
let idCourse = "";
let autreSocieteId = "";

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
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: id },
    });
    await client.utilisateur.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test.afterAll(async () => {
  await supprimerIdentite(idPartage);
  await supprimerIdentite(idExclusif);
  await supprimerIdentite(idCourse);
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

test("prépare les deux comptes de bureau (partagé entre deux sociétés, exclusif témoin)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  const creationPartage = await page.request.post("/api/equipe/bureau/creer", {
    form: {
      nom: NOM_PARTAGE,
      courriel: COURRIEL_PARTAGE,
      role: Role.adv,
    },
    maxRedirects: 0,
  });
  expect(creationPartage.status()).toBe(303);
  const creationExclusif = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_EXCLUSIF, courriel: COURRIEL_EXCLUSIF, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creationExclusif.status()).toBe(303);
  const creationCourse = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_COURSE, courriel: COURRIEL_COURSE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creationCourse.status()).toBe(303);

  const client = admin();
  try {
    idPartage = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_PARTAGE },
        select: { id: true },
      })
    ).id;
    idExclusif = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_EXCLUSIF },
        select: { id: true },
      })
    ).id;
    idCourse = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_COURSE },
        select: { id: true },
      })
    ).id;
    // L'AUTRE SOCIÉTÉ DU SEMIS (`pnpm db:seed`, CLAUDE.md §4) — jamais un
    // identifiant écrit en dur.
    autreSocieteId = (
      await client.societe.findFirstOrThrow({
        where: { code: { not: "CODIMA-NC" } },
        select: { id: true },
      })
    ).id;
  } finally {
    await client.$disconnect();
  }

  // ACTIVATION DIRECTE DES TROIS COMPTES (hors sujet de ce fichier) — pour
  // que l'écran affiche le menu « … » plutôt que le bouton « Envoyer ». Les
  // TROIS sont encore exclusifs à cet instant : depuis
  // 9L01-COPIE-LIEN-EXCLUSIVITE, le PREMIER lien lui-même refuse une identité
  // déjà partagée (D226 étendue), donc le rattachement d'`idPartage` ci-
  // dessous doit venir APRÈS cette activation, sans quoi aucun jeton n'est
  // jamais émis pour lui.
  await page.request.post(`/api/equipe/bureau/${idPartage}/copier-lien`);
  await page.request.post(`/api/equipe/bureau/${idExclusif}/copier-lien`);
  await page.request.post(`/api/equipe/bureau/${idCourse}/copier-lien`);
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idExclusif,
    );
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idCourse,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  // LE RATTACHEMENT D'`idPartage` À L'AUTRE SOCIÉTÉ, APRÈS COUP — ce qui le
  // rend NON exclusif ; un cas RÉEL (identité activée avant D247, ou
  // rattachée par un autre chemin). `idCourse` n'EN REÇOIT PAS ICI : la
  // course du test 3 l'ajoute APRÈS que l'écran a déjà rendu le bouton,
  // exactement comme 9I7D l'a fait pour « deja_un_mot_de_passe ».
  const clientRattachement = admin();
  try {
    await clientRattachement.utilisateurSociete.create({
      data: {
        id: crypto.randomUUID(),
        utilisateur_id: idPartage,
        societe_id: autreSocieteId,
        role: Role.adv,
      },
    });
  } finally {
    await clientRattachement.$disconnect();
  }
});

test("captures — la ligne d'un compte partagé entre deux sociétés, sans « Copier un nouveau lien » (D226)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligne = page.getByRole("row", { name: new RegExp(NOM_PARTAGE) });
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
  await capturerAuxDeuxLargeurs(page, "equipe-bureau-partage-sans-copier");
});

test("captures — la ligne d'un compte exclusif, avec « Copier un nouveau lien » (témoin)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligne = page.getByRole("row", { name: new RegExp(NOM_EXCLUSIF) });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: new RegExp(fr["equipe.acces.copier_lien"]),
    }),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-bureau-exclusif-avec-copier");
});

test("capture — le motif NOMMÉ « autre_societe », affiché par le bouton « Copier » (D226)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/parametres/equipe?onglet=bureau");

  // LE COMPTE EST ENCORE EXCLUSIF AU MOMENT OÙ L'ÉCRAN REND LE MENU : le
  // bouton « Copier un nouveau lien » est donc bien présent. LA COURSE —
  // même famille que celle de D65 pour « deja_un_mot_de_passe » (9I7D) —
  // ajoute le rattachement à l'AUTRE société entre le rendu et le clic : un
  // administrateur d'une autre société a entre-temps habilité cette même
  // identité.
  const ligne = page.getByRole("row", { name: new RegExp(NOM_COURSE) });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  const entreeCopier = page.getByRole("menuitem", {
    name: new RegExp(fr["equipe.acces.copier_lien"]),
  });
  await expect(entreeCopier).toBeVisible();
  await entreeCopier.click();
  // SCOPÉ AU DIALOGUE (un `<dialog>` natif, rôle implicite `dialog`) : le
  // même libellé « Copier le lien d'accès » existe aussi, HORS de ce
  // dialogue, pour toute ligne pas encore activée du semis (premier accès).
  const dialogue = page.getByRole("dialog", { name: new RegExp(NOM_COURSE) });
  const boutonCopier = dialogue.getByRole("button", {
    name: fr["equipe.acces.copier_lien"],
    exact: true,
  });
  await expect(boutonCopier).toBeVisible();

  const clientRace = admin();
  try {
    autreSocieteId ||= (
      await clientRace.societe.findFirstOrThrow({
        where: { code: { not: "CODIMA-NC" } },
        select: { id: true },
      })
    ).id;
    await clientRace.utilisateurSociete.create({
      data: {
        id: crypto.randomUUID(),
        utilisateur_id: idCourse,
        societe_id: autreSocieteId,
        role: Role.adv,
      },
    });
  } finally {
    await clientRace.$disconnect();
  }

  await boutonCopier.click();
  await expect(
    dialogue.getByText(fr["equipe.bureau.acces.refus.autre_societe"]),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(
    page,
    "equipe-bouton-copier-refus-autre-societe",
  );
});
