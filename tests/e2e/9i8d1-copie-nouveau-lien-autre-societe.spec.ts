import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D226 (01/11/2026, 9I8D1-REPRISE-9I8D) — COPIER UN NOUVEAU LIEN D'ACCÈS
 * REFUSE POUR UNE IDENTITÉ AUSSI RATTACHÉE À UNE AUTRE SOCIÉTÉ, DE BOUT EN
 * BOUT.
 *
 * ## Ce que ce fichier mesure, et que l'isolation ne peut pas mesurer
 *
 * `tests/isolation/acces-bureau.test.ts` et
 * `tests/isolation/identite-exclusive-a-la-societe.test.ts` prouvent déjà, au
 * niveau fonction et au niveau de `app_identite_exclusive_a_la_societe` elle-
 * même, que la copie refuse nommément (`autre_societe`) une identité partagée.
 * Ce fichier prouve que la ROUTE rend le même refus à une requête POST réelle
 * (même doctrine que `tests/e2e/9i7d-copie-nouveau-lien-cible-protegee.spec.ts`,
 * son modèle), et que l'ÉCRAN retire l'entrée « Copier le lien d'accès » du
 * menu « … » pour ce compte.
 */
test.describe.configure({ mode: "serial" });

const NOM_PARTAGE = "9I8D1 — Compte partagé entre deux sociétés";
const COURRIEL_PARTAGE = "partage@9i8d1.e2e.test";

let idPartage = "";
let autreSocieteId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (idPartage === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: idPartage },
    });
    await client.utilisateur.deleteMany({ where: { id: idPartage } });
  } finally {
    await client.$disconnect();
  }
});

test("la copie d'un NOUVEAU lien refuse pour une identité partagée entre deux sociétés — le bouton disparaît", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // ── CRÉATION DU COMPTE, PAR REQUÊTE DIRECTE ──────────────────────────────
  const creation = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_PARTAGE, courriel: COURRIEL_PARTAGE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creation.status()).toBe(303);

  const client = admin();
  try {
    idPartage = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_PARTAGE },
        select: { id: true },
      })
    ).id;
    // L'AUTRE SOCIÉTÉ DU SEMIS (`pnpm db:seed` en pose toujours deux,
    // CLAUDE.md §4) — jamais un identifiant écrit en dur, qui diverger ait
    // en silence du semis réel.
    autreSocieteId = (
      await client.societe.findFirstOrThrow({
        where: { code: { not: "CODIMA-NC" } },
        select: { id: true },
      })
    ).id;
  } finally {
    await client.$disconnect();
  }

  // ── ACTIVATION DIRECTE DU COMPTE, TANT QU'IL EST ENCORE EXCLUSIF (scène
  //    accélérée, hors sujet de ce fichier) — nécessaire pour que l'écran
  //    affiche le menu « … ». Depuis 9L01-COPIE-LIEN-EXCLUSIVITE, le PREMIER
  //    lien lui-même refuse une identité déjà partagée (D226 étendue) :
  //    l'activation doit donc précéder le rattachement ci-dessous, sans quoi
  //    aucun jeton n'est jamais émis. ─────────────────────────────────────
  const premierLien = await page.request.post(
    `/api/equipe/bureau/${idPartage}/copier-lien`,
  );
  expect(premierLien.status()).toBe(200);
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test' WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  // ── LE RATTACHEMENT À L'AUTRE SOCIÉTÉ, APRÈS COUP — un cas RÉEL : une
  //    identité activée avant D247, ou rattachée par un autre chemin, peut
  //    devenir partagée alors qu'elle était déjà exclusive. ────────────────
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

  // ── 1. LA COPIE D'UN NOUVEAU LIEN REFUSE, NOMMÉMENT (REQUÊTE FORGÉE) ─────
  const nouveauLien = await page.request.post(
    `/api/equipe/bureau/${idPartage}/copier-nouveau-lien`,
  );
  expect(nouveauLien.status()).toBe(200);
  expect(await nouveauLien.json()).toEqual({ erreur: "autre_societe" });

  // ── 2. L'ÉCRAN : LE BOUTON « COPIER » DISPARAÎT, « NOUVEAU LIEN » RESTE ──
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligne = page.getByRole("row", { name: new RegExp(NOM_PARTAGE) });
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
});
