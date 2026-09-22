import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FICHE D'UN SITE MONTRE SES INTERVENTIONS, OU DIT QU'IL N'EN A AUCUNE
 * (HISTORIQUE-SITE-1).
 *
 * ## Le constat, mesuré sur `main` le 22/09/2026
 *
 * `app/(back-office)/sites/[id]/page.tsx` portait un formulaire et le bloc des
 * habilitations exigées — **aucune lecture d'intervention**. La base hébergée
 * porte 1751 interventions d'archive rattachées à des sites, et l'écran où on
 * les cherche avant d'envoyer un technicien était muet.
 *
 * ## Ce que ce scénario prouve, et ce qu'il ne prouve pas
 *
 * Il prouve que l'écran RENDU porte le bloc, avec ses lignes, la plus récente
 * en tête et la file d'attente en bas ; et qu'un site sans aucune intervention
 * DIT son absence au lieu de rendre un tableau vide (D88). Il ne prouve PAS que
 * la requête ne ramène que ce qu'elle affiche — c'est
 * `tests/isolation/historique-site-borne.test.ts` qui compte ce que la lecture
 * rend.
 *
 * **Sur `main` avant le lot, il rougit parce que le bloc n'existe pas** — le
 * premier `expect` ne trouve pas `[data-bloc="historique-site"]` —, et pour
 * aucune autre raison : la capture est prise AVANT cette assertion.
 *
 * ## La scène
 *
 * **Un site posé exprès, avec ses propres interventions** — treize : dix
 * DATÉES, une par an de 2013 à 2022 (des dates passées et distinctes, hors de
 * toute semaine de planning), terminées ; et trois SANS DATE, à planifier.
 * Treize est PLUS que la borne de douze : l'écran doit tronquer, et la
 * troncature se voit — dix lignes datées du plus récent au plus ancien, puis
 * DEUX « — » sur trois, la treizième n'étant pas rendue.
 *
 * *Pourquoi pas le site le plus chargé du semis* : c'est ce que la première
 * écriture faisait, et elle a rougi dans la suite complète — un autre spec,
 * en parallèle, avait ajouté une intervention sur ce même site entre le compte
 * de la scène (11) et le rendu (12). Un site partagé n'a pas de compte ; un
 * site à soi en a un. Le site SANS intervention est posé de la même main, et
 * les deux sont retirés à la fin.
 *
 * Les libellés neufs sont lus PAR NOM — `(fr as Record<string, string>)[cle]` —
 * et non par clé typée : `next build` type-vérifie `tests/` sur le code AVANT
 * le lot, où ces clés n'existent pas encore.
 *
 * `CAPTURES_HISTORIQUE_SITE_1=<dossier>` fait écrire les captures à 1280 px et
 * `mesure.json` — empreinte du commit, horodatage, ce que chaque fiche a rendu.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_HISTORIQUE_SITE_1 ?? "";
/** La borne d'affichage de la fiche — celle que l'écran ÉCRIT à côté du tableau. */
const INTERVENTIONS_MONTREES = 12;
const SITE_SANS_INTERVENTION = "e2e00000-0000-7000-8000-00000000513e";
const SITE_AVEC_HISTORIQUE = "e2e00000-0000-7000-8000-00000000513a";
const DATEES = 10;
const SANS_DATE = 3;
const EN_BASE = DATEES + SANS_DATE;
const PREMIERE_ANNEE = 2013;

const dictionnaire = fr as Record<string, string>;

