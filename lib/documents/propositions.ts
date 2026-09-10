import { type CibleDocument } from "./saisie";

/**
 * CE QU'UN FICHIER DU BAC DÉSIGNE, ET CE QU'IL NE DÉSIGNE PAS (L8-07, D87).
 *
 * ## LA RÈGLE CARDINALE : PROPOSER, JAMAIS CLASSER SEUL
 *
 * *Un rapprochement faux accroche la notice d'un compresseur à un pont
 * élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise
 * procédure.* **C'est de la sécurité, pas de la qualité de données** : le mode
 * de défaillance n'est pas « une fiche est mal remplie », c'est un geste
 * dangereux exécuté avec confiance. Ce module rend donc des CANDIDATS, et rien
 * d'autre ; le classement exige une cible nommée par un humain
 * (`lib/documents/saisie.ts`, `schemaClassement`).
 *
 * ## LE RAPPROCHEMENT SE FAIT SUR LA CLÉ, JAMAIS SUR UNE RESSEMBLANCE
 *
 * C'est la doctrine de `lib/excel/rapprochement.ts`, et elle vaut ici pour la
 * même raison. Une proposition n'est faite que si le nom du fichier CONTIENT la
 * référence d'un modèle ou le numéro de série d'une machine, comparaison faite
 * sur une forme normalisée — casse et séparateurs retirés. **Aucune distance
 * d'édition, aucun score, aucun « probablement ».** Un score classerait au
 * hasard les cas qu'il ne sait pas trancher, et il le ferait avec l'autorité
 * d'un nombre.
 *
 * ## AUCUNE PROPOSITION EST UNE ISSUE, PAS UN REJET
 *
 * *72 % de l'historique d'import ne se rattache à rien et se reprend quand
 * même* — c'est la mesure de L1-08b, et le bac est dans le même cas : un fichier
 * dont le nom ne dit rien reste **à traiter**, et l'humain lui donne sa cible en
 * regardant sa première page. Rendre zéro candidat n'est jamais un motif
 * d'écartement.
 *
 * ## LES MODÈLES D'ABORD, ET C'EST UNE RÈGLE DE PRÉSENTATION
 *
 * *Une notice classée sert toutes les machines du modèle d'un coup.* Les
 * candidats de modèle viennent donc en tête. **Ce n'est pas un tri de la file du
 * bac** — le bac ne peut pas savoir ce qu'un fichier vise avant qu'on le lui
 * dise, et prétendre l'ordonner par cible reviendrait à classer seul.
 *
 * ## CE QUE CE MODULE NE FAIT PAS
 *
 * **Aucune reconnaissance de caractères.** L8-07 l'exclut de la V1 : *la
 * couverture porte la marque et le modèle, l'œil fait le travail.* Le seul
 * signal lisible par la machine est le NOM DU FICHIER, et ce module ne prétend
 * pas à davantage.
 */

/** Un modèle du catalogue, réduit à ce qui sert au rapprochement. */
export type ModeleCandidat = {
  readonly id: string;
  readonly marque: string;
  readonly reference: string;
};

/** Une machine du parc, réduite à ce qui sert au rapprochement. */
export type MachineCandidate = {
  readonly id: string;
  readonly numero_serie: string;
};

/** Une proposition : une cible, et la CLÉ par laquelle elle a été trouvée. */
export type Proposition = {
  readonly cible: CibleDocument;
  /**
   * Le texte exact qui a été retrouvé dans le nom du fichier. Il est rendu
   * pour que l'écran puisse le montrer : *une proposition dont on ne voit pas
   * la raison se ratifie sans être lue.*
   */
  readonly cle: string;
};

/**
 * Forme comparable d'un texte : minuscules, et tout ce qui n'est ni lettre ni
 * chiffre retiré.
 *
 * **C'est la seule tolérance de ce module, et elle est bornée à la GRAPHIE.**
 * `GA-11`, `ga 11` et `GA_11` sont la même référence écrite trois fois ; `GA-12`
 * ne l'est pas, et aucune normalisation ne les rapprochera. *La tolérance porte
 * sur la façon d'écrire une clé, jamais sur la clé elle-même.*
 */
export function formeComparable(texte: string): string {
  return texte.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Les propositions pour un fichier, **modèles d'abord**.
 *
 * Une clé de deux caractères ou moins n'est jamais cherchée : elle se
 * retrouverait dans presque tout nom de fichier, et une proposition qui se
 * déclenche toujours est un bruit qui apprend à ne plus lire les propositions
 * (§9, 11/09 — un gardien dont le taux de fausses alertes conduit à ne plus le
 * lire coûte plus qu'il ne rapporte).
 */
export function propositions(
  nomFichier: string,
  catalogue: {
    readonly modeles: readonly ModeleCandidat[];
    readonly machines: readonly MachineCandidate[];
  },
): Proposition[] {
  const nom = formeComparable(nomFichier);
  const retenue = (cle: string): boolean => {
    const comparable = formeComparable(cle);
    return comparable.length > 2 && nom.includes(comparable);
  };

  const surModele: Proposition[] = catalogue.modeles
    .filter((modele) => retenue(modele.reference))
    .map((modele) => ({
      cible: { cible: "modele", modele_id: modele.id } as const,
      cle: modele.reference,
    }));

  const surMachine: Proposition[] = catalogue.machines
    .filter((machine) => retenue(machine.numero_serie))
    .map((machine) => ({
      cible: { cible: "machine", machine_id: machine.id } as const,
      cle: machine.numero_serie,
    }));

  // Les modèles D'ABORD : une notice classée sert toutes les machines du modèle
  // d'un coup. L'ordre est celui de la PRÉSENTATION, jamais celui d'un choix.
  return [...surModele, ...surMachine];
}

/**
 * L'AVANCEMENT DU BAC — et le total EXPLIQUE chaque fichier reçu.
 *
 * *C'est la leçon du rapport d'import (L1-08b) : les qualificatifs ne
 * s'additionnent pas aux totaux, sinon le témoin dit faux dans le sens
 * rassurant.* Ici les trois états sont EXCLUSIFS et leur somme vaut le nombre
 * de fichiers reçus — un test le vérifie plutôt que de l'espérer.
 */
export type Avancement = {
  readonly recus: number;
  readonly a_traiter: number;
  readonly classes: number;
  readonly ecartes: number;
};

/** Vrai si le total explique chaque fichier reçu — ni plus, ni moins. */
export function totalExplique(avancement: Avancement): boolean {
  return (
    avancement.a_traiter + avancement.classes + avancement.ecartes ===
    avancement.recus
  );
}
