import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * DÉCISION B d'Alexis (30/10/2026, D223, 9I7D-RESERVES-DE-REVUE-ACCES-ET-
 * MENTIONS) — COPIER UN NOUVEAU LIEN D'ACCÈS REFUSE POUR UN COMPTE DE
 * DIRECTION OU UN AUTRE ADMINISTRATEUR DE SOCIÉTÉ, DE BOUT EN BOUT.
 *
 * ## Ce que ce fichier mesure, et que l'isolation ne peut pas mesurer
 *
 * `tests/isolation/acces-bureau.test.ts` prouve déjà, au niveau fonction,
 * que `copierNouveauLienDAccesBureau` refuse nommément (`cible_protegee`)
 * pour `direction`/`admin_societe`, sans trace ni jeton, et que le PREMIER
 * lien reste permis. Ce fichier prouve que la ROUTE elle-même rend le même
 * refus à une requête POST réelle (requête forgée, même doctrine que
 * `tests/e2e/9i6b-lien-acces-a-copier.spec.ts`), et que l'ÉCRAN retire
 * l'entrée « Copier le lien d'accès » du menu « … » pour ces comptes,
 * tandis qu'un compte ADV (témoin, non protégé) la garde.
 */
test.describe.configure({ mode: "serial" });

const NOM_DIRECTION = "9I7D — Compte de direction protégé";
const COURRIEL_DIRECTION = "direction@9i7d.e2e.test";
const NOM_ADV = "9I7D — Compte ADV témoin";
const COURRIEL_ADV = "adv@9i7d.e2e.test";

let idDirection = "";
let idAdv = "";

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
  await supprimerIdentite(idDirection);
  await supprimerIdentite(idAdv);
});

test("la copie d'un NOUVEAU lien refuse pour direction/admin_societe — le premier lien et ADV restent permis, le bouton disparaît", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // ── CRÉATION DES DEUX COMPTES, PAR REQUÊTE DIRECTE ───────────────────────
  const creationDirection = await page.request.post(
    "/api/equipe/bureau/creer",
    {
      form: {
        nom: NOM_DIRECTION,
        courriel: COURRIEL_DIRECTION,
        role: Role.direction,
      },
      maxRedirects: 0,
    },
  );
  expect(creationDirection.status()).toBe(303);
  const creationAdv = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_ADV, courriel: COURRIEL_ADV, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creationAdv.status()).toBe(303);

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
  } finally {
    await client.$disconnect();
  }

  // ── 1. LE PREMIER LIEN RESTE PERMIS POUR LA DIRECTION ────────────────────
  const premierLienDirection = await page.request.post(
    `/api/equipe/bureau/${idDirection}/copier-lien`,
  );
  expect(premierLienDirection.status()).toBe(200);
  const corpsPremierDirection: { readonly url?: unknown } =
    await premierLienDirection.json();
  expect(typeof corpsPremierDirection.url).toBe("string");
  expect((corpsPremierDirection.url as string).length).toBeGreaterThan(0);

  const premierLienAdv = await page.request.post(
    `/api/equipe/bureau/${idAdv}/copier-lien`,
  );
  expect(premierLienAdv.status()).toBe(200);

  // ── ACTIVATION DIRECTE DES DEUX COMPTES (scène accélérée, hors sujet de
  //    ce fichier — voir `tests/e2e/acces-bureau.spec.ts` pour le vrai
  //    parcours « premier accès ») — nécessaire pour que l'écran affiche le
  //    menu « … » plutôt que le bouton « Envoyer ». ─────────────────────────
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idDirection,
    );
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idAdv,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  // ── 2. LA COPIE D'UN NOUVEAU LIEN REFUSE, NOMMÉMENT, POUR LA DIRECTION ───
  const nouveauLienDirection = await page.request.post(
    `/api/equipe/bureau/${idDirection}/copier-nouveau-lien`,
  );
  expect(nouveauLienDirection.status()).toBe(200);
  expect(await nouveauLienDirection.json()).toEqual({
    erreur: "cible_protegee",
  });

  // ── 3. … ET RESTE PERMISE POUR L'ADV, TÉMOIN NON PROTÉGÉ ─────────────────
  const nouveauLienAdv = await page.request.post(
    `/api/equipe/bureau/${idAdv}/copier-nouveau-lien`,
  );
  expect(nouveauLienAdv.status()).toBe(200);
  const corpsNouveauAdv: { readonly url?: unknown } =
    await nouveauLienAdv.json();
  expect(typeof corpsNouveauAdv.url).toBe("string");

  // ── 4. L'ÉCRAN : LE BOUTON DISPARAÎT POUR LA DIRECTION, RESTE POUR L'ADV ─
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligneDirection = page.getByRole("row", {
    name: new RegExp(NOM_DIRECTION),
  });
  await ligneDirection
    .getByRole("button", { name: fr["ui.menu_plus.titre"] })
    .click();
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
  await page.keyboard.press("Escape");

  const ligneAdv = page.getByRole("row", { name: new RegExp(NOM_ADV) });
  await ligneAdv
    .getByRole("button", { name: fr["ui.menu_plus.titre"] })
    .click();
  await expect(
    page.getByRole("menuitem", {
      name: new RegExp(fr["equipe.acces.copier_lien"]),
    }),
  ).toBeVisible();
});
