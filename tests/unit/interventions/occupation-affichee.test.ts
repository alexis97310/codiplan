import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import { TAUX_PLEIN } from "@/lib/interventions/statistiques";

/**
 * JAMAIS LE POURCENTAGE SEUL — *demande d'exploitation du 10/09/2026*.
 *
 * ## Ce que ce gardien tient, et pourquoi il lit un FICHIER
 *
 * Le calcul est éprouvé ailleurs (`statistiques.test.ts`). Ici, la propriété
 * n'appartient pas au calcul : **elle appartient à l'écran.** Un module peut
 * rendre les deux termes du taux et un composant n'en afficher qu'un — et la
 * chose serait juste, testée, et fausse pour celui qui la lit.
 *
 * C'est la même famille que D56 : *un nombre dont la signification dépend
 * d'autre chose ne voyage jamais seul.* « 82 % » ne dit ni de quoi, ni sur
 * quelle période, ni calculé comment ; deux agences aux calendriers
 * différents produisent deux « 82 % » qui ne se comparent pas.
 *
 * ## Sa limite, annoncée
 *
 * Il lit le TEXTE du composant : un affichage assemblé à l'exécution lui
 * échappe, comme à tout motif statique (§9, 26/08, forme 6). Ce qu'il arrête
 * est la simplification bien intentionnée — *« le taux suffit, la formule
 * alourdit »* —, qui est la façon dont cette règle se perdra si elle se perd.
 */

/*
 * ── LA POPULATION EST DÉDUITE, ELLE N'EST PLUS ÉCRITE ─────────────────────────
 *
 * Elle était un CHEMIN EN DUR — `app/(back-office)/planning/statistiques.tsx`.
 * La règle était juste et son périmètre était une seule ligne : **un second
 * écran affichant le taux serait né hors de sa portée**, et le gardien serait
 * resté vert en ne regardant rien de lui. *C'est l'espèce du §9 du 31/08 prise
 * par la sortie : la sélection décide de ce qu'on garde, et une sélection à la
 * main oublie par construction ce que personne n'y a ajouté.*
 *
 * Elle se DÉDUIT désormais de l'usage : tout composant de `app/` ou de
 * `components/` qui **appelle `tauxOccupation`** ou qui **affiche l'étiquette du
 * taux** est dedans. Les deux critères, et non le premier seul : un écran qui
 * recevrait le taux DÉJÀ CALCULÉ en propriété n'appellerait jamais la fonction,
 * et c'est exactement l'écran qu'on veut attraper.
 *
 * **Sa limite est annoncée** : un composant qui recevrait le taux en propriété
 * ET composerait son étiquette à l'exécution échappe aux deux critères, comme à
 * tout motif statique (§9, 26/08, forme 6). Ce qu'il arrête est la
 * simplification bien intentionnée, qui est la façon dont cette règle se perdra
 * si elle se perd.
 */

/** Les deux marques d'un composant qui montre un taux d'occupation. */
const MARQUES_DU_TAUX = ["tauxOccupation", '"statistiques.taux"'] as const;

const RACINES = ["app", "components"] as const;

function fichiersDeRendu(racine: string): string[] {
  const chemin = join(process.cwd(), racine);
  const trouves: string[] = [];
  for (const entree of readdirSync(chemin, { withFileTypes: true })) {
    const complet = join(chemin, entree.name);
    if (entree.isDirectory()) {
      trouves.push(...fichiersDeRendu(relative(process.cwd(), complet)));
    } else if (extname(entree.name) === ".tsx") {
      trouves.push(complet);
    }
  }
  return trouves;
}

/** Les composants qui montrent un taux — DÉDUITS, jamais énumérés. */
function composantsDuTaux(): string[] {
  return RACINES.flatMap(fichiersDeRendu).filter((fichier) => {
    const texte = readFileSync(fichier, "utf8");
    return MARQUES_DU_TAUX.some((marque) => texte.includes(marque));
  });
}

/** Le composant historique, gardé nommément comme TÉMOIN de la déduction. */
const COMPOSANT = join(
  process.cwd(),
  "app/(back-office)/planning/statistiques.tsx",
);

function source(): string {
  return readFileSync(COMPOSANT, "utf8");
}

/**
 * Ce que le composant DOIT porter dès lors qu'il affiche un taux. Les clés sont
 * nommées telles qu'elles s'écrivent au dictionnaire : un renommage casse le
 * gardien, ce qui est le bon sens de défaillance — il se répare en le relisant.
 */
