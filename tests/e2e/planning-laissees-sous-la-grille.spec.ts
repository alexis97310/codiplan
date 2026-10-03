import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9CTA-REPRISE-9CT — LA LISTE DES LAISSÉES SE RENDAIT AU-DESSUS DE LA GRILLE,
 * SUR TOUTES LES VUES, ET POUSSAIT LA LÉGENDE DE LA VUE JOUR HORS DU CADRE
 * VISIBLE À 800 PX (`tests/e2e/planning-jour-en-tete.spec.ts:102`, deux
 * passages identiques, voir `docs/propositions/9CT-RETOUCHES-5/passation.md`,
 * « le conflit non résolu »).
 *
 * SA PROPRE SCÈNE, préfixée `9CTA-`, forgée en `beforeAll`, effacée en
 * `afterAll` (I9) : une Planifiée complète (technicien, heure, durée) mais
 * dont la date est passée, pour obtenir UNE ligne au motif `date_passee` sans
 * dépendre du volume de la démonstration ni d'aucune fixture `SCENE.*`
 * partagée.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();

/**
 * LE JOUR OUVERT VISÉ PAR LA VUE JOUR — jamais « aujourd'hui ».
 *
 * 9DW-E2E-DIMANCHE : `/planning?vue=jour` sans `jour=` montre le jour COURANT
 * de la société, et le dimanche aucune agence n'ouvre (`prisma/seed-data.ts`)
 * — la vue rend alors son état vide (un `<p>`, pas de `<ul>` enfant direct),
 * et la légende visée par ce spec n'existe plus. Un mardi de la scène, comme
 * `planning-jour-en-tete.spec.ts`, puis `prochainJourOuvert` au cas où un
 * jour férié de la scène tomberait sur ce mardi-là.
 *
 * La ligne forgée par ce spec (motif « date passée ») reste, elle, à J-5 du
 * jour RÉEL : la liste des laissées se calcule depuis l'horloge
 * (`listerPlanifieesATransmettre` dans `lib/interventions/depot.ts`), jamais
 * depuis le jour affiché — changer le jour affiché ne change donc rien à sa
 * présence sous la grille.
 */
async function jourOuvertDeLaScene(
  client: PrismaClient,
  reperes: Awaited<ReturnType<typeof reperesDeLaScene>>,
): Promise<string> {
  const candidat = jourDeLaScene(reperes, MARDI);
  const agences = await client.agence.findMany({
    where: { societe_id: reperes.societeId },
    select: { id: true },
  });
  const fenetre = { du: candidat, au: jourSuivant(candidat, 14) };
  const calendriers = (
    await Promise.all(
      agences.map((agence) =>
        chargerCalendrierAgence(client, {
          societeId: reperes.societeId,
          agenceId: agence.id,
          fenetre,
        }),
      ),
    )
  ).filter((c): c is Calendrier => c !== null);
  return cleDeJour(prochainJourOuvert(calendriers, candidat));
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let jourVise: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    jourVise = await jourOuvertDeLaScene(client, reperes);

    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const cleePassee = cleDeJour(jourSuivant(aujourdhui, -5));

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9CTA — client laissée",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9CTA — site laissée",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${cleePassee}T00:00:00.000Z`),
        creneau_debut: new Date(`${cleePassee}T08:00:00.000Z`),
        creneau_fin: new Date(`${cleePassee}T09:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9CTA — complète mais passée, forgée par ce spec",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9DW-E2E-DIMANCHE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: false,
  });
}

test("la légende de la vue jour reste visible, même avec une laissée « date passée »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/planning?vue=jour&jour=${jourVise}`);

  // LA LÉGENDE — toujours remontée AU-DESSUS de la grille, visible sans
  // défiler, quel que soit le volume de la liste des laissées.
  const legende = page.locator('[data-maquette-bloc="vue-jour"] > ul').first();
  await expect(legende).toBeVisible();
  await expect(legende).toBeInViewport();

  // LA LISTE DES LAISSÉES — présente, SOUS la grille, et porte la ligne
  // forgée par ce spec (motif « date passée »), repérée par son lien vers la
  // fiche — jamais par un texte affiché, que le gardien `sans-chaine-visible-
  // en-dur` réserve au dictionnaire.
  const laissees = page.locator("[data-laissees-transmission]");
  await expect(laissees).toBeVisible();
  await expect(
    laissees.locator(`a[href="/interventions/${INTERVENTION_ID}"]`),
  ).toBeVisible();

  await capturer(page, "vue-jour-legende-et-laissees");
});
