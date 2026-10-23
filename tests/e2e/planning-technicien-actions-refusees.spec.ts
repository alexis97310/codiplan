import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9D3-PLANNING-TECHNICIEN-ACTIONS — LE TECHNICIEN NE VOIT PLUS CE QUE LE
 * SERVEUR LUI REFUSE.
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * `dfb169ea` (9DKA-REPRISE-9DK) a fermé, CÔTÉ SERVEUR, le ○ que le technicien
 * porte sur `modifier_planning` pour cinq routes d'écriture (déplacer,
 * note-interne, transmettre ×2, verdict-pose) : elles exigent désormais
 * `exigerCapaciteComplete`. `/planning` et le tiroir (`/api/.../resume`)
 * continuaient de lire `peut`, qui répond vrai pour ce ○ — un technicien
 * connecté par l'écran voyait « Poser… » et « Transmettre au technicien »
 * dans le tiroir, et « + Créer ici » sur une case vide, trois gestes que le
 * serveur refusait au premier clic (D131, D-06).
 *
 * ## Ce que cette épreuve mesure, et pas plus
 *
 * Le tiroir (« Poser… », « Transmettre au technicien »), « + Créer ici » et
 * la mention « glisser-déposer pour réaffecter », à 1280 px — là où vit la
 * grille (`CasePosable`, `lg:` et plus). « Déclarer une absence » reste
 * visible : c'est le SEUL geste que ce ○ doit continuer d'ouvrir. L'ADV
 * (accès complet) voit toujours les quatre. Les captures à 375 px montrent
 * le rendu mobile (liste lecture seule, sans `CasePosable`) sans y répéter
 * les mêmes assertions — ce gabarit n'a jamais porté ces gestes
 * (`page.tsx`, commentaire au-dessus de `ListeJour`).
 *
 * La commande groupée « Transmettre demain » et la liste des laissées
 * partagent la MÊME variable que la mention (`peutModifierLePlanning`,
 * `page.tsx`) — une scène « prête pour demain » aurait ajouté de la
 * complexité sans éprouver un chemin de code différent.
 *
 * ## La scène, préfixée, jamais le semis
 *
 * Une seule intervention forgée, `planifiee`, affectée à
 * `reperes.technicienDucos` (= `COMPTE_TECHNICIEN_EPREUVE`, l'identité RÉELLE
 * du semis — même moyen que `porte-capacites.spec.ts`, pour ouvrir une
 * session déjà enrôlée). Jour 119 (17 semaines) — PAS 112 : cette valeur
 * prenait le MÊME jour (MARDI+112) et le MÊME technicien que
 * `planning-jour-en-tete.spec.ts:112` (constaté à la relecture du
 * 05/10/2026, 9D3A-REPRISE-9D3). Les décalages déjà pris sur `MARDI` sont
 * 112, 126, 140, 147, 168 — 119 n'apparaît nulle part ailleurs (vérifié par
 * `grep` sur `tests/e2e`) ; le jour suivant (120), sans aucune ligne, sert de
 * case vide pour « + Créer ici ».
 */
test.describe.configure({ mode: "serial" });

const RANG_JOURS = 119;
const INTERVENTION_ID = uuidv7();

let reperes: ReperesDeScene;
let jourAvecIntervention: ReturnType<typeof jourDeLaScene>;
let jourVide: ReturnType<typeof jourDeLaScene>;
let lundiDeLaFenetre: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jourAvecIntervention = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_JOURS);
  jourVide = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_JOURS + 1);
  lundiDeLaFenetre = jourSuivant(reperes.lundi, RANG_JOURS);

  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
        // Le site SEMÉ de Ducos, par son libellé (9ER) — jamais le premier
        // par ordre alphabétique de tout l'écran (prisma/seed-data.ts:704).
        libelle: "Atelier principal",
      },
      select: { id: true, client_id: true },
    });
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          `${cleDeJour(jourAvecIntervention)}T00:00:00.000Z`,
        ),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9D3 — intervention forgée par l'épreuve",
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
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  } finally {
    await client.$disconnect();
  }
});

function hrefPlanning(): string {
  return `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`;
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9D3-PLANNING-TECHNICIEN-ACTIONS/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

async function ouvrirLeTiroir(page: Page): Promise<void> {
  // DEUX ÉLÉMENTS PORTENT LE MÊME REPÈRE À 1280 PX — la carte de la grille
  // (`CasePosable`) ET sa doublure de la liste `lg:hidden` (`data-carte-liste`),
  // présente dans le DOM mais masquée par CSS : `:visible` choisit celle que
  // l'écran montre réellement, jamais un `.first()` qui devinerait l'ordre.
  const carte = page
    .locator(`a[data-tiroir-declencheur="${INTERVENTION_ID}"]:visible`)
    .first();
  await expect(carte).toBeVisible();
  await carte.click();
  const tiroir = page.locator(`[data-tiroir-ouvert="${INTERVENTION_ID}"]`);
  await expect(tiroir).toBeVisible();
  await expect(
    tiroir.getByText(fr["planning.tiroir.ouvrir_la_fiche"]),
  ).toBeVisible();
}

test("le technicien n'atteint plus le planning du back-office — D139 l'y redirige vers sa journée", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 900 });
  // AVANT D139 (décision d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-
  // ET-ACCES) : le ○ que le technicien porte sur `consulter_planning`
  // ouvrait `/planning`, restreint à « Poser… » et « + Créer ici » retirés,
  // « Déclarer une absence » gardé — c'est TOUT ce que ce test mesurait.
  // Mesuré en ligne, un technicien ouvrait RÉELLEMENT des pages du
  // back-office — défaut que D139 corrige en fermant tout le segment, SANS
  // exception pour ce ○. `/planning` n'a aujourd'hui aucun équivalent
  // terrain propre à ce geste (hors `/terrain` lui-même) : passation.
  await page.goto(hrefPlanning());
  await expect(page).toHaveURL(/\/terrain$/);
});

test("l'ADV voit toujours « Poser… », « Transmettre », « + Créer ici », la mention de réaffectation ET « Déclarer une absence »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(hrefPlanning());

  await expect(page.locator("[data-mention-glisser-reaffecter]")).toBeVisible();

  // L'ADV voit TOUS les techniciens (périmètre complet) : scopé au href de
  // CELUI de cette scène, jamais au nom du lien seul — chaque ligne en porte
  // un, répété une fois par personne.
  await expect(
    page
      .locator(`a[href*="utilisateur_id=${reperes.technicienDucos}"]:visible`)
      .first(),
  ).toBeVisible();

  const tiroir = page.locator(`[data-tiroir-ouvert="${INTERVENTION_ID}"]`);
  await ouvrirLeTiroir(page);
  await expect(
    tiroir.getByRole("button", {
      name: fr["intervention.action.transmettre"],
    }),
  ).toBeVisible();
  await expect(
    tiroir.getByRole("button", { name: fr["planning.pose.bouton_poser"] }),
  ).toBeVisible();
  await capturer(page, "apres-adv-tiroir-1280");
  await page.keyboard.press("Escape");
  await expect(tiroir).toHaveCount(0);

  const caseVide = page.locator(
    `td[data-depot-jour="${cleDeJour(jourVide)}"][data-depot-technicien="${reperes.technicienDucos}"]`,
  );
  await expect(caseVide).toBeVisible();
  await caseVide.click();
  await expect(caseVide.locator("a[data-creer-ici]")).toBeVisible();
  await capturer(page, "apres-adv-planning-1280");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(hrefPlanning());
  await capturer(page, "apres-adv-planning-375");
});