const INSEPARABLES = [
  "statistiques.heures_engagees",
  // LE TRAJET, depuis L3-05a : il est entré dans le NUMÉRATEUR, donc il entre
  // dans ce que l'écran doit montrer. *Un terme qui compte et qu'on n'affiche
  // pas rend le taux invérifiable*, et c'est précisément ce que cette liste
  // empêche depuis le 10/09.
  "statistiques.heures_trajet",
  "statistiques.heures_ouvrables",
  "statistiques.formule",
  // ── LE DÉPASSEMENT DE 100 %, depuis le 14/09/2026 ────────────────────────
  //
  // La décision est ancienne — *le taux se dit, il ne se plafonne pas ; le
  // plafonner masquerait le seul cas qui demande une action* — et elle était
  // écrite **dans le commentaire de `lib/interventions/statistiques.ts`**,
  // c'est-à-dire partout sauf là où le chiffre s'affiche. *Le planificateur
  // qui lit « 125 % » n'avait aucun moyen de savoir si c'est un fait ou un
  // défaut de calcul.*
  //
  // Elle entre donc dans les INSÉPARABLES, pour la raison exacte qui y a fait
  // entrer le trajet : **ce qui rend le taux interprétable n'est pas
  // facultatif.** Et la mention n'apparaît qu'AU-DELÀ, ce que le scénario
  // ci-dessous mesure — *une note permanente sur un taux de 18 % serait du
  // bruit, et un avertissement qu'on lit tous les jours cesse d'être lu*
  // (§9, 11/09).
  "statistiques.taux_au_dela",
] as const;

describe("le taux d'occupation ne s'affiche jamais seul", () => {
  it("TÉMOIN — la déduction trouve au moins un composant, et elle trouve CELUI-LÀ", () => {
    // *Zéro fichier observé ressemble exactement à un sans-faute* (§9, 30/08).
    // Et le second témoin est celui qu'on oublie : une déduction qui trouverait
    // trois fichiers dont aucun n'est le composant historique aurait changé de
    // sujet sans le dire.
    const trouves = composantsDuTaux();
    expect(trouves.length).toBeGreaterThanOrEqual(1);
    expect(trouves).toContain(COMPOSANT);
  });

  it("TOUT composant qui montre un taux porte les DEUX termes et la formule", () => {
    for (const fichier of composantsDuTaux()) {
      const texte = readFileSync(fichier, "utf8");
      const court = relative(process.cwd(), fichier);
      for (const cle of INSEPARABLES) {
        expect(texte, `${court} doit afficher ${cle}`).toContain(cle);
      }
    }
  });

  it("LA MISE EN ÉCHEC : la simplification bien intentionnée est refusée", () => {
    // La faute telle qu'elle se commettrait — quelqu'un trouve la ligne
    // chargée et retire la formule, « puisque le taux se comprend ». On rejoue
    // le verdict du gardien sur ce texte-là, sans toucher au fichier.
    const ampute = source().replace(
      // La clé s'appelait `statistiques.separateur` : elle a été renommée
      // `ponctuation.separateur` le jour où la fiche d'intervention en a eu
      // besoin (L3-02) — *une clé nommée d'après son premier appelant devient
      // fausse au second*. **Et c'est ce gardien qui a nommé le renommage
      // incomplet** : son `expect(ampute).not.toBe(source())` refuse une
      // amputation qui n'ampute rien, et il a rougi sur-le-champ. Une mise en
      // échec dont le motif ne trouve plus sa cible ne viole plus rien
      // (§9, 11/09).
      /\$\{t\("ponctuation\.separateur"\)\}\$\{t\("statistiques\.formule"\)\}/g,
      "",
    );
    expect(ampute).not.toBe(source());
    expect(ampute).toContain("tauxOccupation");
    const manquantes = INSEPARABLES.filter((cle) => !ampute.includes(cle));
    expect(manquantes).toEqual(["statistiques.formule"]);
  });

  it("le refus d'un dénominateur inconnu ne se lit PAS « 0 % »", () => {
    // Le message doit dire ce qui manque et se distinguer d'un taux nul : deux
    // causes, deux corrections différentes. Un gardien du CONTENU, parce que
    // c'est le contenu qui trompe ici, pas la présence de la clé.
    const message = t("statistiques.sans_calendrier");
    expect(message).toContain("calendrier");
    expect(message.toLowerCase()).toContain("pas zéro pour cent");
    expect(source()).toContain("statistiques.sans_calendrier");
  });

  it("la formule NOMME ses trois termes — elle ne dit pas « voir plus haut »", () => {
    const formule = t("statistiques.formule");
    expect(formule).toContain("engagées");
    // LE TROISIÈME TERME (L3-05a) : le numérateur en porte deux depuis que le
    // trajet entre dans la charge. *Une formule qui n'énumère pas ce qu'elle
    // additionne est une formule fausse* — et c'est le pire endroit pour
    // l'être, puisqu'elle est là pour rendre le pourcentage vérifiable.
    expect(formule).toContain("trajet");
    expect(formule).toContain("ouvrables");
    // …et le cas voisin qui doit rester vert POUR SA PROPRE RAISON : le libellé
    // du taux, lui, n'a pas à porter la formule — c'est une étiquette.
    expect(t("statistiques.taux")).not.toContain("÷");
  });

  it("« 1 interventions » est refusé : le singulier a sa propre clé", () => {
    // Une faute que personne ne relit deux fois, et qu'aucune assertion
    // n'attrape — c'est l'image du planning qui l'a montrée, sur la ligne
    // d'une agence à une seule intervention.
    expect(t("statistiques.nombre_un")).toBe("intervention");
    expect(t("statistiques.nombre")).toBe("interventions");
    expect(source()).toContain("statistiques.nombre_un");
    expect(source()).toContain("statistiques.sans_duree_un");
  });

  it("« 0 % » ne s'affiche pas sur du temps engagé : la borne est dite", () => {
    expect(t("statistiques.taux_infime")).toContain("moins de 1");
    expect(source()).toContain("tauxArrondiAZeroMaisNonNul");
  });

  it("le TEMPS ENTRE DEUX LIEUX est dit non compté, et l'écran le porte", () => {
    // D107 l'exige : *le trajet inter-sites n'est pas compté, et l'application
    // doit le DIRE — pas l'approximer.* La phrase est un contenu, pas une
    // présence de clé : c'est le contenu qui trompe si elle se dilue.
    const phrase = t("statistiques.trajet_lecture");
    expect(phrase).toContain("premier");
    expect(phrase).toContain("dernier");
    expect(phrase.toLowerCase()).toContain("n'est pas compté");
    expect(source()).toContain("statistiques.trajet_lecture");
  });

  it("les journées SANS TRAJET CONNU sont dites, pas dissoutes", () => {
    // Même famille que les interventions sans durée : une journée vers les
    // Îles compte zéro minute de trajet, et sans la mention le taux
    // paraîtrait juste (§9, 06/09).
    expect(source()).toContain("statistiques.journees_sans_trajet");
    expect(source()).toContain("statistiques.journees_sans_trajet_une");
    expect(t("statistiques.journees_sans_trajet")).toContain("inconnu");
  });

  it("les interventions SANS DURÉE sont dites, pas dissoutes", () => {
    // Sans cette mention, un planning saisi sans durées afficherait un taux
    // bas et juste sur un technicien débordé (§9, 06/09).
    expect(source()).toContain("statistiques.sans_duree");
    expect(t("statistiques.sans_duree")).toContain("nombre");
  });
});

