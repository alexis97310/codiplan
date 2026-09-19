import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
 * - **Bouton « Exporter »** de l'en-tête (maquette : 2 boutons ; réel : 1) —
 *   aucune logique d'export n'existe dans le dépôt ; l'ajouter sans elle
 *   serait le bouton mort que le CLAUDE.md interdit (« pas de
 *   half-finished implementation »), pas une correction de disposition.
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

  it("BLOC 3 — la grille de trois cartes KPI porte les trois mêmes intitulés que la maquette (déjà comblé, #236)", () => {
    // La preuve porte sur la CLÉ i18n, jamais sur la chaîne recopiée
    // (Définition de « terminé » §5) : les trois clés existent et sont bien
    // celles que les 3 cartes du bandeau utilisent.
    const clesAttendues = [
      "interventions.kpi_semaine",
      "interventions.kpi_en_cours",
      "interventions.kpi_en_attente",
    ];
    for (const cle of clesAttendues) {
      expect(PAGE, cle).toContain(`t("${cle}")`);
    }
    // Trois cartes, la même grille à 3 colonnes que `.grid.g3` de la maquette.
    expect(PAGE).toContain("grid grid-cols-1 gap-4 sm:grid-cols-3");
    const rendues = [...PAGE.matchAll(/<Kpi\b/g)].length;
    expect(rendues, "3 <Kpi> attendus, autant que la maquette (.grid.g3)").toBe(
      3,
    );
  });

  it("BLOC 4 — la priorité est un badge coloré, jamais un texte nu (déjà comblé, #236)", () => {
    expect(PAGE).toContain("TONS_PRIORITE[ligne.priorite]");
    expect(PAGE).toContain('t("intervention.priorite")');
  });

  it("BLOC 4 — la machine est restituée (déjà comblé, #236), et sa règle multi-machines est ÉCRITE, jamais implicite", () => {
    expect(PAGE).toContain("function machinesAffichees(");
    expect(PAGE).toContain("LA RÈGLE RETENUE POUR PLUSIEURS MACHINES");
    // La règle retenue : chaque exemplaire par son MODÈLE (jamais son numéro
    // de série), jointes par une virgule, sans troncature (chapitre 11.3 ne
    // borne pas le nombre de machines par intervention).
    expect(PAGE).toContain('.join(", ")');
  });

  it("BLOC 4 — Machine suit directement Client, comme la maquette ; Site (ajout réel, D128) vient ensuite, jamais avant", () => {
    // LE SEUL ÉCART DE DISPOSITION CORRIGÉ PAR CE LOT. Avant correction, la
    // colonne « Site » (un ajout réel que la maquette ne dessine pas)
    // s'intercalait ENTRE Client et Machine — inversant l'ordre que la
    // maquette fixe. Le compte qui suit est celui recopié dans la
    // proposition, avant puis après.
    const colonnes = PAGE.slice(
      PAGE.indexOf("const colonnes = ["),
      PAGE.indexOf("];", PAGE.indexOf("const colonnes = [")),
    );

    const positionColonneClient = colonnes.indexOf('cle: "client"');
    const positionColonneMachine = colonnes.indexOf('cle: "machine"');
    const positionColonneSite = colonnes.indexOf('cle: "site"');
    const positionColonneStatut = colonnes.indexOf('cle: "statut"');
    const positionColonnePriorite = colonnes.indexOf('cle: "priorite"');

    expect(positionColonneClient, "colonne Client").toBeGreaterThan(-1);
    expect(positionColonneMachine, "colonne Machine").toBeGreaterThan(-1);
    expect(positionColonneSite, "colonne Site").toBeGreaterThan(-1);

    expect(
      positionColonneMachine,
      "Machine doit suivre directement Client, comme dans la maquette",
    ).toBeGreaterThan(positionColonneClient);
    expect(
      positionColonneSite,
      "Site (ajout réel absent de la maquette, D128) doit venir APRÈS Machine, jamais entre Client et Machine",
    ).toBeGreaterThan(positionColonneMachine);
    expect(
      positionColonneStatut,
      "Statut reste la dernière colonne, comme dans la maquette",
    ).toBeGreaterThan(positionColonnePriorite);

    // Même ordre dans les cellules rendues de `LigneIntervention` — la
    // disposition du tableau ET celle de chaque ligne doivent concorder.
    const corpsLigne = PAGE.slice(
      PAGE.indexOf("function LigneIntervention"),
      PAGE.indexOf("function machinesAffichees"),
    );
    const rangCelluleClient = corpsLigne.indexOf("ligne.client.raison_sociale");
    const rangCelluleMachine = corpsLigne.indexOf("machinesAffichees(ligne");
    const rangCelluleSite = corpsLigne.indexOf("ligne.site.libelle");
    expect(rangCelluleMachine).toBeGreaterThan(rangCelluleClient);
    expect(rangCelluleSite).toBeGreaterThan(rangCelluleMachine);
  });
});
