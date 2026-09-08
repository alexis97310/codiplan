import { describe, expect, it } from "vitest";

import {
  CONTRAT_PARC,
  CONTRAT_REFERENTIEL,
  EXIGENCES_L0_05,
  exigence,
  TABLES_FIXTURES,
  type CleExigence,
} from "../../isolation/setup/contrat";
import {
  ecartsListeParc,
  TABLES_PARC,
} from "../../../scripts/lib/politiques-rls";
import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * Gardien du CONTRAT des fixtures d'isolation (ticket R0-a, écart É14 de la
 * revue R0 ; ticket L0-05 ; arbitrages D10 et D22).
 *
 * **Ce qu'il répare, et ce n'est pas un scénario.** La revue R0 a nommé le
 * point le plus dangereux du lot 1 : le jour où L1-01 crée la vraie table
 * `client`, le harnais échoue sur `CREATE TABLE`, et **la réparation la plus
 * naturelle est la mauvaise** — supprimer la fixture, pointer les scénarios sur
 * la vraie table, lui donner la clause société seule. Tout redevient vert, sur
 * moins de choses. C'est le seul endroit du dépôt où une réparation plausible
 * RÉDUIT la couverture sans qu'aucun gardien ne s'en aperçoive : non pas un
 * gardien qui ne regarde rien, mais un gardien à qui l'on retire ce qu'il
 * regardait.
 *
 * **Ce que celui-ci mesure, et que les deux autres ne mesurent pas.** La forme
 * des politiques est mesurée en base par `tests/isolation/politiques-rls.test.ts`
 * — mais une politique juste que plus aucun scénario ne traverse est une
 * politique que personne n'éprouve. Ce gardien-ci compte donc les SCÉNARIOS, un
 * décompte par exigence de L0-05, et refuse qu'il baisse. Les trois gardiens
 * sont indépendants dans les trois sens : chacun échouerait seul, et un test le
 * montre plus bas.
 *
 * **Statique, et c'est délibéré.** Il tourne dans `pnpm test`, sans base : le
 * jour où le harnais d'isolation ne démarre plus — c'est justement ce qui
 * arrivera à L1-01 —, ce gardien-ci parle encore.
 */

