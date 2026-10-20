import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LE TÉLÉPHONE CALE CE QU'IL ENVOIE SUR L'HEURE DU SERVEUR (9F4H5A-HEURE-
 * CALEE-SERVEUR, point 1 ; décision n° 132 d'Alexis, 20/10/2026, D214).
 *
 * ## CE QUE CE SCÉNARIO ÉPROUVE
 *
 * `9F4H4D-ARRETER-BORNE` a bordé « Arrêter »/« Mettre en pause » même EN
 * LIGNE (`verifierInstantAppareil`, D115-1) : un `instant_appareil` de plus
 * de 5 minutes dans le futur est REFUSÉ, jamais rabattu sur l'heure du
 * serveur — parce que ce geste n'a aucune colonne d'identité, et que son
 * rejeu se reconnaît par l'instant exact. Mesuré SANS ce lot (sur
 * `0956b292`), une horloge d'appareil avancée de 10 minutes fait donc
 * échouer « Mettre en pause » EN LIGNE avec `compteur.refus.instant_futur`.
 *
 * `page.clock.setFixedTime` avance l'horloge VISIBLE PAR LE NAVIGATEUR
 * seulement — le serveur Next.js, lui, reste sur l'heure RÉELLE du
 * processus : exactement la situation que corrige ce lot (un écart entre
 * les deux horloges, mesuré côté client contre l'heure que le serveur a
 * rendue). Le clic envoie alors un `instant_appareil` calé sur le serveur,
 * et le geste est ACCEPTÉ, le segment fermé près de l'heure RÉELLE —
 * jamais à +10 minutes.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H5A-` — même discipline que 9F4H4D
 *
 * Un client, un site, une intervention « en_cours » déjà démarrée (un
 * segment ouvert existant pour ce technicien, posé directement en base,
 * sans passer par l'écran) — supprimés en `afterAll`, aucune ligne ajoutée
 * au semis partagé.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H5A = uuidv7();
const SITE_9F4H5A = uuidv7();
const INTERVENTION_9F4H5A = uuidv7();
const SEGMENT_9F4H5A = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9F4H5A,
        societe_id: societeId,
        raison_sociale: "9F4H5A client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H5A,
        societe_id: societeId,
        client_id: CLIENT_9F4H5A,
        agence_id: agence.id,
        libelle: "9F4H5A site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H5A,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H5A,
        site_id: SITE_9F4H5A,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H5A — intervention forgée par l'épreuve",
        statut: "en_cours",
        date_planifiee: null,
      },
    });
    // UN SEGMENT DÉJÀ OUVERT — « ici » vaut vrai dès l'ouverture de la
    // fiche, le bouton propose directement « Mettre en pause ».
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_9F4H5A,
        societe_id: societeId,
        intervention_id: INTERVENTION_9F4H5A,
        utilisateur_id: technicienId,
        debut: new Date(Date.now() - 15 * 60_000),
        fin: null,
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
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H5A,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9F4H5A },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H5A } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H5A } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("horloge du navigateur avancée de 10 min : « Mettre en pause » EN LIGNE est accepté, le segment ferme près de l'heure RÉELLE", async ({
  page,
}) => {
  const avantClic = Date.now();

  // ── 1. CONNEXION, HORLOGE ENCORE RÉELLE ──────────────────────────────
  await connecterLeTechnicien(page);

  // ── 2. L'HORLOGE DU NAVIGATEUR AVANCE DE 10 MIN — LE SERVEUR, LUI, RESTE
  //       SUR L'HEURE RÉELLE DU PROCESSUS NODE (jamais affecté par ceci) ──
  await page.clock.setFixedTime(new Date(Date.now() + 10 * 60_000));

  // ── 3. LA FICHE, SERVIE PAR LE SERVEUR : « Mettre en pause » est déjà le
  //       bon libellé (segment ouvert posé en base) ────────────────────
  await page.goto(`/terrain/${INTERVENTION_9F4H5A}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  // ── 4. LE CLIC : SANS LE CALAGE, LE SERVEUR REFUSERAIT
  //       `compteur.refus.instant_futur` (mesuré sur `0956b292`) ────────
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();

  await expect(page.getByText(fr["compteur.refus.instant_futur"])).toHaveCount(
    0,
  );
  // Le compteur n'était plus « ici » : le bouton repasse à « Reprendre »
  // (statut resté « en_cours », aucun segment ouvert ici).
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.reprendre"] }),
  ).toBeVisible();

  const apresClic = Date.now();

  // ── 5. LE SEGMENT S'EST FERMÉ PRÈS DE L'HEURE RÉELLE, JAMAIS À +10 MIN ──
  const verif = admin();
  let finSegment: Date;
  try {
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H5A },
      select: { id: true, fin: true },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].fin).not.toBeNull();
    finSegment = segments[0].fin as Date;
  } finally {
    await verif.$disconnect();
  }

  // Encadré par l'heure réelle avant/après le clic, ± une marge généreuse
  // pour l'aller-retour réseau — jamais à dix minutes de distance.
  expect(finSegment.getTime()).toBeGreaterThanOrEqual(avantClic - 5_000);
  expect(finSegment.getTime()).toBeLessThanOrEqual(apresClic + 5_000);

  // ── 6. RENVOI DU MÊME GESTE (lie-fi : la requête aboutit, la réponse se
  //       perd) — LE MÊME `instant_appareil` RETROUVE LE MÊME SEGMENT,
  //       RIEN N'EST DOUBLÉ (le rejeu par l'instant exact de 9F4H4D,
  //       intact : c'est tout l'enjeu de fixer la valeur calée UNE FOIS) ─
  const corpsRenvoi = await page.evaluate(
    async ({ interventionId, instantAppareil }) => {
      const corps = new FormData();
      corps.set("geste", "arreter");
      corps.set("operation_id", crypto.randomUUID());
      corps.set("instant_appareil", instantAppareil);
      const reponse = await fetch(`/api/terrain/${interventionId}/compteur`, {
        method: "POST",
        body: corps,
        headers: { Accept: "application/json" },
      });
      return reponse.json();
    },
    {
      interventionId: INTERVENTION_9F4H5A,
      instantAppareil: finSegment.toISOString(),
    },
  );
  expect(corpsRenvoi.ok).toBe(true);

  const verifRenvoi = admin();
  try {
    const segments = await verifRenvoi.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H5A },
      select: { id: true },
    });
    expect(segments).toHaveLength(1);
  } finally {
    await verifRenvoi.$disconnect();
  }
});
