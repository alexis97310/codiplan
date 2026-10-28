import { lireDecisions } from "./cablage-arbitrages";

/**
 * Ticket 9I3 — audit équipe du 28/10/2026 (constat M2/M3, C3/C4/C5).
 *
 * Trois gardiens existaient déjà pour qu'une référence `Dxx` s'adosse à une
 * décision réelle — `amendements-arbitrages`, `cablage-arbitrages`,
 * `coherence-backlog` — et tous les trois ne lisent que des DOCUMENTS entre
 * eux (le chapitre 10, le backlog, `docs/arbitrages.md`). Aucun ne lit le
 * CODE. C'est la cause mécanique de D127 (33 citations, 16 fichiers, aucune
 * décision écrite) et du numéro 80 (4 citations vers un renvoi que le
 * registre déclare inexistant deux fois) : le défaut vivait exactement là où
 * aucun gardien ne regardait.
 *
 * CE QUE CE MODULE VÉRIFIE : toute citation NUE `Dxx` trouvée dans le code
 * (`app/`, `components/`, `lib/`, `tests/`, `scripts/`) doit résoudre vers un
 * titre `## Dxx —` / `### Dxx —` réellement présent dans `docs/arbitrages.md`.
 *
 * CE QU'IL NE VÉRIFIE PAS : qu'une citation qui RÉSOUT porte bien sur le même
 * SUJET que celui pour lequel elle a été écrite (la moitié « collision »
 * de C5 — D45/D48/D53/D91/D130/D123 citent des numéros qui existent tous
 * dans le registre, mais pour un AUTRE sujet). L'audit lui-même l'écrit :
 * cette concordance n'a été vérifiée que sur un échantillon, jamais de façon
 * exhaustive, et automatiser un contrôle de SUJET serait fragile — deux titres
 * qui se ressemblent ne sont pas forcément le même désaccord, et l'inverse.
 * Point ouvert, pas un contrôle manqué : voir la passation de ce lot.
 *
 * LA QUALIFICATION « D'ALEXIS ». Le dépôt porte deux numérotations distinctes
 * sous la même notation `Dxx` — le registre, et les décisions informelles
 * d'Alexis citées en passation ou en commentaire (« décision 86 d'Alexis »).
 * Quand elles coïncident numériquement (D123 du registre et « décision 123
 * d'Alexis » de D217, par exemple), un lecteur qui suit `Dxx` tombe sur la
 * MAUVAISE décision — exactement C5. La forme qualifiée, « D123 d'Alexis » ou
 * « décision 123 d'Alexis », lève l'ambiguïté : ce module l'accepte SANS
 * exiger qu'elle résolve vers quoi que ce soit, puisque la numérotation
 * d'Alexis n'a pas de registre consultable par un gardien.
 *
 * La qualification se lit PAR PARAGRAPHE (un bloc de lignes non vides,
 * borné par des lignes blanches) : c'est la portée réelle d'une relecture —
 * le qualifiant posé au premier emploi, dans un commentaire ou un paragraphe
 * de passation, couvre les reprises du MÊME numéro dans le même bloc. Un
 * nouveau bloc ne l'hérite pas : c'est précisément la faute mesurée en C5
 * (`tableau-de-bord/presentation.ts`, où D91 est qualifié dans un JSDoc et
 * nu, sans qualifiant à proximité, dans l'objet qui suit).
 */

export type Fichier = {
  readonly chemin: string;
  readonly contenu: string;
};

export type CitationDecision = {
  readonly fichier: string;
  readonly ligne: number;
  readonly citation: string;
  readonly qualifiee: boolean;
  readonly connue: boolean;
};

export type AnalyseCitations = {
  readonly titresConnus: readonly string[];
  readonly citations: readonly CitationDecision[];
  readonly ecarts: readonly string[];
};

const CITATION_LIGNE = /\bD(\d{1,3})\b/g;
const QUALIFIANT_DIRECT = /\bD(\d{1,3})\s+d'Alexis\b/g;
const QUALIFIANT_DECISION =
  /\bd[ée]cision\s+(?:n°\s*)?(\d{1,3})\s+d'Alexis\b/gi;

