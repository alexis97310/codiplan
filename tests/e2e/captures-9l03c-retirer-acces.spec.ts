import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L03C-RETIRER-ACCES-DESACTIVER (point 4) — LES CAPTURES, ET L'ÉPREUVE DE
 * BOUT EN BOUT que la session se ferme vraiment.
 *
 * Modèle : `tests/e2e/captures-9ia-reinitialiser-second-facteur.spec.ts` et
 * `tests/e2e/9ia-reinitialiser-second-facteur.spec.ts` — sa propre identité
 * jetable, enrôlée pour de vrai, jamais la scène partagée.
 *
 * **L'ONGLET BUREAU joue le geste JUSQU'AU BOUT** (identité jetable,
 * `9l03c-bureau@codima.test`) : avant/confirmation/après, puis la preuve que
 * la session déjà ouverte du sujet est refusée à la requête suivante.
 *
 * **L'ONGLET TECHNICIEN s'arrête à la confirmation** : `COMPTE_TECHNICIEN_
 * EPREUVE` est un compte de la SCÈNE PARTAGÉE (`garnier@codima.test`), lu par
 * d'autres specs — son accès n'est jamais réellement retiré ici, le bouton
 * « Annuler » referme le dialogue avant toute soumission.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L03C ?? "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

/**
 * UN SUJET PAR LARGEUR — le geste retire VRAIMENT l'accès (point d'ensemble
 * de ce test) : réutiliser le même sujet aux deux largeurs ferait échouer
 * le second enrôlement, l'accès du premier passage ayant déjà été retiré.
 */
const sujetsCrees: string[] = [];

async function creerSujetBureau(
  suffixe: string,
): Promise<{ email: string; utilisateurId: string; nom: string }> {
  const email = `9l03c-bureau-${suffixe}@codima.test`;
  // NOM DISTINCT PAR SUFFIXE : les deux largeurs tournent en série, et la
  // ligne du premier sujet reste affichée (« Accès retiré ») quand le
  // second sujet apparaît — un nom partagé rendrait le filtre `hasText`
  // ambigu entre les deux lignes.
  const nom = `9L03C Bureau ${suffixe}`;
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: { email, password: MOT_DE_PASSE_EPREUVE, name: nom },
    });
    sujetsCrees.push(cree.user.id);
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          societeId,
          Role.adv,
        ),
    );
    return { email, utilisateurId: cree.user.id, nom };
  } finally {
    await applicatif.$disconnect();
  }
}

test.afterAll(async () => {
  if (sujetsCrees.length === 0) return;
  const client = admin();
  try {
    await client.session.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: sujetsCrees } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test(`bureau — retire l'accès jusqu'au bout, et la session du sujet se ferme, à ${largeur}px`, async ({
      page,
      browser,
    }) => {
      const sujet = await creerSujetBureau(String(largeur));

      // L'ENROLEMENT DU SUJET, DANS SA PROPRE PAGE, GARDÉE OUVERTE : c'est
      // CETTE page qui prouve, après le geste, que la session ne tient plus.
      const pageSujet = await browser.newPage();
      await ouvrirLaSessionSensible(pageSujet, sujet.email);

      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe?onglet=bureau");

      const ligne = page.getByRole("row").filter({ hasText: sujet.nom });
      await expect(ligne).toBeVisible();
      const bouton = ligne.getByRole("button", {
        name: fr["equipe.retirer_acces"],
      });
      await expect(bouton).toBeVisible();
      await capturer(page, "equipe-bureau-retirer-acces-avant", largeur);

      await bouton.click();
      await expect(
        ligne.getByText(fr["equipe.retirer_acces.confirmation"]),
      ).toBeVisible();
      await capturer(page, "equipe-bureau-retirer-acces-confirmation", largeur);

      await ligne
        .getByRole("button", { name: fr["equipe.retirer_acces.confirmer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/motif=equipe\.retrait_acces\.reussi/);
      await expect(
        page
          .getByRole("row")
          .filter({ hasText: sujet.nom })
          .getByText(fr["equipe.acces_retire"]),
      ).toBeVisible();
      await capturer(page, "equipe-bureau-retirer-acces-apres", largeur);

      // ── LA SESSION DU SUJET, DÉJÀ OUVERTE, NE TIENT PLUS ────────────────
      await pageSujet.reload();
      await expect(pageSujet).toHaveURL(/\/connexion$/);
      await pageSujet.close();
    });

    test(`technicien — le bouton se propose, la confirmation s'affiche, ANNULÉE sans rien soumettre, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe");

      // `tr` (tableau, ≥ 901 px) OU `li` (carte, ≤ 900 px) — LES DEUX
      // existent dans le DOM aux deux largeurs (9G2, `coteLargeur`), seule
      // la visibilité CSS distingue ; `:visible` retient la bonne.
      const ligneTechnicien = page
        .locator("tr:visible, li:visible")
        .filter({ hasText: COMPTE_TECHNICIEN_EPREUVE.split("@")[0] ?? "" });
      await expect(ligneTechnicien.first()).toBeVisible();
      const bouton = ligneTechnicien
        .first()
        .getByRole("button", { name: fr["equipe.retirer_acces"] });
      await expect(bouton).toBeVisible();
      await capturer(page, "equipe-techniciens-retirer-acces-avant", largeur);

      await bouton.click();
      await expect(
        ligneTechnicien
          .first()
          .getByText(fr["equipe.retirer_acces.confirmation"]),
      ).toBeVisible();
      await capturer(
        page,
        "equipe-techniciens-retirer-acces-confirmation",
        largeur,
      );

      // ANNULÉ — jamais soumis : `COMPTE_TECHNICIEN_EPREUVE` est partagé.
      await ligneTechnicien
        .first()
        .getByRole("button", { name: fr["equipe.retirer_acces.revenir"] })
        .click();
    });
  });
}
