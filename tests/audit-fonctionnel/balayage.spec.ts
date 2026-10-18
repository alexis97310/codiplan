import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { estUuid } from "@/lib/identifiant";

import { ouvrirLaSessionSensible } from "../e2e/setup/session";
import {
  fermerCompteDirectionAudit,
  ouvrirCompteDirectionAudit,
  ROLES_BALAYAGE,
} from "./comptes";
import { instrumenter, type MesurePage } from "./mesures";

/**
 * LE BALAYAGE PAR RÔLE (9F5-AUDIT-FONCTIONNEL-PARCOURS, point 2).
 *
 * Pour chaque rôle disponible, part du point d'entrée et suit TOUS les liens
 * internes `a[href]` atteignables, SANS JAMAIS soumettre de formulaire — un
 * lien ne change rien par lui-même (GET), à la différence d'un bouton. La
 * déduplication se fait sur le CHEMIN, segments d'identifiant (UUID) remplacés
 * par `:id` : sans cela, chaque fiche (client, site, machine…) compterait
 * comme un écran NEUF, et le balayage ne terminerait jamais sur une base dont
 * le semis pose des dizaines de lignes.
 *
 * Les paramètres de requête (`?ajouter=1&type=technicien`, par exemple) sont
 * délibérément ignorés par le balayage automatique — un état d'écran ouvert
 * par un paramètre est un comportement à viser PAR UN PARCOURS SCRIPTÉ (point
 * 3), jamais par un robot qui ne sait pas qu'un paramètre a un sens.
 */

const MAX_PAGES_PAR_ROLE = 80;
const DOSSIER_RAPPORT = join(process.cwd(), "docs/audits/9F5-fonctionnel");

const CHEMINS_INTERDITS = [
  /^\/connexion/,
  /^\/enrolement/,
  /^\/premier-acces/,
  /^\/reset-password/,
  /deconnexion/i,
  /logout/i,
  // `/api/.../exporter` ne rend aucune page — c'est un téléchargement, et
  // `page.goto` le voit comme un échec de navigation (« Download is
  // starting ») plutôt que comme un écran. Pas un écran, donc hors du
  // balayage — ce n'est pas une suppression de constat, juste un chemin qui
  // ne mesure rien ici.
  /^\/api\//,
];

function normaliser(chemin: string): string {
  return chemin
    .split("/")
    .map((segment) => (estUuid(segment) ? ":id" : segment))
    .join("/");
}

function estInterne(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function estAutorise(chemin: string): boolean {
  return !CHEMINS_INTERDITS.some((motif) => motif.test(chemin));
}

type ResultatRole = {
  readonly role: string;
  readonly email: string;
  readonly pointEntree: string;
  readonly pages: MesurePage[];
  readonly plafondAtteint: boolean;
};

const resultats: ResultatRole[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await ouvrirCompteDirectionAudit();
});

test.afterAll(async () => {
  await fermerCompteDirectionAudit();

  mkdirSync(DOSSIER_RAPPORT, { recursive: true });
  writeFileSync(
    join(DOSSIER_RAPPORT, "balayage.json"),
    JSON.stringify(resultats, null, 2),
    "utf8",
  );

  const lignes: string[] = [
    "# Balayage par rôle — 9F5-AUDIT-FONCTIONNEL-PARCOURS",
    "",
    "Généré par `pnpm audit:fonctionnel` (`tests/audit-fonctionnel/balayage.spec.ts`).",
    "Un lien suivi est une navigation GET ; aucun formulaire n'est soumis.",
    "",
    "| Rôle | Pages visitées | Plafond atteint | Pages en erreur (4xx/5xx) | Erreurs console | Erreurs page | Boutons sans nom | Champs sans label |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const resultat of resultats) {
    const pagesEnErreur = resultat.pages.filter(
      (p) => p.statutNavigation !== null && p.statutNavigation >= 400,
    ).length;
    const erreursConsole = resultat.pages.reduce(
      (total, p) => total + p.erreursConsole.length,
      0,
    );
    const erreursPage = resultat.pages.reduce(
      (total, p) => total + p.erreursPage.length,
      0,
    );
    const boutonsSansNom = resultat.pages.reduce(
      (total, p) => total + p.boutonsSansNomAccessible,
      0,
    );
    const champsSansLabel = resultat.pages.reduce(
      (total, p) => total + p.champsSansLabel,
      0,
    );
    lignes.push(
      `| ${resultat.role} | ${resultat.pages.length} | ${resultat.plafondAtteint ? "oui" : "non"} | ${pagesEnErreur} | ${erreursConsole} | ${erreursPage} | ${boutonsSansNom} | ${champsSansLabel} |`,
    );
  }
  lignes.push("");
  lignes.push("## Détail des pages en erreur (4xx/5xx)");
  lignes.push("");
  let auMoinsUne = false;
  for (const resultat of resultats) {
    for (const page of resultat.pages) {
      if (page.statutNavigation !== null && page.statutNavigation >= 400) {
        auMoinsUne = true;
        lignes.push(
          `- **${resultat.role}** — \`${page.url}\` → ${page.statutNavigation}`,
        );
      }
    }
  }
  if (!auMoinsUne) {
    lignes.push("Aucune.");
  }
  writeFileSync(
    join(DOSSIER_RAPPORT, "balayage.md"),
    lignes.join("\n") + "\n",
    "utf8",
  );
});