/** Le motif qui compte : c'est l'APPEL qui marque, pas le titre du scénario. */
function marques(
  sources: readonly { chemin: string; contenu: string }[],
): Map<string, number> {
  const compte = new Map<string, number>();
  for (const source of sources) {
    // Les commentaires sont retirés : ce fichier-ci cite les clés en prose, et
    // un gardien qui compterait sa propre documentation compterait le vide.
    const code = sansCommentaires(source.contenu);
    for (const trouve of code.matchAll(/\bexigence\(\s*"([a-z_]+)"/g)) {
      const cle = trouve[1] ?? "";
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
  }
  return compte;
}

/**
 * Écarts entre ce que L0-05 déclare obligatoire et ce que `tests/isolation/`
 * couvre réellement.
 *
 * Deux motifs, et le second est le seul qui puisse survenir par accident :
 *   1. une clé marquée qui n'appartient à aucune exigence — une faute de frappe
 *      qui ferait compter un scénario pour rien ;
 *   2. un décompte SOUS le plancher — un scénario a disparu.
 */
export function ecartsCouverture(
  observees: ReadonlyMap<string, number>,
  exigences: readonly {
    cle: string;
    intitule: string;
    source: string;
    plancher: number;
  }[] = EXIGENCES_L0_05,
): string[] {
  const ecarts: string[] = [];
  const connues = exigences.map((e) => e.cle);

  for (const cle of observees.keys()) {
    if (!connues.includes(cle)) {
      ecarts.push(
        `« ${cle} » est marquée dans un scénario d'isolation mais n'est pas ` +
          "une exigence de L0-05. Une clé mal orthographiée fait compter un " +
          "scénario pour rien, et le plancher qu'elle devait servir baisse " +
          "sans qu'on le voie.",
      );
    }
  }

  for (const attendue of exigences) {
    const vus = observees.get(attendue.cle) ?? 0;
    if (vus < attendue.plancher) {
      ecarts.push(
        `L0-05 exige « ${attendue.intitule} » (${attendue.source}) : ` +
          `${attendue.plancher} scénario(s) l'honoraient, ${vus} le font ` +
          "encore. **Le plancher ne se baisse jamais.** Si une vraie table " +
          "vient de remplacer une fixture, les scénarios se REPORTENT sur " +
          "elle — ils ne disparaissent pas avec la fixture. C'est exactement " +
          "la réparation que la revue R0 a nommée comme le point le plus " +
          "dangereux du lot 1.",
      );
    }
  }

  return ecarts;
}

/**
 * Ce fichier-ci, nommé pour être RETIRÉ de la population du témoin de
 * déplacement. Il appelle `ecartsListeParc` et ne doit donc pas se compter
 * lui-même : une population qui contient l'observateur ne peut pas constater
 * son absence (§9 du CLAUDE.md, 31/08).
 */
const FICHIER_OBSERVATEUR = "tests/unit/db/contrat-isolation.test.ts";

describe("le contrat des fixtures d'isolation est structurel (R0-a, É14, L0-05)", () => {
  const sources = fichiersSource(["tests/isolation"]);
  const observees = marques(sources);

  it("le gardien lit réellement des scénarios — sinon il garde le vide", () => {
    // Un gardien qui ne trouverait aucun fichier passerait au vert en
    // n'exigeant rien de personne. Le décompte nul ressemble trop à un
    // sans-faute (§9, 30/08).
    expect(sources.length).toBeGreaterThanOrEqual(15);
    const total = [...observees.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(9);
  });

  it("chaque exigence de L0-05 garde au moins son plancher de scénarios", () => {
    expect(
      ecartsCouverture(observees),
      "Les trois chemins que L0-05 déclare OBLIGATOIRES : résolution QR " +
        "inter-société (D22), accès d'un compte portail aux données d'un " +
        "autre client (D10), respect du périmètre de sites (D10).",
    ).toEqual([]);
  });

  it("chaque exigence est réellement marquée quelque part — aucune n'est décorative", () => {
    for (const attendue of EXIGENCES_L0_05) {
      expect(observees.get(attendue.cle) ?? 0, attendue.cle).toBeGreaterThan(0);
    }
  });

  it("ÉPREUVE : un scénario retiré fait BAISSER le décompte et échouer", () => {
    // La faute telle qu'elle se commettra : L1-01 remplace la fixture `client`
    // par la vraie table, et les scénarios portail partent avec elle.
    const ampute = new Map(observees);
    ampute.set("portail_autre_client", 0);

    const ecarts = ecartsCouverture(ampute);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("portail");
    expect(ecarts[0]).toContain("Le plancher ne se baisse jamais");
  });

  it("ÉPREUVE : une clé mal orthographiée est refusée, pas comptée", () => {
    const fautive = new Map(observees);
    fautive.set("perimetre_site", 4);

    const ecarts = ecartsCouverture(fautive);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("perimetre_site");
    expect(ecarts[0]).toContain("mal orthographiée");
  });

  it("`exigence()` refuse une clé inconnue plutôt que de la marquer", () => {
    // Le premier verrou est à l'écriture, pas à la lecture : un scénario qui
    // marquerait une exigence inexistante ne compilerait pas — et si le type
    // était contourné, l'appel lèverait.
    expect(() => exigence("qr_inter_societe", "libellé")).not.toThrow();
    expect(() =>
      exigence("inconnue" as unknown as CleExigence, "libellé"),
    ).toThrow(/Exigence L0-05 inconnue/);
  });

  it("le contrat du harnais et la liste close du gardien de forme ne DÉRIVENT pas", () => {
    // Deux fichiers portent la même liste, pour deux usages : `contrat.ts` la
    // crée en base, `politiques-rls.ts` exige sa forme. Qu'ils divergent, et
    // l'un poserait une table que l'autre ne jugerait pas — la vacuité par
    // désaccord, la seule que ni l'un ni l'autre ne verrait seul.
    expect(CONTRAT_PARC.map((entree) => entree.table)).toEqual(
      TABLES_PARC.map((entree) => entree.table),
    );

    // Et le filtre de périmètre : `client` ne le porte pas, les deux autres si.
    for (const entree of TABLES_PARC) {
      const contrat = CONTRAT_PARC.find((c) => c.table === entree.table);
      expect(contrat, entree.table).toBeDefined();
      expect(contrat?.colonneSite !== null, entree.table).toBe(
        entree.perimetre,
      );
    }
  });

  it("le DEUXIÈME gardien est exécutable SANS base, et il l'est resté", () => {
    // **Témoin de déplacement, et il ne peut pas vivre dans le fichier
    // déplacé.** `ecartsListeParc` a quitté `tests/isolation/` pour
    // `tests/unit/` au ticket L1-01 : c'est de la logique pure, et la laisser
    // derrière un PostgreSQL jetable rendait le deuxième des trois gardiens
    // muet pour `pnpm test`. Un test posé DANS le fichier déplacé disparaîtrait
    // avec lui — il faut donc que quelqu'un d'autre constate qu'il est là.
    //
    // Ce que ce témoin attrape : la suppression du fichier, son retour dans
    // `tests/isolation/`, ou un renommage qui laisserait la liste sans
    // assertion. Ce qu'il n'attrape pas, et qui se dit : une assertion vidée de
    // son contenu dans un fichier qui garderait l'appel.
    // **CE fichier est exclu de la population, et c'est le point.** Il appelle
    // lui-même `ecartsListeParc` deux lignes plus bas : sans cette exclusion,
    // le témoin resterait vert alors même que le fichier déplacé aurait
    // disparu. C'est le piège du 31/08 — une population qui contient
    // l'observateur ne peut pas constater son absence.
    const unitaires = fichiersSource(["tests/unit"]);
    const moiMeme = unitaires.filter((source) =>
      source.chemin.endsWith(FICHIER_OBSERVATEUR),
    );
    // Témoin d'adossement : l'exclusion nomme un chemin, et ce chemin existe.
    // Une exemption qui ne s'applique à personne ne fait échouer personne.
    expect(
      moiMeme.map((source) => source.chemin),
      `l'exclusion nomme « ${FICHIER_OBSERVATEUR} », qui n'existe plus : ` +
        "elle ne protège rien, et le premier fichier qui reprendra ce nom en " +
        "héritera sans que personne ne le lui ait accordé.",
    ).toHaveLength(1);

    const appelants = unitaires
      .filter((source) => !source.chemin.endsWith(FICHIER_OBSERVATEUR))
      .filter((source) =>
        /\becartsListeParc\(/.test(sansCommentaires(source.contenu)),
      );

    expect(
      appelants.map((source) => source.chemin),
      "`ecartsListeParc` n'est plus asserté nulle part dans tests/unit/ (hors " +
        "ce fichier) : le deuxième gardien du contrat R0-a exigerait de " +
        "nouveau une base pour parler, ou ne parlerait plus du tout.",
    ).not.toEqual([]);

    // Et il refuse réellement quelque chose, plutôt que d'exister : le retrait
    // de chacune des trois entrées est un écart nommé.
    for (const partie of TABLES_PARC.map((entree) => entree.table)) {
      const restantes = TABLES_PARC.map((entree) => entree.table).filter(
        (table) => table !== partie,
      );
      expect(ecartsListeParc(restantes), partie).toHaveLength(1);
    }
  });

  it("chaque exigence porte sur une table du contrat", () => {
    // Une exigence adossée à une table qui n'est pas sous contrat serait
    // éprouvée sur une politique que personne ne garde.
    for (const attendue of EXIGENCES_L0_05) {
      expect(TABLES_FIXTURES, attendue.cle).toContain(attendue.table);
    }
    // Le contrat référentiel est VIDE depuis L1-05 : `modele_materiel` est une
    // table métier réelle, et les trois référentiels de plateforme restants
    // existent au schéma depuis le lot 0. Rien à modeler.
    expect(CONTRAT_REFERENTIEL.map((entree) => entree.table)).toEqual([]);
  });
});
