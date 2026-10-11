import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { instantDuJour, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99F-CIBLES-375 (audit d'ergonomie du 25/09/2026, constat 40) — SUR TÉLÉPHONE,
 * LES LIENS D'ACTION TEXTUELS DU PLANNING SE TOUCHENT DU DOIGT.
 *
 * ## Ce qui a été mesuré, AVANT correction, sur la main de ce ticket
 *
 * - le lien vers les blocages d'agenda (`absences.titre`) : **14 px de haut**,
 *   à 375 comme à 1280 — aucune règle ne dépendait du gabarit ;
 * - le lien « Voir les interventions sans durée → »
 *   (`statistiques.charge_incomplete_lien`) : **16 px de haut** à 375.
 *
 * La cible recommandée (WCAG 2.5.5, niveau AAA, retenue ici comme repère
 * d'ergonomie tactile) est de 44 px. Les DEUX liens étaient désormais portés
 * à `min-h-11` (44 px) sous `sm`, et RIEN ne changeait à partir de `sm`.
 *
 * **LE LIEN VERS LES BLOCAGES D'AGENDA N'EXISTE PLUS** (9EH-TP-UX-PL-
 * PLANNING-1, D190) — RETIRÉ de `main` avec le reste du lien isolé
 * « Absences » au-dessus de la grille (R3-14 reste vrai autrement : la barre
 * de navigation porte déjà `nav.absences`, et le bandeau porte désormais une
 * puce-lien quand une absence tombe sur la période affichée). L'épreuve qui
 * mesurait sa hauteur à 1280 px est retirée avec lui ; seul le lien
 * « Voir les interventions sans durée → » reste mesuré ci-dessous.
 *
 * ## Ce qui N'EST PAS traité ici, et pourquoi
 *
 * L'audit ne cite que ces deux liens. Trois autres familles d'éléments
 * cliquables existent sur `/planning` sous `sm`, et aucune n'entre dans ce
 * lot :
 * - les onglets Semaine/Jour et les boutons de déplacement (`Deplacement`,
 *   `Onglets`) portent déjà un fond et un `px-3 py-2` — mesurés à 34 et 36 px
 *   de haut, sous la cible mais bien au-dessus des 14/16 px des deux liens
 *   traités, et ce sont des BOUTONS d'apparence, pas des liens de texte nu ;
 *   `tests/e2e/planning-6.spec.ts` fige déjà leur rendu par leur rôle et leur
 *   nom accessible, un territoire que ce ticket ne rouvre pas ;
 * - les références d'intervention des listes « jour sans heure » et « hors
 *   grille » (`SansHeureVide`, `HorsGrille`) sont la carte elle-même, au même
 *   titre que les blocs de la grille que l'audit dit bien adaptés — ce ne
 *   sont pas des liens d'ACTION greffés sur un contenu, elles SONT le
 *   contenu, exactement comme `data-carte-liste` le documente déjà dans
 *   `page.tsx`.
 *
 * ## Scène forgée, préfixée par un UUID, jamais le semis (piège connu du lot)
 *
 * Même construction que `tests/e2e/planning-3.spec.ts` : un technicien et une
 * intervention `en_cours` sans durée, à un jour SANS collision avec les
 * décalages déjà pris par d'autres fichiers e2e (21/35/49/63/91/92) — celui-ci
 * prend 105, cinq multiples de 7 plus loin que le plus grand déjà réservé.
 * Identifiants tirés au hasard (`randomUUID`), scène créée et supprimée par ce
 * seul fichier.
 */

// SÉRIE, comme `planning-3.spec.ts` : sous `fullyParallel`, `beforeAll`
// s'exécute UNE FOIS PAR OUVRIER, et deux ouvriers créant le même
// `EMAIL_TECHNICIEN` (contrainte unique) au même instant se heurtent.
test.describe.configure({ mode: "serial" });

const JOUR_SANS_COLLISION = () =>
  jourSuivant(jourDeLaScene(reperesGlobal, MARDI), 105);

let reperesGlobal: Awaited<ReturnType<typeof reperesDeLaScene>>;

const UTILISATEUR_ID = randomUUID();
const UTILISATEUR_SOCIETE_ID = randomUUID();
const TECHNICIEN_ID = randomUUID();
const INTERVENTION_ID = randomUUID();
const EMAIL_TECHNICIEN = "cibles375@codima.test";
// Réutilise la clé de témoin déjà ouverte par `planning-3.spec.ts` — une
// chaîne écrite ici à la main serait une chaîne visible hors dictionnaire
// (L0-11), même pour une scène qu'aucun utilisateur réel ne voit jamais.
const NOM_TECHNICIEN = fr["planning.e2e.nom_technicien"];

test.beforeAll(async () => {
  reperesGlobal = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperesGlobal.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperesGlobal.societeId,
        agence_id: ducos.id,
        client: { actif: true },
        // Le site SEMÉ de Ducos, par son libellé (9ER) — jamais le premier
        // par ordre alphabétique de tout l'écran (prisma/seed-data.ts:704).
        libelle: "Atelier principal",
      },
      select: { id: true, client_id: true },
    });

    await client.utilisateur.create({
      data: {
        id: UTILISATEUR_ID,
        nom: NOM_TECHNICIEN,
        email: EMAIL_TECHNICIEN,
        email_verifie: true,
        actif: true,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: UTILISATEUR_SOCIETE_ID,
        utilisateur_id: UTILISATEUR_ID,
        societe_id: reperesGlobal.societeId,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: TECHNICIEN_ID,
        societe_id: reperesGlobal.societeId,
        utilisateur_id: UTILISATEUR_ID,
        agence_id: ducos.id,
        actif: true,
      },
    });

    // `en_cours`, jamais `planifiee`/`affectee` : ces deux statuts exigent une
    // durée prévue (`intervention_planifiee_a_sa_duree`, PARCOURS-1), et
    // c'est justement l'absence de durée qui déclenche le lien éprouvé ici.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperesGlobal.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: UTILISATEUR_ID,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: instantDuJour(JOUR_SANS_COLLISION()),
        duree_estimee_min: null,
        temps_valide_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.technicien.deleteMany({ where: { id: TECHNICIEN_ID } });
    await client.utilisateurSociete.deleteMany({
      where: { id: UTILISATEUR_SOCIETE_ID },
    });
    await client.utilisateur.deleteMany({ where: { id: UTILISATEUR_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 375 px, les deux liens d'action tiennent une zone cliquable d'au moins 44 px de haut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(JOUR_SANS_COLLISION())}`,
  );
  const main = page.locator("main");
  await expect(main).toBeVisible();

  const ligne = page
    .locator("li", { has: page.getByText(NOM_TECHNICIEN, { exact: true }) })
    .first();
  await expect(ligne).toBeVisible();
  const lienCharge = ligne.getByRole("link", {
    name: fr["statistiques.charge_incomplete_lien"],
  });
  await expect(lienCharge).toBeVisible();
  const boiteCharge = await lienCharge.boundingBox();
  expect(boiteCharge).not.toBeNull();
  expect(boiteCharge!.height).toBeGreaterThanOrEqual(44);

  await capturer(page, "cibles-tactiles-375");
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99F-CIBLES-375/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

// L'ÉPREUVE « À 1280 PX, LE LIEN DES BLOCAGES D'AGENDA GARDE SA HAUTEUR
// D'AVANT » EST RETIRÉE (9EH-TP-UX-PL-PLANNING-1, D190) — son seul sujet,
// le lien isolé « Absences » au-dessus de la grille, est RETIRÉ de `main`
// par ce lot (R3-14 reste vrai : la barre de navigation porte déjà
// `nav.absences`) ; il n'y a donc plus rien à mesurer ici.
