import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  assertListeVisibleEtCliquable,
  valeurChamp,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I7E-CREER-MACHINE-LISTES-DEROULANTES (30/10/2026) — bug signalé par
 * Alexis : sur `/parc/nouvelle`, les listes de `SelecteurRecherche`
 * s'ouvraient bien mais se faisaient couper par le bas de la carte qui les
 * contient (`SectionFormulaire` → `Carte`, `overflow-hidden`). Mesuré par
 * capture (PC, 30/10/2026 ~18:55) : le champ Client ouvrait sa liste, la
 * première ligne et un soupçon de la seconde dépassaient, le reste était
 * masqué — exactement ce que les épreuves EXISTANTES (`choisirPremierResultat`)
 * ne pouvaient pas voir, puisqu'elles ne cliquent jamais que le PREMIER
 * résultat, toujours visible.
 *
 * `assertListeVisibleEtCliquable` (`setup/selecteur-recherche.ts`) répare ce
 * trou : elle exige AU MOINS DEUX résultats et éprouve le DERNIER — boîte non
 * nulle, dans la fenêtre, et non recouverte par `elementFromPoint`.
 *
 * COUVRE LES QUATRE ÉCRANS qui emploient `SelecteurRecherche`
 * (`git grep -n SelecteurRecherche` du 30/10/2026) :
 *   1. `/parc/nouvelle` (client, site, modèle) — l'écran signalé, à 1280 ET
 *      375 px (tactile), bout en bout jusqu'à la machine créée.
 *   2. `/sites/nouveau` (client) — même carte, même rognage.
 *   3. `/interventions/nouvelle` (site) — même carte, même rognage.
 *   4. `/demandes?nouvelle=1` (client, site) — PAS dans une carte (un volet,
 *      `overflow-y-auto`), mais le même composant partagé, donc le même
 *      correctif ; éprouvé pour que le périmètre du correctif ne laisse rien
 *      de côté.
 *
 * Scène propre, préfixée `9I7E-`, créée en `beforeAll` et supprimée en
 * `afterAll`, dans l'ordre que les clés étrangères `Restrict` exigent
 * (intervention → machine → site → modèle → famille → client) — même
 * discipline que `selecteurs-1.spec.ts`.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "9I7E-";

const CLIENTS = [uuidv7(), uuidv7(), uuidv7()] as const;
const SITES_PAR_CLIENT = CLIENTS.map(() => [uuidv7(), uuidv7()] as const);
const FAMILLE = uuidv7();
const MODELES = [uuidv7(), uuidv7()] as const;

function libelleClient(rang: number): string {
  return `${PREFIXE}Client ${rang}`;
}
function libelleSite(rangClient: number, rangSite: number): string {
  return `${PREFIXE}Site ${rangClient}.${rangSite}`;
}
const MARQUE_MODELE = `${PREFIXE}MARQUE`;
function referenceModele(rang: number): string {
  return `${PREFIXE}REF-${rang}`;
}

let clientAcces: PrismaClient;

test.beforeAll(async () => {
  clientAcces = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await clientAcces.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await clientAcces.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  await clientAcces.client.createMany({
    data: CLIENTS.map((id, rang) => ({
      id,
      societe_id: societe.id,
      raison_sociale: libelleClient(rang + 1),
      actif: true,
    })),
  });
  await clientAcces.site.createMany({
    data: SITES_PAR_CLIENT.flatMap((sites, rangClient) =>
      sites.map((id, rangSite) => ({
        id,
        societe_id: societe.id,
        client_id: CLIENTS[rangClient],
        agence_id: agence.id,
        libelle: libelleSite(rangClient + 1, rangSite + 1),
      })),
    ),
  });
  await clientAcces.familleMateriel.create({
    data: {
      id: FAMILLE,
      societe_id: societe.id,
      code: "9I7EFAM",
      libelle: `${PREFIXE}Famille`,
    },
  });
  await clientAcces.modeleMateriel.createMany({
    data: MODELES.map((id, rang) => ({
      id,
      societe_id: societe.id,
      famille_id: FAMILLE,
      marque: MARQUE_MODELE,
      reference: referenceModele(rang + 1),
    })),
  });
});

test.afterAll(async () => {
  try {
    const tousLesSites = SITES_PAR_CLIENT.flat();
    await clientAcces.intervention.deleteMany({
      where: { site_id: { in: tousLesSites } },
    });
    await clientAcces.machine.deleteMany({
      where: { modele_id: { in: [...MODELES] } },
    });
    await clientAcces.site.deleteMany({ where: { id: { in: tousLesSites } } });
    await clientAcces.modeleMateriel.deleteMany({
      where: { id: { in: [...MODELES] } },
    });
    await clientAcces.familleMateriel.delete({ where: { id: FAMILLE } });
    await clientAcces.client.deleteMany({
      where: { id: { in: [...CLIENTS] } },
    });
  } finally {
    await clientAcces.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const scene of [
  {
    nom: "1280 px (bureau)",
    viewport: { width: 1280, height: 900 },
    hasTouch: false,
  },
  {
    nom: "375 px (téléphone, tactile)",
    viewport: { width: 375, height: 800 },
    hasTouch: true,
  },
] as const) {
  test.describe(scene.nom, () => {
    test.use({ viewport: scene.viewport, hasTouch: scene.hasTouch });

    test(`/parc/nouvelle — client, site et modèle restent visibles et cliquables, la machine se crée (${scene.nom})`, async ({
      page,
    }) => {
      await page.goto("/parc/nouvelle");

      await assertListeVisibleEtCliquable(page, "client_id", PREFIXE);
      await assertListeVisibleEtCliquable(page, "site_id", PREFIXE);
      await assertListeVisibleEtCliquable(page, "modele_id", PREFIXE);

      await page
        .locator('input[name="numero_serie"]')
        .fill(`9I7E-SN-${scene.viewport.width}`);
      await page
        .getByRole("button", { name: fr["machine.action.creer_la_machine"] })
        .click();

      await expect(page).toHaveURL(/\/parc\/[0-9a-f-]{36}/);
    });

    test(`/sites/nouveau — le champ client reste visible et cliquable (${scene.nom})`, async ({
      page,
    }) => {
      await page.goto("/sites/nouveau");

      await assertListeVisibleEtCliquable(page, "client_id", PREFIXE);

      await expect(valeurChamp(page, "client_id")).not.toHaveValue("");
    });

    test(`/interventions/nouvelle — le champ site reste visible et cliquable (${scene.nom})`, async ({
      page,
    }) => {
      await page.goto("/interventions/nouvelle");

      await assertListeVisibleEtCliquable(page, "site", PREFIXE);

      await expect(valeurChamp(page, "site")).not.toHaveValue("");
    });

    test(`/demandes?nouvelle=1 — les champs client et site du volet restent visibles et cliquables (${scene.nom})`, async ({
      page,
    }) => {
      await page.goto("/demandes?nouvelle=1");

      await assertListeVisibleEtCliquable(page, "client_id", PREFIXE);
      await assertListeVisibleEtCliquable(page, "site_id", PREFIXE);

      await expect(valeurChamp(page, "site_id")).not.toHaveValue("");
    });
  });
}