for (const { cle, email } of ROLES_BALAYAGE) {
  test(`balayage — ${cle}`, async ({ page }) => {
    test.setTimeout(240_000);

    const mesure = instrumenter(page);

    mesure.demarrerReleve();
    const debutConnexion = Date.now();
    await ouvrirLaSessionSensible(page, email);
    const pointEntree = new URL(page.url()).pathname;

    const visites = new Set<string>();
    const enFile = new Set<string>();
    const file: string[] = [pointEntree];
    enFile.add(normaliser(pointEntree));
    const pages: MesurePage[] = [];
    let plafondAtteint = false;

    // La toute première page (le point d'entrée) a déjà chargé pendant
    // `ouvrirLaSessionSensible` : on la relève sans la recharger, pour ne pas
    // compter deux fois la même navigation dans les mesures.
    pages.push(await mesure.releve(pointEntree, debutConnexion, 200));

    while (file.length > 0) {
      const chemin = file.shift() as string;
      const normalise = normaliser(chemin);
      if (visites.has(normalise)) {
        continue;
      }
      visites.add(normalise);

      if (chemin !== pointEntree) {
        if (visites.size > MAX_PAGES_PAR_ROLE) {
          plafondAtteint = true;
          break;
        }
        mesure.demarrerReleve();
        const debut = Date.now();
        let reponse = null;
        try {
          reponse = await page.goto(chemin, { timeout: 30_000 });
        } catch (erreur) {
          pages.push({
            url: chemin,
            statutNavigation: null,
            dureeNavigationMs: Date.now() - debut,
            erreursConsole: [],
            erreursPage: [String(erreur)],
            reponsesEnEchec: [],
            requetesEnEchec: [],
            imagesCassees: [],
            boutonsSansNomAccessible: 0,
            champsSansLabel: 0,
          });
          continue;
        }
        try {
          await page.waitForLoadState("networkidle", { timeout: 10_000 });
        } catch {
          // Une page qui sonde en continu (compteur, calendrier) ne se tait
          // jamais : ce n'est pas une panne, le relevé se fait quand même.
        }
        pages.push(
          await mesure.releve(chemin, debut, reponse?.status() ?? null),
        );
      }

      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((liens) =>
          liens.map((lien) => lien.getAttribute("href") ?? ""),
        );
      for (const href of hrefs) {
        if (href.length === 0 || !estInterne(href)) {
          continue;
        }
        const sansFragment = href.split("#")[0];
        const sansParametres = sansFragment.split("?")[0];
        if (sansParametres.length === 0 || !estAutorise(sansParametres)) {
          continue;
        }
        const cible = normaliser(sansParametres);
        if (!visites.has(cible) && !enFile.has(cible)) {
          enFile.add(cible);
          file.push(sansParametres);
        }
      }
    }

    resultats.push({ role: cle, email, pointEntree, pages, plafondAtteint });

    // Ce scénario COLLECTE ; il ne fait pas rougir l'audit sur ses propres
    // constats (c'est l'objet du rapport, point 4) — seule une incapacité à
    // parcourir le rôle du tout (aucune page visitée) est un défaut du
    // harnais lui-même.
    expect(
      pages.length,
      `aucune page visitée pour le rôle ${cle}`,
    ).toBeGreaterThan(0);
  });
}
