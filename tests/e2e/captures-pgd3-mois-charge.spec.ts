import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import {
  cleJour,
  instantAMinutes,
  instantDuJour,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { estJourOuvre, type Calendrier } from "@/lib/calendar";
import { uuidv7 } from "@/lib/db/uuid";
import {
  ligneMesureReadme,
  mesurer,
  type VerdictMesure,
} from "../../scripts/lib/mesure-captures";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-D3-MOIS-CHARGE (9CI-PG-G12-DEUX-SEMAINES-MOIS).
 *
 * **AVANT/APRÈS EN UN SEUL FICHIER, PAR DÉTECTION** (même patron que
 * `captures-pgd2-deux-semaines.spec.ts`) : `?vue=mois` retombe sur la Semaine
 * sur le code d'AVANT ce commit — aucune case `[data-mois-jour]` — et rend la
 * grille du Mois sur le code livré.
 *
 * SA PROPRE SCÈNE, préfixée `PGD3CAP-` — un client, un site, une intervention
 * posée sur le technicien DUCOS de la scène de démonstration
 * (`reperesDeLaScene`), sur le premier jour ouvert d'un MOIS FUTUR (celui qui
 * suit le mois de la semaine +1), jamais une fixture `SCENE.*`.
 *
 * Cette scène ne porte PAS de jour à plus de 100 % — le cas « dépassement »
 * est prouvé par `tests/unit/planning/teinte-charge.test.ts`, pas ici.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGD3 ?? "";
const PREFIXE = "PGD3CAP-";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let premierDuMois: JourLocal;
let jourIntervention: JourLocal;
let technicienId: string;
let scene: { interventionId: string; clientId: string; siteId: string };
const mesures: VerdictMesure[] = [];

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienId = reperes.technicienDucos;
  const lundiPlus1 = jourSuivant(reperes.lundi, 7);
  const moisSuivant = new Date(Date.UTC(lundiPlus1.annee, lundiPlus1.mois, 1));
  premierDuMois = {
    annee: moisSuivant.getUTCFullYear(),
    mois: moisSuivant.getUTCMonth() + 1,
    jour: 1,
  };
  const nombreDeJours = new Date(
    Date.UTC(premierDuMois.annee, premierDuMois.mois, 0),
  ).getUTCDate();

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const calendrier: Calendrier | null = await chargerCalendrierAgence(
      client,
      {
        societeId: reperes.societeId,
        agenceId: agence.id,
        fenetre: {
          du: premierDuMois,
          au: jourSuivant(premierDuMois, nombreDeJours),
        },
      },
    );
    let candidat = premierDuMois;
    while (calendrier === null || !estJourOuvre(calendrier, candidat)) {
      candidat = jourSuivant(candidat, 1);
    }
    jourIntervention = candidat;

    const interventionId = uuidv7();
    const clientId = uuidv7();
    const siteId = uuidv7();
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: `${PREFIXE}Site`,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p2",
        statut: "planifiee",
        date_planifiee: instantDuJour(jourIntervention),
        creneau_debut: instantAMinutes(jourIntervention, 480, reperes.fuseau),
        creneau_fin: instantAMinutes(jourIntervention, 570, reperes.fuseau),
        duree_estimee_min: 90,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    scene = { interventionId, clientId, siteId };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  } finally {
    await client.$disconnect();
  }
  if (DOSSIER !== "" && mesures.length > 0) {
    mkdirSync(DOSSIER, { recursive: true });
    writeFileSync(
      join(DOSSIER, "mesure.md"),
      ligneMesureReadme(mesures).join("\n") + "\n",
    );
  }
});

const SCRIPT_MESURE = `(() => {
  const description = (element) => {
    const identifiant = element.id === "" ? "" : "#" + element.id;
    const classes =
      typeof element.className === "string" && element.className.trim() !== ""
        ? "." + element.className.trim().split(/\\s+/).slice(0, 2).join(".")
        : "";
    return element.tagName.toLowerCase() + identifiant + classes;
  };
  const debut = (element) =>
    (element.innerText ?? element.textContent ?? "")
      .trim()
      .replace(/\\s+/g, " ")
      .slice(0, 40);
  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const textes = [];
  for (const element of document.body.querySelectorAll("*")) {
    const porteDuTexteDirect = Array.from(element.childNodes).some(
      (noeud) =>
        noeud.nodeType === Node.TEXT_NODE &&
        (noeud.textContent ?? "").trim() !== "",
    );
    if (!porteDuTexteDirect || !visible(element)) {
      continue;
    }
    textes.push({
      element: description(element),
      taille: parseFloat(getComputedStyle(element).fontSize),
      debut: debut(element),
    });
  }
  return {
    textes,
    cibles: [],
    debordement:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  };
})()`;

async function mesurerEtCapturer(
  page: Page,
  ecran: string,
  largeur: number,
  erreursConsole: readonly string[],
): Promise<void> {
  const brut = (await page.evaluate(SCRIPT_MESURE)) as {
    textes: { element: string; taille: number; debut: string }[];
    cibles: never[];
    debordement: number;
  };
  mesures.push(
    mesurer({
      ecran,
      largeur,
      terrain: false,
      textes: brut.textes,
      cibles: [],
      debordement: brut.debordement,
      erreurs: [...erreursConsole],
    }),
  );
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 1024, 375]) {
  test(`capture — vue Mois, à ${largeur}px`, async ({ page }) => {
    const erreursConsole: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error")
        erreursConsole.push(message.text().slice(0, 200));
    });
    page.on("pageerror", (erreur) =>
      erreursConsole.push(String(erreur).slice(0, 200)),
    );

    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/planning?vue=mois&jour=${cleJour(premierDuMois)}`);
    await expect(page.locator("main")).toBeVisible();
    const surLeCodeLivre = (await page.locator("[data-mois-jour]").count()) > 0;
    const nomMois = surLeCodeLivre ? "mois-apres" : "mois-avant";
    await mesurerEtCapturer(page, nomMois, largeur, erreursConsole);

    if (surLeCodeLivre) {
      const cellule = page.locator(
        `[data-mois-jour="${cleJour(jourIntervention)}"][data-mois-technicien="${technicienId}"]`,
      );
      await cellule.click();
      await expect(page).toHaveURL(/vue=jour/);
      await expect(page.locator("main")).toBeVisible();
      await mesurerEtCapturer(
        page,
        "mois-clic-vue-jour",
        largeur,
        erreursConsole,
      );
    }
  });
}
