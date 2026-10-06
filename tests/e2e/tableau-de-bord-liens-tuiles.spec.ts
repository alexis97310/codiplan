import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  cleJour,
  jourDe,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 98-TABLEAU-2 — CHAQUE TUILE DU TABLEAU DE BORD MÈNE À LA LISTE QU'ELLE
 * COMPTE.
 *
 * ## Le constat
 *
 * L'audit d'ergonomie du 25/09/2026 (constat 4) relevait trois tuiles
 * inertes — « Interventions aujourd'hui », « Dossiers bloqués », « Techniciens
 * indisponibles » — et des liens secondaires de 11,5 px de texte et ~17 px de
 * haut, sous le seuil tactile.
 *
 * ## Ce que ce fichier éprouve
 *
 * 1. La tuile « Interventions aujourd'hui » ouvre la vue jour du planning, au
 *    jour même — la même forme d'URL que `retourPlanning`
 *    (`app/(back-office)/interventions/presentation.ts`).
 * 2. La tuile « Techniciens indisponibles » ouvre les blocages d'agenda, sur
 *    la semaine qui contient aujourd'hui — `/absences` n'affichant qu'une
 *    semaine, jamais un jour seul.
 * 3. « Dossiers bloqués » PORTE DÉSORMAIS UN LIEN (99V-GR6-TUILES, audit du
 *    26/09/2026, constat G7) — son ABSENCE, mesurée par 98-TABLEAU-2, tenait à
 *    ce que le total de la tuile venait d'`enAttenteDePiece`
 *    (`piece_attendue_ref` non nul), plus étroit que l'onglet « Bloquées » du
 *    registre (`statut === "suspendue"`, qui admet une suspension sans
 *    attente de pièce) : un lien aurait ouvert une liste plus large que le
 *    compte affiché. Le total de la tuile vient maintenant de `compterParVue`,
 *    le MÊME critère que l'onglet — ce fichier éprouve que les deux nombres,
 *    lus dans le même passage, sont ÉGAUX, et que le lien ouvre bien cet
 *    onglet.
 * 4. Tous les liens de tuile — anciens et neufs — tiennent 13 px de texte et
 *    une zone cliquable d'au moins 32 px de haut.
 *
 * ## Lecture seule
 *
 * Aucune donnée n'est créée ni modifiée : la seule écriture Prisma de ce
 * fichier est la lecture du fuseau de CODIMA-NC, pour calculer LE MÊME
 * « aujourd'hui » que la page rend côté serveur — jamais une date écrite en
 * dur, qui périmerait le scénario au jour suivant.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const FENETRE = { width: 1280, height: 900 };

/** `CAPTURES_TABLEAU_2=<dossier>` écrit l'écran, pour `docs/propositions/`. */
const DOSSIER_CAPTURES = process.env.CAPTURES_TABLEAU_2 ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

let aujourdHui: JourLocal;
let cleAujourdHui: string;
let cleLundiCourant: string;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { fuseau_horaire: true },
    });
    aujourdHui = jourDe(maintenant(societe.fuseau_horaire).local);
    cleAujourdHui = cleJour(aujourdHui);
    cleLundiCourant = cleJour(lundiDeLaSemaine(aujourdHui));
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
});

/** La zone cliquable d'un lien de tuile — texte 13 px, hauteur >= 32 px. */
async function verifierZoneCliquable(
  page: Page,
  lien: ReturnType<Page["locator"]>,
) {
  await expect(lien).toBeVisible();
  const tailleTexte = await lien.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  expect(tailleTexte).toBe("13px");
  const boite = await lien.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeGreaterThanOrEqual(32);
}

