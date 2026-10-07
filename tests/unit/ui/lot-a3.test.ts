import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { colonnesDuRegistre } from "@/app/(back-office)/interventions/presentation";

/**
 * LE GARDIEN DE COMPOSITION — LOT A3, `/interventions` contre `interventions()`
 * de `docs/maquette/codiplan-maquette-complete.html` (D125, D128).
 *
 * ## CE QUE CE FICHIER MESURE, ET DANS QUEL ÉTAT IL A TROUVÉ L'ÉCRAN
 *
 * L'audit du 19/09/2026 (`docs/audits/2026-09-19-ecrans.md`, section
 * « Interventions ») a mesuré CET écran sur le commit `f30d554` : bloc KPI
 * absent, colonnes Machine et Priorité absentes de la table (6 colonnes
 * réelles contre 7 attendues). **Ce commit n'est pas celui de ce lot.**
 * `main` a avancé de six propositions entre l'audit et l'ouverture de cette
 * branche, et l'une d'elles (#236, « Lot PARC… ») a comblé ces trois écarts
 * SANS le dire dans son titre — mesuré ici avant d'écrire une seule ligne
 * (`git blame`, `git log -p` sur `page.tsx`, comparé à l'audit) plutôt que
 * supposé : le bloc KPI, la colonne Priorité (badge) et la colonne Machine
 * existent déjà sur le commit de départ de ce lot (`00bc753`).
 *
 * **Ce que ce gardien mesure donc RÉELLEMENT, en accord avec le §9 du
 * CLAUDE.md (« avant d'affirmer un état sans l'avoir observé ») :**
 *
 * 1. Un TÉMOIN DE NON-VACUITÉ : la maquette dessine bien les quatre blocs
 *    dont ce lot répond, pour que ce fichier ne mesure jamais du vide.
 * 2. BLOC 3 (grille de 3 KPI) et BLOC 4 (colonnes Machine/Priorité) : déjà
 *    conformes en entrant dans ce lot — gardés ici pour qu'une régression
 *    future les fasse échouer, pas pour prouver un travail qui n'est pas le
 *    mien.
 * 3. Le SEUL écart de disposition réel restant, mesuré et corrigé PAR ce
 *    lot : **la colonne Machine ne suit pas directement Client** comme dans
 *    la maquette — elle suivait Site (l'ajout réel, D128), inversé par
 *    rapport à la maquette. Avant correction : `rangSite < rangMachine`
 *    (Site précède Machine). Après : `rangMachine < rangSite` — Machine
 *    reprend sa place immédiatement après Client (D125), Site (donnée réelle
 *    absente de la maquette, jamais supprimée, D128) la suit.
 *
 * ## CE QUE CE LOT N'A PAS TOUCHÉ, ET POURQUOI (écarts nommés, D128)
 *
 * **« Bouton Exporter » comblé le 05/10/2026 (MO-9, D169)** — retiré de
 * cette liste, qui ne porte plus que des écarts VIVANTS.
 *
 * - **Détail des 3 KPI** (la maquette écrit une deuxième ligne sous chaque
 *   nombre, ex. « 4 techniciens ») — `Kpi` porte déjà un prop `detail`
 *   (`components/ui/kpi.tsx`), mais aucune des trois valeurs illustratives
 *   de la maquette n'est un FAIT calculable aujourd'hui (nombre de
 *   techniciens actifs cette semaine, notion de « compteur actif », seuil
 *   des 30 jours sur une pièce) : les inventer violerait le §8 du CLAUDE.md
 *   (« ne jamais inventer... une valeur par défaut »). Écart de DONNÉES,
 *   pas de design — non comblé ici.
 * - **La barre d'outils** (recherche + 4 filtres + bouton, contre 1 champ +
 *   2 select dans la maquette) — AT-07/AT-07 bis, une règle de gestion déjà
 *   arbitrée (D128 : elle bat D125).
 */

const RACINE = process.cwd();

