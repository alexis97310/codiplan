import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9DD-PG-G14C-TERRAIN-TRANSMISES (D141, 14C) — LE TERRAIN NE VOIT QUE LE
 * TRANSMIS, DE BOUT EN BOUT.
 *
 * ## Ce que les scénarios voisins ne peuvent pas prouver
 *
 * `tests/isolation/terrain-planifiees-masquees.test.ts` éprouve
 * `listerPlanning` par appel direct — l'option, pure. Il ne peut pas prouver
 * que la PAGE elle-même traduit une `PLANIFIEE` en « introuvable » plutôt que
 * de la laisser filtrer par un autre chemin, ni qu'un geste RÉEL
 * (« Transmettre ») fait réapparaître la même ligne sur le même écran. C'est
 * ce que ce fichier joue, à travers l'écran.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DD-`
 *
 * Un client et trois sites forgés en `beforeAll`, supprimés en `afterAll` —
 * aucune ligne au semis (I9). Le technicien, lui, est une identité DU SEMIS
 * (`garnier@codima.test`, Ducos) en LECTURE SEULE, comme les scénarios
 * voisins de la même famille (9CO, 9CP) : ce scénario ne touche à rien qui lui
 * appartenait déjà, il se contente de l'emprunter pour se connecter et pose
 * SES PROPRES lignes, datées d'AUJOURD'HUI dans le fuseau de la société.
 *
 * ## LES ASSERTIONS NE COMPTENT QUE CE QUI A ÉTÉ FORGÉ ICI
 *
 * Jamais un décompte total de cartes sur « Ma journée » — un semis ou une
 * autre scène peut très bien poser une intervention datée d'aujourd'hui pour
 * le même technicien. Chaque assertion cherche le LIBELLÉ DE SITE unique de
 * CETTE scène, jamais un nombre.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();
const SITE_PLANIFIEE_ID = uuidv7();
const SITE_AFFECTEE_ID = uuidv7();
const SITE_ANNULEE_ID = uuidv7();
const INTERVENTION_PLANIFIEE_ID = uuidv7();
const INTERVENTION_AFFECTEE_ID = uuidv7();
const INTERVENTION_ANNULEE_ID = uuidv7();

// LES LIBELLÉS VIENNENT DU DICTIONNAIRE (L0-11) — même une scène jetable,
// visible sur un écran réel pendant l'épreuve, n'écrit pas de texte en dur.
const SITE_LIBELLE_PLANIFIEE = fr["terrain9dd.e2e.site_planifiee"];
const SITE_LIBELLE_AFFECTEE = fr["terrain9dd.e2e.site_affectee"];
const SITE_LIBELLE_ANNULEE = fr["terrain9dd.e2e.site_annulee"];

let technicienId = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienId = reperes.technicienDucos;
  const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
  const cle = cleJour(aujourdHui);
  const datePlanifiee = new Date(`${cle}T00:00:00.000Z`);
  const creneauDebut = new Date(`${cle}T20:00:00.000Z`);
  const creneauFin = new Date(`${cle}T21:00:00.000Z`);

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
        raison_sociale: fr["terrain9dd.e2e.client"],
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_PLANIFIEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_PLANIFIEE,
        },
        {
          id: SITE_AFFECTEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_AFFECTEE,
        },
        {
          id: SITE_ANNULEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_ANNULEE,
        },
      ],
    });

    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      date_planifiee: datePlanifiee,
      creneau_debut: creneauDebut,
      creneau_fin: creneauFin,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9DD — intervention forgée par l'épreuve",
    };
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIEE_ID,
        site_id: SITE_PLANIFIEE_ID,
        statut: "planifiee",
        ...commun,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AFFECTEE_ID,
        site_id: SITE_AFFECTEE_ID,
        statut: "affectee",
        ...commun,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANNULEE_ID,
        site_id: SITE_ANNULEE_ID,
        statut: "annulee",
        ...commun,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [
            INTERVENTION_PLANIFIEE_ID,
            INTERVENTION_AFFECTEE_ID,
            INTERVENTION_ANNULEE_ID,
          ],
        },
      },
    });
    await client.site.deleteMany({
      where: {
        id: { in: [SITE_PLANIFIEE_ID, SITE_AFFECTEE_ID, SITE_ANNULEE_ID] },
      },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("Ma journée ne montre que le transmis — une Planifiée et une Annulée disparaissent, une Affectée reste", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);

  await expect(
    page.getByRole("heading", { name: fr["terrain.aujourdhui"] }),
  ).toBeVisible();
  await expect(page.getByText(SITE_LIBELLE_AFFECTEE)).toBeVisible();
  await expect(page.getByText(SITE_LIBELLE_PLANIFIEE)).toHaveCount(0);
  await expect(page.getByText(SITE_LIBELLE_ANNULEE)).toHaveCount(0);

  // ── LA FICHE D'UNE PLANIFIÉE EST « INTROUVABLE », COMME UNE FICHE HORS
  // PÉRIMÈTRE — jamais un refus qui la nomme (D35, D50).
  await page.goto(`/terrain/${INTERVENTION_PLANIFIEE_ID}`);
  await expect(
    page.getByRole("heading", { name: fr["etat.introuvable.titre"] }),
  ).toBeVisible();

  // ── LA FICHE D'UNE AFFECTÉE reste lisible : seule la journée filtre ───────
  // (le badge de statut est un FRÈRE du `h1` sur cette fiche, jamais dedans —
  // à la différence de la fiche du bureau — donc il se cherche sur la page,
  // pas à l'intérieur du titre.)
  await page.goto(`/terrain/${INTERVENTION_AFFECTEE_ID}`);
  await expect(page.getByText(fr["statut.affectee"])).toBeVisible();

  // ── LA FICHE D'UNE ANNULÉE reste lisible par lien direct (TR-20) : seule
  // « Ma journée » la masque, pas la fiche ───────────────────────────────────
  await page.goto(`/terrain/${INTERVENTION_ANNULEE_ID}`);
  await expect(page.getByText(fr["statut.annulee"])).toBeVisible();
});

test("après « Transmettre » (bureau), la même intervention apparaît sur le terrain", async ({
  page,
}) => {
  // ── LE GESTE, PAR L'ÉCRAN DU BUREAU (D141) ────────────────────────────────
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE_ID}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();
  const formTransmettre = page.locator("form#action-transmettre");
  await expect(formTransmettre).toBeVisible();
  await formTransmettre
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();

  // ── LE TERRAIN LA VOIT DÉSORMAIS ──────────────────────────────────────────
  await ouvrirLaSessionDuTerrain(page);
  await expect(page.getByText(SITE_LIBELLE_PLANIFIEE)).toBeVisible();
  await page.goto(`/terrain/${INTERVENTION_PLANIFIEE_ID}`);
  await expect(page.getByText(fr["statut.affectee"])).toBeVisible();
});