test("« Interventions aujourd'hui » ouvre la vue jour du planning, au jour même", async ({
  page,
}) => {
  const lien = page.getByRole("link", {
    name: fr["tableau_de_bord.lien_interventions_jour"],
  });
  await expect(lien).toHaveAttribute(
    "href",
    `/planning?vue=jour&jour=${cleAujourdHui}`,
  );
  await verifierZoneCliquable(page, lien);
  await capturer(page, "tableau-de-bord");

  await lien.click();
  await page.waitForURL(`/planning?vue=jour&jour=${cleAujourdHui}`);
  // La page RENDUE, pas seulement l'URL atteinte (I5, une 404 changerait
  // aussi l'URL) : la vue jour du planning porte ce marqueur.
  await expect(page.locator('[data-maquette-bloc="vue-jour"]')).toBeVisible();
});

test("« Techniciens indisponibles » ouvre les blocages d'agenda, sur la semaine courante", async ({
  page,
}) => {
  const lien = page.getByRole("link", {
    name: fr["tableau_de_bord.lien_absences_jour"],
  });
  await expect(lien).toHaveAttribute(
    "href",
    `/absences?semaine=${cleLundiCourant}`,
  );
  await verifierZoneCliquable(page, lien);

  await lien.click();
  await page.waitForURL(`/absences?semaine=${cleLundiCourant}`);
  await expect(page.locator('[data-bloc="calendrier"]')).toBeVisible();
});

/** Le premier nombre isolé sur sa propre ligne, dans un texte rendu multi-lignes. */
function premierNombreIsole(texte: string): number | null {
  const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
  return correspondance === null ? null : Number(correspondance[1]);
}

/** Le lien de LA TUILE elle-même — son premier enfant direct (même recette que `tuiles-cliquables.spec.ts`). */
function lienDeLaTuile(tuile: ReturnType<Page["locator"]>) {
  return tuile.locator("> div, > a").first();
}

test("« Dossiers bloqués » compte EXACTEMENT ce que l'onglet « Bloquées » du registre montre, et y mène", async ({
  page,
}) => {
  // LE LIEN ÉPROUVÉ EST CELUI DE LA TUILE ELLE-MÊME (décision d'Alexis du
  // 30/09/2026, point 12 ; D144) — le lien texte qui la doublait a été
  // retiré ; la tuile est cliquable depuis D140.
  const tuile = page.locator('[data-bloc="kpi-bloques"]');
  await expect(tuile).toBeVisible();

  const lien = lienDeLaTuile(tuile);
  await expect(lien).toHaveAttribute("href", "/interventions?vue=bloquees");
  const boite = await lien.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeGreaterThanOrEqual(32);

  // LA VALEUR DE LA TUILE, LUE DANS LE RENDU — jamais un nombre absolu
  // (fullyParallel) : elle est comparée, deux lignes plus bas, à l'onglet
  // qu'elle nomme, lu dans le MÊME passage.
  const valeurTuile = premierNombreIsole(await tuile.innerText());
  expect(valeurTuile).not.toBeNull();

  await lien.click();
  await page.waitForURL("/interventions?vue=bloquees");
  // LE COMPTEUR DE L'ONGLET EST LU SUR `[data-compte]` (TP-UX3-1-REGISTRE-1),
  // jamais parsé depuis un texte rendu « Libellé (N) ».
  const ongletActif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  await expect(ongletActif).toContainText(fr["interventions.vue.bloquees"]);
  const compteOnglet = await ongletActif
    .locator("[data-compte]")
    .getAttribute("data-compte");
  expect(compteOnglet).not.toBeNull();

  expect(valeurTuile).toBe(Number(compteOnglet));
});

test("les liens déjà posés tiennent aussi 13 px et 32 px de haut", async ({
  page,
}) => {
  await verifierZoneCliquable(
    page,
    page.getByRole("link", {
      name: fr["tableau_de_bord.lien_charge_planning"],
    }),
  );
  await verifierZoneCliquable(
    page,
    page.getByRole("link", { name: fr["tableau_de_bord.lien_vgp_a_prevoir"] }),
  );
  await verifierZoneCliquable(
    page,
    page.getByRole("link", { name: fr["tableau_de_bord.lien_demandes"] }),
  );
  await verifierZoneCliquable(
    page,
    page.getByRole("link", {
      name: fr["tableau_de_bord.lien_interventions_sans_duree"],
    }),
  );
});