function reel(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

const MAQUETTE = reel("docs/maquette/codiplan-maquette-complete.html");

function fonctionMaquette(debutMarqueur: string, finMarqueur: string): string {
  const debut = MAQUETTE.indexOf(debutMarqueur);
  const fin = MAQUETTE.indexOf(finMarqueur);
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      `\`${debutMarqueur}\` est introuvable, ou plus bornée par \`${finMarqueur}\` — ` +
        "docs/maquette/codiplan-maquette-complete.html a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

const BLOC_INTERVENTIONS = fonctionMaquette(
  "function interventions(){",
  "function absences(){",
);

const PAGE = reel("app/(back-office)/interventions/page.tsx");
// `machinesAffichees` a déménagé dans `presentation.ts` le 19/09/2026 : la
// fiche d'intervention la réutilise désormais elle aussi, et une seule
// écriture sert les deux écrans plutôt que d'en recopier une cinquième.
const PRESENTATION = reel("app/(back-office)/interventions/presentation.ts");

describe("le gardien de composition — /interventions contre interventions() (lot A3, D125/D128)", () => {
  it("TÉMOIN DE NON-VACUITÉ — la maquette dessine réellement les quatre blocs mesurés ici", () => {
    expect(BLOC_INTERVENTIONS, "bloc 2 — barre d'outils").toContain(
      'class="toolbar"',
    );
    expect(BLOC_INTERVENTIONS, "bloc 3 — grille de 3 KPI").toContain(
      'class="grid g3"',
    );
    expect(BLOC_INTERVENTIONS, "bloc 3 — premier KPI").toContain(
      "Planifiées cette semaine",
    );
    expect(BLOC_INTERVENTIONS, "bloc 4 — colonne Machine").toContain(
      "<th>Machine</th>",
    );
    expect(BLOC_INTERVENTIONS, "bloc 4 — colonne Priorité").toContain(
      "<th>Priorité</th>",
    );
  });

  // BLOC 3 (grille de 3 KPI) EST RETIRÉ (TP-UX3-1-REGISTRE-1, QE-8, D174) —
  // les trois tuiles que ce lot gardait ont été retirées par ce ticket, au
  // profit des compteurs portés par les onglets eux-mêmes
  // (`components/interventions/onglets-registre.tsx`) : il n'y a plus rien
  // à garder ici.

  it("BLOC 4 — la priorité est un badge coloré, jamais un texte nu (devenue <Priorite court/>, TP-UX3-1-REGISTRE-2, QE-8 (a))", () => {
    // Mesuré en entrant dans TP-UX3-1-REGISTRE-2 : `<Badge ton={tonDePriorite(…)}>`
    // a été remplacé par `<Priorite valeur={ligne.priorite} court />` — le
    // composant partagé que 9EA-1 a posé pour ce registre (`components/ui/
    // priorite.tsx`) sans jamais l'y appeler. La couleur ne s'écrit plus en
    // clair dans `page.tsx` : elle vit désormais dans ce seul composant.
    expect(PAGE).toContain("<Priorite valeur={ligne.priorite} court");
    const PRIORITE = reel("components/ui/priorite.tsx");
    expect(PRIORITE).toContain("tonDePriorite(");
  });

  it("BLOC 4 — la machine est restituée (déjà comblé, #236), et sa règle multi-machines est ÉCRITE, jamais implicite", () => {
    expect(PAGE).toContain("machinesAffichees(ligne, libellesMachines)");
    expect(PRESENTATION).toContain("export function machinesAffichees(");
    expect(PRESENTATION).toContain("LA RÈGLE RETENUE POUR PLUSIEURS MACHINES");
    // La règle retenue : chaque exemplaire par son MODÈLE (jamais son numéro
    // de série), jointes par une virgule, sans troncature (chapitre 11.3 ne
    // borne pas le nombre de machines par intervention).
    expect(PRESENTATION).toContain('.join(", ")');
  });

  // REMPLACÉE par TP-UX3-1-REGISTRE-2 (QE-8 (a), D137) : « Machine », « Site »,
  // « Référence » et « Date planifiée » ne sont plus des COLONNES À PART — le
  // registre porte désormais un jeu de colonnes PAR ONGLET
  // (`colonnesDuRegistre`, `./presentation.ts`), et la maquette du 28/09
  // (`docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`,
  // D137) REMPLACE celle du 19/09 que ce fichier citait — elle dessine
  // « Intervention » (référence + nature + machines) AVANT « Client · site »,
  // l'ordre INVERSE de l'ancienne maquette. Ce test vérifie donc la colonne
  // de l'onglet « Toutes » — celle qui se rapproche le plus de l'ancien
  // tableau à plat — contre `colonnesDuRegistre`, la SEULE écriture de cet
  // ordre désormais (§9, 01/09 : jamais une seconde liste qui pourrait
  // diverger).
  it("BLOC 4 (REMPLACÉ, TP-UX3-1-REGISTRE-2, QE-8 (a)) — l'onglet « Toutes » place Intervention (qui porte la machine) avant Client · Site, Statut avant Prio.", () => {
    const colonnesToutes = colonnesDuRegistre("toutes").map((c) => c.cle);
    const rangDate = colonnesToutes.indexOf("date");
    const rangIntervention = colonnesToutes.indexOf("intervention");
    const rangClientSite = colonnesToutes.indexOf("client_site");
    const rangTechnicien = colonnesToutes.indexOf("technicien");
    const rangStatut = colonnesToutes.indexOf("statut");
    const rangPrio = colonnesToutes.indexOf("prio");

    for (const rang of [
      rangDate,
      rangIntervention,
      rangClientSite,
      rangTechnicien,
      rangStatut,
      rangPrio,
    ]) {
      expect(rang).toBeGreaterThan(-1);
    }
    expect(rangIntervention, "Intervention suit Date").toBeGreaterThan(
      rangDate,
    );
    expect(
      rangClientSite,
      "Client · Site suit Intervention (ordre INVERSÉ de l'ancienne maquette)",
    ).toBeGreaterThan(rangIntervention);
    expect(rangStatut, "Statut suit Technicien").toBeGreaterThan(
      rangTechnicien,
    );
    expect(rangPrio, "Prio. reste la dernière colonne").toBeGreaterThan(
      rangStatut,
    );

    // La CELLULE « Intervention » appelle toujours `machinesAffichees`
    // (déjà comblé, #236 ; jamais retiré par ce ticket) — gardé ici plutôt
    // que supposé.
    expect(PAGE).toContain("machinesAffichees(ligne, libellesMachines)");
  });
});
