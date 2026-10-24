import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * SOLDE 181 (9EW-SOLDE-DIALOGUES-FICHE) — CAPTURES MANQUANTES DE 9ES-TP-UX4-
 * 3-FICHE-GESTES-2 : LES DIALOGUES D'EN-TÊTE PAS ENCORE VUS À L'ÉCRAN.
 *
 * D195 a déplacé « Planifier à la main », « Transmettre », « Déplacer » et
 * « Changer de technicien… » de la carte Actions vers des dialogues d'en-tête
 * — le lot qui l'a écrit n'avait capturé que l'AVANT/APRÈS de la disparition
 * de la carte (`docs/propositions/9ES-TP-UX4-3-FICHE-GESTES-2/captures/`,
 * `apres-*`/`avant-*`), jamais chacun de ces dialogues OUVERT. Ce fichier les
 * capture, aux deux largeurs (375, 1280), dans le MÊME dossier.
 *
 * ## LE REFUS DE « CHANGER DE TECHNICIEN… »
 *
 * `DialogueChangerTechnicien` affiche un refus À LA PLACE du champ quand le
 * rôle n'a pas `qualifier_affecter` (`verdict`, `components/interventions/
 * dialogue-changer-technicien.tsx`) — ADMS, DIR, RM, RS et ADV l'ont tous,
 * donc aucun compte « normal » du semis de démonstration ne peut jamais
 * montrer ce refus. Seul `technicien` en est dépourvu, et la fiche
 * `/interventions/[id]` ne lui est pas fermée (aucune garde de rôle, à la
 * différence du registre `/interventions`, qui exige `consulter_planning`
 * COMPLET) : `garnier@codima.test` (`COMPTE_TECHNICIEN_EPREUVE`) ouvre donc
 * CETTE seule capture, en LECTURE SEULE — même identité, même disposition,
 * que `tests/e2e/9dg-tp-s1-lecture-technicien.spec.ts`.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9EW-`
 *
 * Un client, un site, trois interventions (`a_planifier`, `planifiee`,
 * `cloturee`) — créées en `beforeAll`, supprimées en `afterAll`, aucune ligne
 * ajoutée au semis. Le jour choisi, +224 depuis le lundi de la semaine
 * courante, est à l'écart de tous les décalages déjà pris par les fichiers
 * voisins (7, 14, 70, 71, 77, 84, 91, 92, 140, 147, 168, 210).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 224);
  const dateSurveyee = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EW-DIALOGUES-GESTES-2 — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EW-DIALOGUES-GESTES-2 — site forgé",
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_A_PLANIFIER,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        type: "curatif",
        statut: "a_planifier",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: dateSurveyee,
        creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 9 * 60, reperes.fuseau),
        duree_estimee_min: 60,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_CLOTUREE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "cloturee",
        date_planifiee: dateSurveyee,
        duree_estimee_min: 60,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9ES-TP-UX4-3-FICHE-GESTES-2/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [375, 1280] as const) {
  test(`« Planifier à la main » (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);

    await ouvrirSaisieManuelle(page);
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    await expect(
      dialogue.getByRole("heading", {
        name: fr["intervention.action.planifier_a_la_main"],
      }),
    ).toBeVisible();

    await capturer(page, "dialogue-planifier-a-la-main", largeur);
  });

  test(`« Transmettre » (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await page
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    await expect(
      dialogue.getByRole("button", {
        name: fr["intervention.action.transmettre"],
      }),
    ).toBeEnabled();

    await capturer(page, "dialogue-transmettre", largeur);
  });

  test(`« Déplacer » (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await ouvrirSaisieManuelle(page);
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    await expect(
      dialogue.getByRole("heading", {
        name: fr["intervention.action.deplacer"],
      }),
    ).toBeVisible();

    await capturer(page, "dialogue-deplacer", largeur);
  });

  test(`« Changer de technicien… » n'est plus atteignable par le technicien — D221 l'y redirige (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    // AVANT D221 (21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) : le
    // technicien ouvrait réellement cette fiche bureau, et cette épreuve
    // montrait précisément le refus de `DialogueChangerTechnicien` faute de
    // `qualifier_affecter` — l'unique rôle qui en soit dépourvu (voir
    // l'en-tête du fichier). D221 ferme désormais tout le segment au
    // technicien, sans exception pour cette fiche ; `INTERVENTION_PLANIFIEE`
    // lui est affectée (`technicien_id: reperes.technicienDucos`), donc le
    // renvoi vise sa fiche terrain, jamais `/terrain` nu.
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
    await expect(page).toHaveURL(`/terrain/${INTERVENTION_PLANIFIEE}`);
  });

  test(`le bandeau « figée » sur une CLÔTURÉE (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${INTERVENTION_CLOTUREE}`);

    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.cloturee"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.refus.cloturee_figee"]),
    ).toBeVisible();

    await capturer(page, "bandeau-figee", largeur);
  });
}
