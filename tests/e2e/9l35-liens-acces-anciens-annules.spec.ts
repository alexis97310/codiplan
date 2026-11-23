import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L35-LIENS-ACCES-ANCIENS-ANNULES (D281) — LE PARCOURS PREMIER ACCÈS AVEC
 * DEUX LIENS, DE BOUT EN BOUT : « Envoyer le lien d'accès » puis « Envoyer un
 * nouveau lien d'accès » (D86) pour le MÊME technicien laissent un SEUL lien
 * exploitable — le second.
 *
 * Modèle : `tests/e2e/acces-technicien.spec.ts` (le courriel est doublé au
 * niveau du serveur, et c'est le seul moyen de lire, depuis le processus
 * Playwright, le lien que le processus serveur a composé). Ici, deux
 * courriels successifs sont interceptés pour le MÊME technicien ; les routes
 * d'Équipe sont appelées directement par requête authentifiée plutôt que par
 * le menu « … » (dialogue de confirmation compris) — ni l'un ni l'autre
 * n'écrit un jeton, l'un et l'autre lisent la MÊME session de navigateur.
 */
test.describe.configure({ mode: "serial" });

const NOM_TECHNICIEN = "9L35 Technicien";
const COURRIEL_TECHNICIEN = "technicien@9l35.e2e.test";
const MOT_DE_PASSE_CHOISI = "mot-de-passe-9l35-epreuve";

let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    const identite = await client.utilisateur.create({
      data: {
        id: uuidv7(),
        nom: NOM_TECHNICIEN,
        email: COURRIEL_TECHNICIEN,
      },
      select: { id: true },
    });
    utilisateurId = identite.id;
    await client.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        utilisateur_id: utilisateurId,
        agence_id: agence.id,
        actif: true,
        statut_ressource: "salarie",
      },
    });

    if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
      writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "verification" WHERE valeur = $1`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.technicien.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
});

type CorpsIntercepte = {
  readonly to: readonly string[];
  readonly text: string;
};

function courrielsCaptures(): CorpsIntercepte[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as CorpsIntercepte);
}

function jetonDeLUrl(url: string): string {
  return new URL(url).pathname.split("/").pop() ?? "";
}

test("deux liens successifs pour le même technicien : le premier est refusé, le second ouvre réellement le compte", async ({
  page,
  browser,
}) => {
  // ── 1. L'ADMINISTRATEUR, AUTHENTIFIÉ, ENVOIE LE PREMIER LIEN ─────────────
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  const envoi1 = await page.request.post(
    `/api/equipe/${utilisateurId}/envoyer-acces`,
  );
  expect(envoi1.ok()).toBe(true);

  const courriel1 = courrielsCaptures().find((c) =>
    c.to.includes(COURRIEL_TECHNICIEN),
  );
  expect(courriel1).toBeDefined();
  const url1 = /https?:\/\/\S+/.exec(courriel1?.text ?? "")?.[0];
  expect(url1).toBeDefined();
  const jeton1 = jetonDeLUrl(url1 ?? "");

  // ── 2. « ENVOYER UN NOUVEAU LIEN » (D86) — DOIT INVALIDER LE PREMIER ─────
  const envoi2 = await page.request.post(
    `/api/equipe/${utilisateurId}/nouveau-lien`,
  );
  expect(envoi2.ok()).toBe(true);

  const courriel2 = courrielsCaptures()
    .filter((c) => c.to.includes(COURRIEL_TECHNICIEN))
    .at(-1);
  expect(courriel2).toBeDefined();
  const url2 = /https?:\/\/\S+/.exec(courriel2?.text ?? "")?.[0];
  expect(url2).toBeDefined();
  const jeton2 = jetonDeLUrl(url2 ?? "");
  expect(jeton2).not.toBe(jeton1);

  // ── 3. LE LIEN 1, PRÉSENTÉ SUR SA PROPRE PAGE, EST REFUSÉ ────────────────
  const pageAncien = await browser.newPage();
  await pageAncien.goto(`/premier-acces?token=${jeton1}`);
  await pageAncien
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageAncien
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageAncien
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageAncien.waitForLoadState("networkidle");
  await expect(
    pageAncien.getByText(fr["premier_acces.lien_invalide.titre"]),
  ).toBeVisible();
  await pageAncien.close();

  // ── 4. LE LIEN 2, LUI, ABOUTIT VRAIMENT ──────────────────────────────────
  const pageNouveau = await browser.newPage();
  await pageNouveau.goto(`/premier-acces?token=${jeton2}`);
  await pageNouveau
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageNouveau
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageNouveau
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageNouveau.waitForLoadState("networkidle");
  await expect(pageNouveau).toHaveURL(/\/connexion/);
  await expect(pageNouveau.getByText(fr["premier_acces.abouti"])).toBeVisible();

  await pageNouveau.getByLabel(fr["connexion.email"]).fill(COURRIEL_TECHNICIEN);
  await pageNouveau
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageNouveau
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageNouveau).not.toHaveURL(/\/connexion/);
  await pageNouveau.close();
});
