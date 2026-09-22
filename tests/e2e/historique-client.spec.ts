import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FICHE D'UN CLIENT S'ARRÊTAIT À DOUZE INTERVENTIONS, SUR 1751
 * (HISTORIQUE-CLIENT-1).
 *
 * ## Le constat, mesuré sur `main` le 23/09/2026
 *
 * `app/(back-office)/clients/[id]/page.tsx` posait `INTERVENTIONS_MONTREES =
 * 12` et aucun moyen d'atteindre la treizième — pas de pagination, pas de
 * lien « tout voir », pas de filtre. La base hébergée porte 1751
 * interventions d'archive ; un client comme SPEEDY ou CALEBAM en porte plus
 * qu'une page n'en montre, et toute sa relation ancienne était invisible.
 *
 * ## Ce que ce scénario prouve, et ce qu'il ne prouve pas
 *
 * Il prouve que l'écran RENDU permet d'ATTEINDRE la treizième intervention —
 * en page 2, par le lien « page suivante » — et qu'un client sans aucune
 * intervention DIT son absence au lieu de rendre un tableau vide (D88). Il ne
 * prouve PAS que la lecture est bornée CÔTÉ BASE — c'est
 * `tests/isolation/historique-client-pagination.test.ts` qui compte ce que
 * chaque page ramène.
 *
 * **Sur `main` avant le lot, il rougit** : la page 1 ne porte AUCUN lien vers
 * une page suivante — le second `expect` ne trouve pas le lien « page
 * suivante » —, pour cette seule raison. La capture AVANT est prise juste
 * avant cette assertion.
 *
 * ## La scène — un CLIENT posé exprès, jamais un client du semis partagé
 *
 * *Mode `fullyParallel` du dépôt* : compter les interventions d'un client du
 * semis de démonstration serait faux au rendu si un autre scénario, en
 * parallèle, en ajoutait une entre le compte de la scène et le rendu de
 * l'écran — la même faute que celle documentée sur `historique-site.spec.ts`
 * pour le choix d'un site à soi. Un CLIENT à soi, avec son propre site, n'a
 * pas ce risque. Treize interventions — dix DATÉES (2013 à 2022, hors de
 * toute semaine de planning) et trois SANS DATE — et un second client SANS
 * AUCUNE intervention, posés de la même main et retirés à la fin.
 *
 * Les libellés déjà servis avant ce lot sont lus PAR NOM —
 * `(fr as Record<string, string>)[cle]` — pour ne pas figer un import typé
 * sur une clé qui n'a pas changé.
 *
 * `CAPTURES_HISTORIQUE_CLIENT_1=<dossier>` fait écrire les captures à
 * 1280 px et `mesure.json`.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_HISTORIQUE_CLIENT_1 ?? "";
/** La taille d'une PAGE de la fiche — celle que l'écran ÉCRIT dans sa pagination. */
const INTERVENTIONS_PAR_PAGE = 12;
const CLIENT_AVEC_HISTORIQUE = "e2e00000-0000-7000-8000-0000000c9c13";
const SITE_AVEC_HISTORIQUE = "e2e00000-0000-7000-8000-0000000c9c14";
const CLIENT_SANS_INTERVENTION = "e2e00000-0000-7000-8000-0000000c9c15";
const DATEES = 10;
const SANS_DATE = 3;
const EN_BASE = DATEES + SANS_DATE;
const PREMIERE_ANNEE = 2013;

const dictionnaire = fr as Record<string, string>;

function idIntervention(rang: number): string {
  return `e2e00000-0000-7000-8000-000000c9c1${String(rang).padStart(2, "0")}`;
}

/** Une date par an à partir de 2013 pour les `DATEES` premiers rangs ; `null` ensuite. */
function dateDuRang(rang: number): Date | null {
  return rang < DATEES ? new Date(Date.UTC(PREMIERE_ANNEE + rang, 0, 1)) : null;
}

type Scene = { readonly enBase: number };