/**
 * Une citation `Dxx` est une affirmation de PROSE — un commentaire, une ligne
 * de documentation, une table markdown. Une valeur de DONNÉE qui ressemble à
 * une citation (un numéro de série de machine fabriqué pour une épreuve, une
 * référence de cellule d'un classeur Excel) n'en est pas une : mesuré sur le
 * dépôt réel, ces deux cas existent (`tests/isolation/machine.test.ts`,
 * `tests/unit/excel/fixture-dates.test.ts`) et n'ont rien à voir avec une
 * décision. Un fichier `.md` est toute sa longueur de la prose ; un fichier de
 * code ne l'est que dans ses commentaires — `//`, `/* ... *\/`, une ligne de
 * continuation JSDoc commençant par `*`, ou `--` en SQL.
 */
function estEnProse(chemin: string, ligne: string, position: number): boolean {
  if (chemin.endsWith(".md")) return true;
  const avant = ligne.slice(0, position);
  if (avant.includes("//") || avant.includes("/*")) return true;
  if (ligne.trimStart().startsWith("*")) return true;
  if (avant.includes("--")) return true;
  return false;
}

type Paragraphe = { readonly debut: number; readonly fin: number };

/** Découpe un fichier en paragraphes — des blocs de lignes non vides, bornés par une ligne blanche. */
function paragraphesDe(lignes: readonly string[]): Paragraphe[] {
  const paragraphes: Paragraphe[] = [];
  let debut = -1;
  for (let i = 0; i < lignes.length; i++) {
    const vide = lignes[i].trim() === "";
    if (!vide && debut === -1) {
      debut = i;
    } else if (vide && debut !== -1) {
      paragraphes.push({ debut, fin: i - 1 });
      debut = -1;
    }
  }
  if (debut !== -1) {
    paragraphes.push({ debut, fin: lignes.length - 1 });
  }
  return paragraphes;
}

/** Les numéros qualifiés « d'Alexis » dans le texte d'un paragraphe. */
function numerosQualifies(texte: string): Set<string> {
  const numeros = new Set<string>();
  for (const regex of [QUALIFIANT_DIRECT, QUALIFIANT_DECISION]) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(texte))) {
      numeros.add(m[1]);
    }
  }
  return numeros;
}

export function analyserCitationsCode(
  arbitrages: string,
  fichiers: readonly Fichier[],
): AnalyseCitations {
  const { decisions } = lireDecisions(arbitrages);
  // Une section titrée « N'EXISTE PAS » (docs/arbitrages.md, sur le numéro 80)
  // ressemble, pour un parseur de titres, à une décision bel et bien écrite —
  // exactement le piège que ce module existe pour attraper ailleurs. Une
  // section qui ANNONCE l'absence d'une décision ne lui donne pas d'existence.
  const titresConnus = decisions
    .filter((d) => !d.titre.startsWith("N'EXISTE PAS"))
    .map((d) => d.ref);
  const connus = new Set(titresConnus);

  const citations: CitationDecision[] = [];
  const ecarts: string[] = [];

  for (const fichier of fichiers) {
    const lignes = fichier.contenu.split("\n");
    for (const paragraphe of paragraphesDe(lignes)) {
      const texteDuParagraphe = lignes
        .slice(paragraphe.debut, paragraphe.fin + 1)
        .join("\n");
      const qualifies = numerosQualifies(texteDuParagraphe);

      for (let n = paragraphe.debut; n <= paragraphe.fin; n++) {
        CITATION_LIGNE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CITATION_LIGNE.exec(lignes[n]))) {
          if (!estEnProse(fichier.chemin, lignes[n], m.index)) continue;
          const numero = m[1];
          const citation = `D${numero}`;
          const qualifiee = qualifies.has(numero);
          const connue = connus.has(citation);
          citations.push({
            fichier: fichier.chemin,
            ligne: n + 1,
            citation,
            qualifiee,
            connue,
          });
          if (!qualifiee && !connue) {
            ecarts.push(
              `${fichier.chemin}:${n + 1} cite ${citation}, qui n'existe pas dans docs/arbitrages.md`,
            );
          }
        }
      }
    }
  }

  return { titresConnus, citations, ecarts };
}
