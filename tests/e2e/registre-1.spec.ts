import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 52-REGISTRE-1 — LES SIX ONGLETS DU REGISTRE, CHACUN AVEC SON COMPTEUR EXACT.
 *
 * ## Ce que les épreuves unitaires ne peuvent pas prouver
 *
 * `tests/unit/interventions/registre-vues.test.ts` éprouve `criteresVue`,
 * pur. Il ne prouve pas que l'écran RENDU pose bien la rangée d'onglets, que
 * chaque lien mène au bon `?vue=`, ni que le compteur affiché correspond
 * exactement à ce que le tableau montre.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `REG1-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un client et un site à soi, et SIX interventions — une par vue, chacune
 * dans le statut (ou la date) qui la fait entrer dans UN SEUL onglet. Sous
 * `fullyParallel`, une scène partagée serait faussée par ce que d'autres
 * fichiers lui font pendant que celui-ci mesure (§9, même piège que
 * `porte-capacites.spec.ts`, 24/09/2026) : chaque ligne est donc à un
 * identifiant fixe que rien d'autre ne touche, créée en `beforeAll` et
 * supprimée en `afterAll`.
 *
 * **La recherche `q=REG1-` est le filtre commun à toutes les assertions** :
 * elle retrouve les six lignes par la raison sociale du client forgé, et
 * AUCUNE AUTRE — la scène ne compte donc jamais au-delà de ce qu'elle a
 * forgé, quel que soit le volume de démonstration ou d'autres scènes e2e en
 * parallèle.
 */

// SÉRIEL — `beforeAll`/`afterAll` de PLAYWRIGHT s'exécutent UNE FOIS PAR
// WORKER, pas une fois pour le fichier : sous `fullyParallel`, plusieurs
// workers auraient chacun écrit ET effacé la même scène en même temps,
// mesuré ici par une collision d'identifiant (« Unique constraint failed »)
// et une contrainte étrangère violée par un effacement concurrent — même
// piège que `historique-client.spec.ts`.
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_REG1 = "52000000-0000-7000-8000-0000000000c1";
const SITE_REG1 = "52000000-0000-7000-8000-0000000000c2";

const INTERVENTION_A_PLANIFIER = "52000000-0000-7000-8000-000000000001";
const INTERVENTION_AUJOURDHUI = "52000000-0000-7000-8000-000000000002";
const INTERVENTION_EN_COURS = "52000000-0000-7000-8000-000000000003";
const INTERVENTION_BLOQUEE = "52000000-0000-7000-8000-000000000004";
const INTERVENTION_A_CONTROLER = "52000000-0000-7000-8000-000000000005";
const INTERVENTION_HISTORIQUE = "52000000-0000-7000-8000-000000000006";

const TOUTES_LES_INTERVENTIONS = [
  INTERVENTION_A_PLANIFIER,
  INTERVENTION_AUJOURDHUI,
  INTERVENTION_EN_COURS,
  INTERVENTION_BLOQUEE,
  INTERVENTION_A_CONTROLER,
  INTERVENTION_HISTORIQUE,
];

/** Une date FIXE, hors du jour civil courant — pour toute ligne qui ne doit PAS entrer dans l'onglet « Aujourd'hui ». */
const DATE_HORS_AUJOURDHUI = new Date("2024-01-15T00:00:00.000Z");

/**
 * CHAQUE ONGLET, LA LIGNE QUI LUI APPARTIENT, ET LE STATUT QUE SA LIGNE MONTRE
 * — la même clé sert à naviguer (`?vue=`) et à vérifier le badge rendu, pour
 * ne jamais confronter une navigation à une attente écrite séparément (§9,
 * 01/09).
 */
const ONGLETS = [
  {
    vue: "a_planifier",
    interventionId: INTERVENTION_A_PLANIFIER,
    statutBadge: "statut.a_planifier",
  },
  {
    vue: "aujourdhui",
    interventionId: INTERVENTION_AUJOURDHUI,
    statutBadge: "statut.planifiee",
  },
  {
    vue: "en_cours",
    interventionId: INTERVENTION_EN_COURS,
    statutBadge: "statut.en_cours",
  },
  {
    vue: "bloquees",
    interventionId: INTERVENTION_BLOQUEE,
    statutBadge: "statut.suspendue",
  },
  {
    vue: "a_controler",
    interventionId: INTERVENTION_A_CONTROLER,
    statutBadge: "statut.terminee",
  },
  {
    vue: "historique",
    interventionId: INTERVENTION_HISTORIQUE,
    statutBadge: "statut.cloturee",
  },
] as const;

async function ecrireLaScene(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_REG1 } });
    await client.client.deleteMany({ where: { id: CLIENT_REG1 } });

    await client.client.create({
      data: {
        id: CLIENT_REG1,
        societe_id: societe.id,
        raison_sociale: "Client REG1- (épreuve REGISTRE-1)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_REG1,
        societe_id: societe.id,
        client_id: CLIENT_REG1,
        agence_id: agence.id,
        libelle: "Lieu REG1- (épreuve REGISTRE-1)",
        temps_trajet_min: 10,
      },
    });

    // LE JOUR CIVIL COURANT, DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08) — la MÊME
    // lecture que `debutDuJourSociete` (`lib/interventions/depot.ts`) : un
    // calcul séparé dans l'heure locale de la machine qui exécute l'épreuve
    // diverge sous UTC+11 selon l'heure à laquelle le harnais tourne.
    const fuseau = schemaFuseau.parse(societe.fuseau_horaire);
    const aujourdhui = instantDuJour(jourDe(maintenant(fuseau).local));

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: CLIENT_REG1,
      site_id: SITE_REG1,
      type: "curatif" as const,
      priorite: "p3" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    await client.intervention.create({
      data: {
        id: INTERVENTION_A_PLANIFIER,
        ...base,
        statut: "a_planifier",
        date_planifiee: null,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AUJOURDHUI,
        ...base,
        statut: "planifiee",
        date_planifiee: aujourdhui,
        // `intervention_planifiee_a_sa_duree` (PARCOURS-1) : `planifiee`
        // exige une durée prévue.
        duree_estimee_min: 60,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_COURS,
        ...base,
        statut: "en_cours",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_BLOQUEE,
        ...base,
        statut: "suspendue",
        date_planifiee: DATE_HORS_AUJOURDHUI,
        // `intervention_suspension_a_son_motif` et
        // `intervention_suspension_a_sa_date` (RG-INT-06, L2-10) : une
        // suspension exige les deux.
        motif_suspension: "Attente de pièce (épreuve REGISTRE-1)",
        suspendue_le: new Date(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_A_CONTROLER,
        ...base,
        statut: "terminee",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_HISTORIQUE,
        ...base,
        statut: "cloturee",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });

    // LE TÉMOIN — six lignes en base, sous le client forgé, pas une de plus.
    const enBase = await client.intervention.count({
      where: { client_id: CLIENT_REG1 },
    });
    expect(enBase).toBe(TOUTES_LES_INTERVENTIONS.length);
  } finally {
    await client.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_REG1 } });
    await client.client.deleteMany({ where: { id: CLIENT_REG1 } });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const { vue, interventionId, statutBadge } of ONGLETS) {
  test(`l'onglet « ${vue} », filtré par q=REG1- : un compteur à 1, une ligne, celle attendue`, async ({
    page,
  }) => {
    await page.goto(`/interventions?vue=${vue}&q=REG1-`);
    await expect(page.locator("main")).toBeVisible();

    // LE COMPTEUR AFFICHÉ SUR L'ONGLET ACTIF — « <libellé> (1) ». Le compte
    // est extrait du texte rendu et comparé en NOMBRE, jamais par une
    // ponctuation écrite en dur dans une requête d'écran (L0-11) : « (1) »
    // n'est du texte attendu par personne, c'est un test de rendu qui lirait
    // une chaîne hors du dictionnaire.
    const ongletActif = page.locator(
      'nav[data-nav="onglets-registre"] a[aria-current="page"]',
    );
    const texteOnglet = (await ongletActif.innerText()).trim();
    expect(texteOnglet).toContain(dictionnaire[`interventions.vue.${vue}`]!);
    const compteAffiche = /\((\d+)\)\s*$/.exec(texteOnglet)?.[1];
    expect(Number(compteAffiche)).toBe(1);

    // LE TABLEAU NE MONTRE QU'UNE LIGNE — jamais au-delà de ce que la scène
    // a forgé, quel que soit le volume de démonstration.
    const lignes = page.locator("tbody tr");
    await expect(lignes).toHaveCount(1);

    // ET C'EST LA BONNE LIGNE — son lien mène à LA fiche attendue, et son
    // badge de statut est celui que cette vue promet.
    await expect(
      lignes.locator(`a[href^="/interventions/${interventionId}"]`),
    ).toHaveCount(1);
    await expect(lignes).toContainText(dictionnaire[statutBadge]!);
  });
}

/** Les deux largeurs demandées par le ticket, mobile puis bureau. */
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/52-REGISTRE-1/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("capture — l'onglet « Bloquées »", async ({ page }) => {
  await page.goto("/interventions?vue=bloquees&q=REG1-");
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "bloquees");
});