/**
 * LE DÉPASSEMENT SE DIT, ET IL NE SE DIT QU'AU-DELÀ (14/09/2026).
 *
 * Le gardien ci-dessus exige que la clé SOIT dans le composant ; il ne dit pas
 * QUAND elle s'affiche. *Une mention permanente le satisferait, et elle serait
 * du bruit sur tous les taux ordinaires.* Ce bloc mesure la CONDITION.
 *
 * **Il porte sa paire** (§9, 11/09) : un cas qui doit rendre la mention, et un
 * cas qui doit rester silencieux POUR SA PROPRE RAISON — sans quoi une
 * condition câblée sur `true` passerait le premier.
 */
describe("au-delà de 100 %, l'écran le dit — et seulement au-delà", () => {
  it("le seuil a UNE maison, et c'est celle de la règle", () => {
    // *L'écrire dans l'écran serait une seconde lecture d'un même critère*
    // (§9, 01/09). La constante vit avec `tauxOccupation`, qui porte la règle.
    expect(TAUX_PLEIN).toBe(100);
    expect(source()).toContain("TAUX_PLEIN");
    expect(source()).not.toMatch(/taux\s*[>]\s*100/);
  });

  it("la mention est SOUS CONDITION, jamais permanente", () => {
    // On lit la ligne qui la rend : elle doit être gardée par une comparaison
    // au seuil. *Une clé rendue sans condition satisferait la liste des
    // inséparables tout en disant « au-delà de 100 % » sur un taux de 18 %.*
    const texte = source();
    const rang = texte.indexOf('t("statistiques.taux_au_dela")');
    expect(rang).toBeGreaterThan(0);
    const avant = texte.slice(Math.max(0, rang - 200), rang);
    expect(avant).toContain("TAUX_PLEIN");
  });

  it("LA MISE EN ÉCHEC : une mention permanente est refusée", () => {
    // La faute telle qu'elle se commettrait — quelqu'un trouve la condition
    // inutile et rend la mention toujours. Le verdict est rejoué sur ce
    // texte-là, sans toucher au fichier.
    const permanente = source().replace(
      "{taux !== null && taux > TAUX_PLEIN ? (",
      "{taux !== null ? (",
    );
    expect(permanente).not.toBe(source());
    const rang = permanente.indexOf('t("statistiques.taux_au_dela")');
    const avant = permanente.slice(Math.max(0, rang - 200), rang);
    expect(avant).not.toContain("TAUX_PLEIN");
  });
});
