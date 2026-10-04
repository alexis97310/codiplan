import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9DCA-REPRISE-9DC (03/10/2026, D151) — AVANT/APRÈS.
 *
 * Rien n'est écrit sans la variable d'environnement qui nomme le dossier
 * (`CAPTURES_9DCA`), pour que `pnpm test:e2e` ordinaire n'écrive jamais de
 * fichier — même recette que `captures-9ao-gr17-demande-champ-nature.spec.ts`.
 *
 * **SA PROPRE SCÈNE, préfixée `9DCA-`, pour LES DEUX écrans** — un client, un
 * site, une demande ET une intervention affectée au technicien de Ducos,
 * créés en `beforeAll`, supprimés en `afterAll`. **Jamais `SCENE.*`** :
 * `tests/unit/e2e-donnees-partagees.test.ts` refuse qu'un fichier LISE une
 * fixture partagée qu'un autre ÉCRIT en SQL brut (`rapport-terrain.spec.ts`
 * écrit sur `SCENE.rapportVierge`) — la mesure même du « piège connu » que ce
 * ticket documente ailleurs.
 *
 * AVANT/APRÈS se prend en rejouant ce fichier deux fois : une fois sur le
 * code d'avant ce lot (`git stash` des changements de production, ce
 * fichier conservé), une fois sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DCA ?? "";
/** « avant » ou « après » — posé par l'appelant (voir la passation du lot). */
const ETAPE = process.env.CAPTURES_9DCA_ETAPE ?? "avant";

const PREFIXE = "9DCA-";
const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const DEMANDE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.demande.deleteMany({ where: { id: DEMANDE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: `${PREFIXE}Client (captures 9DCA)`,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: `${PREFIXE}Lieu (captures 9DCA)`,
        temps_trajet_min: 10,
      },
    });
    const depose = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_ID,
        societe_id: reperes.societeId,
        source: "appel",
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        description: `${PREFIXE}Panne (captures 9DCA)`,
        urgence: "p2",
        statut: "nouvelle",
        depose_le: depose,
        compteur_accuse_le: depose,
      },
    });

    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    const cle = cleJour(aujourdHui);
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
        statut: "affectee",
        date_planifiee: new Date(`${cle}T00:00:00.000Z`),
        creneau_debut: new Date(`${cle}T20:00:00.000Z`),
        creneau_fin: new Date(`${cle}T21:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: `${PREFIXE}intervention (captures 9DCA)`,
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
    await nettoyer(client);
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
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirLaSessionDuTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

for (const largeur of [1280, 375] as const) {
  test(`capture — fiche demande vue par une ADV, à ${largeur}px (rien ne change)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/demandes/${DEMANDE_ID}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "demande-adv", largeur);
  });

  test(`capture — fiche demande vue par un technicien, à ${largeur}px (l'écran entier est « RefusAcces », D152)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionDuTechnicien(page);
    await page.goto(`/demandes/${DEMANDE_ID}`);
    await expect(page.locator("main")).toBeVisible();
    // R6 (9DX-RETOUCHES-11), renommé par R3 (addendum 9DN) — « le refus prend
    // la place des actions » était inexact : « prend la place » décrirait un
    // refus PAR ACTION (boutons masqués, reste de la fiche intact), qui n'est
    // PAS ce cas. Mesuré : le technicien est fermé à `/demandes/[id]` par la
    // garde D152 (QT-2), ANTÉRIEURE à `qualifier_affecter` — la page rend
    // `<RefusAcces />` (`auth.refus_droit`) à la place de LA FICHE ENTIÈRE,
    // jamais le refus par action (`demande.refus.capacite_requise`), qui ne
    // s'affiche que pour un rôle qui atteint la fiche sans porter
    // `qualifier_affecter` (aucun aujourd'hui : tous les rôles internes non
    // techniciens l'ont). Dans les deux cas, aucun bouton d'action n'est
    // rendu — éprouvé ici sur les quatre actions de la fiche, pas la seule
    // qu'un correcteur pressé aurait listée.
    await expect(page.getByText(fr["auth.refus_droit"]).first()).toBeVisible();
    for (const libelle of [
      fr["demande.action.accuser"],
      fr["demande.action.qualifier"],
      fr["demande.action.marquer_transformee"],
      fr["demande.action.clore"],
    ]) {
      await expect(page.getByRole("button", { name: libelle })).toHaveCount(0);
    }
    await capturer(page, "demande-technicien", largeur);
  });

  test(`capture — fiche terrain du technicien affecté, à ${largeur}px (rien ne change)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionDuTechnicien(page);
    await page.goto(`/terrain/${INTERVENTION_ID}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "terrain-technicien-affecte", largeur);
  });
}
