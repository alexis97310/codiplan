import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * UNE VÉRIFICATION EN RETARD EST VUE — À L'ACCUEIL ET AU REGISTRE (VGP-2).
 *
 * ## LE CONSTAT, MESURÉ SUR LE CODE DU 22/09
 *
 * `joursAvantEcheance` (`lib/vgp/information.ts`) est NÉGATIF quand l'échéance
 * est passée : le modèle le sait. Deux écrans jetaient cette information :
 *
 * - le compteur d'accueil (`compterAPrevoir`) filtrait `>= 0` — une machine
 *   dépassée depuis huit mois comptait ZÉRO dans « VGP à prévoir » ;
 * - le registre peignait le badge d'état en VERT, du seul `etat`
 *   (`information_recue`) — le même vert qu'une machine dont l'échéance est
 *   dans dix mois.
 *
 * *Le seul cas où l'outil doit crier est précisément celui où il se tait.*
 *
 * ## CE QUE CE SPEC ÉPROUVE, SUR LA SCÈNE DU SEMIS (I9)
 *
 * `prisma/seed-data.ts` pose DEUX vérifications, et la seconde est
 * VOLONTAIREMENT ancienne : la machine `NUS-SPL-2022-0007` (pont, modèle
 * SPL-4000, rythme de six mois précisé au modèle) a été vérifiée il y a
 * quatorze mois — son échéance est passée depuis huit. La première,
 * `RAV-KPX-2019-0148` (douze mois à la famille), a été vérifiée il y a deux
 * mois : rien à prévoir sous trente jours. Aucune donnée n'est fabriquée ici :
 * le semis porte déjà le cas, il n'était vu nulle part.
 *
 * 1. `/tableau-de-bord` — la tuile « VGP à prévoir » NOMME la voie DÉPASSÉE,
 *    avec au moins une machine dedans, et sa valeur n'est plus zéro.
 * 2. `/vgp` — le badge d'état de la machine dépassée n'a PAS le ton de la
 *    machine à échéance lointaine, et porte le libellé qui dit la date passée.
 *
 * **Les captures sont prises AVANT les assertions** : sur le code d'avant le
 * lot, le spec rougit ET laisse les images « avant » — c'est ainsi que les
 * paires AVANT/APRÈS de `docs/propositions/12-VGP-2/` ont été produites.
 * `CAPTURES_VGP_2=<dossier>` les écrit, avec `mesure.json` (empreinte du
 * commit lue dans git, horodatage lu à l'horloge, ce que chaque écran a rendu).
 *
 * ## CE QUE « TON » VEUT DIRE ICI
 *
 * `Badge` (`components/ui/badge.tsx`) traduit un ton en un couple de classes
 * `bg-app-<ton>-fond text-app-<ton>-encre`. Le spec lit la classe du badge,
 * jamais une couleur : c'est le même repère que l'œil, à la source.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_VGP_2 ?? "";

/**
 * Une clé du dictionnaire, lue par son NOM et non par son type : ce spec doit
 * COMPILER sur le code d'avant le lot — celui que `next build` vérifie avant
 * de servir les captures « avant » —, où les clés `vgp_voie_*` et
 * `recue_echeance_depassee` n'existent pas encore. Une clé absente rend une
 * chaîne vide, et l'assertion rougit sur le mot attendu, jamais sur un type.
 */
function libelle(cle: string): string {
  return (fr as Record<string, string>)[cle] ?? "";
}

/** La machine dont l'échéance est passée, et celle dont elle ne l'est pas (semis). */
const MACHINE_DEPASSEE = "NUS-SPL-2022-0007";
const MACHINE_LOINTAINE = "RAV-KPX-2019-0148";

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  ecrans: Record<string, unknown>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  ecrans: {},
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

/** Le badge d'état de la ligne qui porte ce numéro de série. */
function badgeDeLaLigne(page: Page, numeroSerie: string) {
  return page
    .locator("tr", { hasText: numeroSerie })
    .first()
    .locator("span.rounded-\\[20px\\]")
    .first();
}

/** Le ton d'un badge, lu dans ses classes — `vert`, `rouge`, `orange`, `gris`, `bleu`. */
async function tonDuBadge(page: Page, numeroSerie: string): Promise<string> {
  const classes =
    (await badgeDeLaLigne(page, numeroSerie).getAttribute("class")) ?? "";
  const ton = /bg-app-([a-z]+)-fond/.exec(classes);
  return ton?.[1] ?? "";
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("TABLEAU DE BORD : la tuile « VGP à prévoir » nomme la voie DÉPASSÉE, et sa valeur n'est pas zéro", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  const tuile = page.locator('[data-bloc="kpi-vgp"]');
  await expect(tuile).toBeVisible();
  const texte = (await tuile.innerText()).replace(/\s+/g, " ").trim();
  mesure.ecrans.tableau_de_bord = { tuile_vgp: texte };
  await capturer(page, "tableau-de-bord");

  // La voie DÉPASSÉE est NOMMÉE dans la tuile — jamais un zéro qui se lit
  // comme « rien à faire ». Le semis en porte exactement UNE.
  expect(texte).toContain(
    `1 ${libelle("tableau_de_bord.vgp_voie_depassee_une")}`,
  );
  // Et les deux autres voies sont nommées à côté : la tuile dit ce qu'elle
  // sait de chaque date, jamais un seul chiffre.
  expect(texte).toContain(libelle("tableau_de_bord.vgp_voie_sans_information"));
  expect(texte).toContain(libelle("tableau_de_bord.vgp_voie_a_venir_prefixe"));
  // La valeur de la tuile — le grand chiffre — n'est plus « 0 » : la machine
  // dépassée y entre.
  const valeur = (
    await page
      .locator('[data-bloc="kpi-vgp"] .text-\\[27px\\]')
      .first()
      .innerText()
  ).trim();
  expect(Number(valeur)).toBeGreaterThan(0);
});

test("REGISTRE : la machine dépassée ne porte pas le ton de la machine à échéance lointaine", async ({
  page,
}) => {
  await page.goto("/vgp");
  await expect(badgeDeLaLigne(page, MACHINE_DEPASSEE)).toBeVisible();
  await expect(badgeDeLaLigne(page, MACHINE_LOINTAINE)).toBeVisible();

  const tonDepassee = await tonDuBadge(page, MACHINE_DEPASSEE);
  const tonLointaine = await tonDuBadge(page, MACHINE_LOINTAINE);
  const libelleDepassee = (
    await badgeDeLaLigne(page, MACHINE_DEPASSEE).innerText()
  ).trim();
  const libelleLointaine = (
    await badgeDeLaLigne(page, MACHINE_LOINTAINE).innerText()
  ).trim();
  mesure.ecrans.vgp = {
    depassee: {
      machine: MACHINE_DEPASSEE,
      ton: tonDepassee,
      libelle: libelleDepassee,
    },
    lointaine: {
      machine: MACHINE_LOINTAINE,
      ton: tonLointaine,
      libelle: libelleLointaine,
    },
  };
  await capturer(page, "vgp");

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : une information reçue
  // dont l'échéance n'est pas passée garde le ton et le libellé d'avant.
  expect(tonLointaine).toBe("vert");
  expect(libelleLointaine).toBe(libelle("vgp.information.recue"));
  // ET LE CAS QUI ROUGIT : le retard n'est ni vert, ni le même mot.
  expect(tonDepassee).not.toBe(tonLointaine);
  expect(tonDepassee).toBe("rouge");
  expect(libelleDepassee).toBe(
    libelle("vgp.information.recue_echeance_depassee"),
  );
});