let scene: Scene;

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  fiches: Record<string, Record<string, unknown>>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  fiches: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    // `delete` puis `create` : une scène repart d'un état connu.
    await client.intervention.deleteMany({
      where: {
        id: {
          in: Array.from({ length: EN_BASE }, (_, r) => idIntervention(r)),
        },
      },
    });
    await client.site.deleteMany({ where: { id: SITE_AVEC_HISTORIQUE } });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_AVEC_HISTORIQUE, CLIENT_SANS_INTERVENTION] } },
    });
    await client.client.create({
      data: {
        id: CLIENT_AVEC_HISTORIQUE,
        societe_id: societe.id,
        raison_sociale:
          "Client à treize interventions (épreuve HISTORIQUE-CLIENT-1)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC_HISTORIQUE,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_HISTORIQUE,
        agence_id: agence.id,
        libelle: "Lieu du client à treize interventions",
        temps_trajet_min: 10,
      },
    });
    for (let rang = 0; rang < EN_BASE; rang += 1) {
      const date = dateDuRang(rang);
      await client.intervention.create({
        data: {
          id: idIntervention(rang),
          societe_id: societe.id,
          agence_id: agence.id,
          client_id: CLIENT_AVEC_HISTORIQUE,
          site_id: SITE_AVEC_HISTORIQUE,
          type: "curatif",
          priorite: "p3",
          statut: date === null ? "a_planifier" : "terminee",
          date_planifiee: date,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
        },
      });
    }
    await client.client.create({
      data: {
        id: CLIENT_SANS_INTERVENTION,
        societe_id: societe.id,
        raison_sociale: "Client jamais visité (épreuve HISTORIQUE-CLIENT-1)",
      },
    });

    // LE TÉMOIN — treize en base sur l'un, dont trois sans date ; zéro sur
    // l'autre.
    const enBase = await client.intervention.count({
      where: { client_id: CLIENT_AVEC_HISTORIQUE },
    });
    expect(enBase).toBe(EN_BASE);
    expect(enBase).toBeGreaterThan(INTERVENTIONS_PAR_PAGE);
    expect(
      await client.intervention.count({
        where: { client_id: CLIENT_AVEC_HISTORIQUE, date_planifiee: null },
      }),
    ).toBe(SANS_DATE);
    expect(
      await client.intervention.count({
        where: { client_id: CLIENT_SANS_INTERVENTION },
      }),
    ).toBe(0);
    scene = { enBase };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.intervention.deleteMany({
      where: {
        id: {
          in: Array.from({ length: EN_BASE }, (_, r) => idIntervention(r)),
        },
      },
    });
    await client.site.deleteMany({ where: { id: SITE_AVEC_HISTORIQUE } });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_AVEC_HISTORIQUE, CLIENT_SANS_INTERVENTION] } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

/** `JJ/MM/AAAA` → un entier comparable ; `—` (file d'attente) → `null`. */
function rangDeLaDate(texte: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte.trim());
  if (m === null) return null;
  return Number(`${m[3]}${m[2]}${m[1]}`);
}