function idIntervention(rang: number): string {
  return `e2e00000-0000-7000-8000-0000000513${String(rang).padStart(2, "0")}`;
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
    // Les deux sites sont posés sur le premier client actif et la première
    // agence de la société : ce qui compte est ce qu'ILS portent, pas où.
    const clientActif = await client.client.findFirstOrThrow({
      where: { societe_id: societe.id, actif: true },
      select: { id: true },
      orderBy: { raison_sociale: "asc" },
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
    await client.site.deleteMany({
      where: { id: { in: [SITE_AVEC_HISTORIQUE, SITE_SANS_INTERVENTION] } },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC_HISTORIQUE,
        societe_id: societe.id,
        client_id: clientActif.id,
        agence_id: agence.id,
        libelle: "Lieu à treize interventions (épreuve HISTORIQUE-SITE-1)",
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
          client_id: clientActif.id,
          site_id: SITE_AVEC_HISTORIQUE,
          type: "curatif",
          priorite: "p3",
          // Une ligne datée dans le passé est terminée ; une ligne sans date
          // reste à planifier — les états que l'application écrit vraiment.
          statut: date === null ? "a_planifier" : "terminee",
          date_planifiee: date,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
        },
      });
    }
    await client.site.create({
      data: {
        id: SITE_SANS_INTERVENTION,
        societe_id: societe.id,
        client_id: clientActif.id,
        agence_id: agence.id,
        libelle: "Lieu jamais visité (épreuve HISTORIQUE-SITE-1)",
        temps_trajet_min: 10,
      },
    });

    // LE TÉMOIN — treize en base sur l'un, dont trois sans date ; zéro sur
    // l'autre. Sans lui, une scène qui n'aurait rien posé ferait passer
    // « douze lignes » pour une borne alors que ce serait tout, et « aucune »
    // pour une absence alors que ce serait une panne.
    const enBase = await client.intervention.count({
      where: { site_id: SITE_AVEC_HISTORIQUE },
    });
    expect(enBase).toBe(EN_BASE);
    expect(enBase).toBeGreaterThan(INTERVENTIONS_MONTREES);
    expect(
      await client.intervention.count({
        where: { site_id: SITE_AVEC_HISTORIQUE, date_planifiee: null },
      }),
    ).toBe(SANS_DATE);
    expect(
      await client.intervention.count({
        where: { site_id: SITE_SANS_INTERVENTION },
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
    await client.site.deleteMany({
      where: { id: { in: [SITE_AVEC_HISTORIQUE, SITE_SANS_INTERVENTION] } },
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

test("UN SITE À TREIZE INTERVENTIONS : la fiche en rend DOUZE, la plus récente en tête, la file d'attente en bas, la borne écrite", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_AVEC_HISTORIQUE}`);
  await expect(page.locator("main")).toBeVisible();
  // La capture PRÉCÈDE l'assertion : c'est l'image de l'écran tel qu'il est,
  // avec ou sans le bloc.
  mesure.fiches.avec_historique = {
    url: `/sites/${SITE_AVEC_HISTORIQUE}`,
    interventions_en_base: scene.enBase,
  };
  await capturer(page, "site-avec-interventions");

  const bloc = page.locator('[data-bloc="historique-site"]');
  await expect(bloc).toBeVisible();

  // TREIZE en base, DOUZE rendues : la borne tronque, et c'est visible.
  const lignes = bloc.locator("tbody tr");
  await expect(lignes).toHaveCount(INTERVENTIONS_MONTREES);

  // Chaque ligne porte une référence qui MÈNE à la fiche de l'intervention.
  await expect(
    lignes.first().locator('a[href^="/interventions/"]'),
  ).toBeVisible();

  // LA PLUS RÉCENTE EN TÊTE, et la FILE D'ATTENTE EN BAS — lu sur les dates
  // rendues, jamais supposé : une ligne sans date n'a pas de ligne datée
  // sous elle, et deux lignes datées vont du plus récent au plus ancien.
  const dates = (await lignes.locator("td:nth-child(2)").allInnerTexts()).map(
    rangDeLaDate,
  );
  // Dix datées puis deux « — » : la treizième (sans date) est celle que la
  // borne a coupée — jamais une datée.
  const premiereSansDate = dates.findIndex((d) => d === null);
  expect(premiereSansDate).toBe(DATEES);
  expect(dates.slice(premiereSansDate).every((d) => d === null)).toBe(true);
  const datees = dates.slice(0, premiereSansDate) as number[];
  expect(datees[0]).toBe(Number(`${PREMIERE_ANNEE + DATEES - 1}0101`));
  for (let i = 1; i < datees.length; i += 1) {
    expect(datees[i]!).toBeLessThan(datees[i - 1]!);
  }

  // LA BORNE EST ÉCRITE à côté du tableau, avec son nombre : l'écran ne
  // laisse pas croire qu'il montre tout.
  const texteDuBloc = await bloc.innerText();
  expect(texteDuBloc).toContain(dictionnaire["sites.fiche.interventions"]!);
  expect(texteDuBloc).toContain(String(INTERVENTIONS_MONTREES));
  expect(texteDuBloc).not.toContain(
    dictionnaire["sites.fiche.interventions_vide"]!,
  );

  mesure.fiches.avec_historique = {
    ...mesure.fiches.avec_historique,
    lignes_rendues: await lignes.count(),
    dates_rendues: dates,
  };
  await capturer(page, "site-avec-interventions");
});

test("UN SITE SANS AUCUNE INTERVENTION dit son absence — ni tableau vide, ni zéro", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_SANS_INTERVENTION}`);
  await expect(page.locator("main")).toBeVisible();
  mesure.fiches.sans_intervention = { url: `/sites/${SITE_SANS_INTERVENTION}` };
  await capturer(page, "site-sans-intervention");

  const bloc = page.locator('[data-bloc="historique-site"]');
  await expect(bloc).toBeVisible();
  await expect(bloc.locator("tbody tr")).toHaveCount(0);
  const texteDuBloc = await bloc.innerText();
  expect(texteDuBloc).toContain(
    dictionnaire["sites.fiche.interventions_vide"]!,
  );

  mesure.fiches.sans_intervention = {
    ...mesure.fiches.sans_intervention,
    lignes_rendues: await bloc.locator("tbody tr").count(),
    absence_rendue: dictionnaire["sites.fiche.interventions_vide"],
  };
  await capturer(page, "site-sans-intervention");
});