test("UN CLIENT À TREIZE INTERVENTIONS : la page 1 en rend douze, la page 2 rend la treizième — atteignable, sans doublon", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_AVEC_HISTORIQUE}`);
  await expect(page.locator("main")).toBeVisible();
  mesure.fiches.page_un = {
    url: `/clients/${CLIENT_AVEC_HISTORIQUE}`,
    interventions_en_base: scene.enBase,
  };
  // LA CAPTURE PRÉCÈDE L'ASSERTION QUI ROUGIT SUR `main` : sur le code
  // d'avant ce lot, aucun lien « page suivante » n'existe, et c'est
  // exactement l'impossibilité que ce ticket corrige.
  await capturer(page, "client-page-1");

  const bloc = page.locator('[data-bloc="historique-client"]');
  await expect(bloc).toBeVisible();

  // TREIZE en base, DOUZE rendues sur la première page.
  const lignesPage1 = bloc.locator("tbody tr");
  await expect(lignesPage1).toHaveCount(INTERVENTIONS_PAR_PAGE);

  const referencesPage1 = await lignesPage1
    .locator('a[href^="/interventions/"]')
    .allInnerTexts();
  expect(new Set(referencesPage1).size).toBe(INTERVENTIONS_PAR_PAGE);

  // LA PLUS RÉCENTE EN TÊTE : dix datées puis deux « — » sur trois — la
  // treizième (sans date) est celle que la PAGE a repoussée, jamais une
  // datée.
  const datesPage1 = (
    await lignesPage1.locator("td:nth-child(2)").allInnerTexts()
  ).map(rangDeLaDate);
  const premiereSansDatePage1 = datesPage1.findIndex((d) => d === null);
  expect(premiereSansDatePage1).toBe(DATEES);
  const dateesPage1 = datesPage1.slice(0, premiereSansDatePage1) as number[];
  expect(dateesPage1[0]).toBe(Number(`${PREMIERE_ANNEE + DATEES - 1}0101`));
  for (let i = 1; i < dateesPage1.length; i += 1) {
    expect(dateesPage1[i]!).toBeLessThan(dateesPage1[i - 1]!);
  }

  // LA PAGINATION EST ÉCRITE — le total, « page 1 sur 2 ».
  const texteDuBloc = await bloc.innerText();
  expect(texteDuBloc).toContain(String(EN_BASE));
  expect(texteDuBloc).toContain(dictionnaire["pagination.page"]!);
  expect(texteDuBloc).toContain("2");

  // LE LIEN VERS LA PAGE SUIVANTE EXISTE — c'est lui qui manque sur `main`
  // avant ce lot, et c'est la SEULE raison pour laquelle ce test y rougit.
  const lienSuivant = bloc.getByRole("link", {
    name: dictionnaire["pagination.suivant"],
  });
  await expect(lienSuivant).toBeVisible();
  await lienSuivant.click();
  await expect(page).toHaveURL(/[?&]page=2\b/);

  const lignesPage2 = bloc.locator("tbody tr");
  await expect(lignesPage2).toHaveCount(EN_BASE - INTERVENTIONS_PAR_PAGE);
  const referencesPage2 = await lignesPage2
    .locator('a[href^="/interventions/"]')
    .allInnerTexts();
  // AUCUN DOUBLON À LA CHARNIÈRE : la page 2 ne répète aucune référence de la
  // page 1, et c'est exactement la treizième intervention qui apparaît ici.
  expect(referencesPage2.every((ref) => !referencesPage1.includes(ref))).toBe(
    true,
  );
  const datesPage2 = (
    await lignesPage2.locator("td:nth-child(2)").allInnerTexts()
  ).map(rangDeLaDate);
  expect(datesPage2.every((d) => d === null)).toBe(true);

  mesure.fiches.page_un = {
    ...mesure.fiches.page_un,
    lignes_page_1: referencesPage1.length,
    dates_page_1: datesPage1,
  };
  mesure.fiches.page_deux = {
    url: page.url(),
    lignes_page_2: referencesPage2.length,
    references_page_2: referencesPage2,
  };
  await capturer(page, "client-page-2");
});

test("UN CLIENT SANS AUCUNE INTERVENTION dit son absence — ni tableau vide, ni zéro", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_SANS_INTERVENTION}`);
  await expect(page.locator("main")).toBeVisible();
  mesure.fiches.sans_intervention = {
    url: `/clients/${CLIENT_SANS_INTERVENTION}`,
  };
  await capturer(page, "client-sans-intervention");

  const bloc = page.locator('[data-bloc="historique-client"]');
  await expect(bloc).toBeVisible();
  // Le tableau garde SA ligne pleine (le message d'absence occupe la place
  // d'une ligne, comme sur `clients.fiche.sites_vide`) — c'est l'absence de
  // toute RÉFÉRENCE d'intervention qui dit qu'il n'y a rien à montrer.
  await expect(bloc.locator('a[href^="/interventions/"]')).toHaveCount(0);
  const texteDuBloc = await bloc.innerText();
  expect(texteDuBloc).toContain(
    dictionnaire["clients.fiche.interventions_vide"]!,
  );
  // Aucune pagination sur un client qui n'a rien à paginer.
  await expect(
    bloc.getByRole("link", { name: dictionnaire["pagination.suivant"] }),
  ).toHaveCount(0);

  mesure.fiches.sans_intervention = {
    ...mesure.fiches.sans_intervention,
    lignes_rendues: await bloc.locator('a[href^="/interventions/"]').count(),
    absence_rendue: dictionnaire["clients.fiche.interventions_vide"],
  };
  await capturer(page, "client-sans-intervention");
});
