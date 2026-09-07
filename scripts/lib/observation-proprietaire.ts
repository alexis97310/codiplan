/**
 * AUCUNE ASSERTION DE CLOISONNEMENT NE SE TIRE D'UNE LECTURE SOUS LE
 * PROPRIÉTAIRE (ticket L1-02d).
 *
 * ## La faute, et pourquoi elle est SYMÉTRIQUE de celle de L1-02b
 *
 * Le propriétaire du schéma n'est pas soumis aux mêmes règles que le rôle
 * applicatif — et sur la base jetable du harnais il est même superutilisateur,
 * donc totalement exempt de RLS. Une épreuve qui conclurait « cette table est
 * bien cloisonnée » depuis une lecture faite sous cette identité prouverait un
 * cloisonnement **sous des privilèges que la production n'a pas**.
 *
 * L1-02b avait fermé la faute inverse : le harnais ARMAIT une garantie que la
 * production n'armait pas. Celle-ci la MESURE sous une identité que la
 * production n'a pas. Même famille, même issue — une suite verte qui ne parle
 * de rien.
 *
 * ## Ce que ce gardien sait faire, et ce qu'il ne sait pas faire
 *
 * Il ne sait pas lire l'INTENTION d'une assertion : « cette table est
 * cloisonnée » et « cette ligne n'existe pas » s'écrivent pareil. Il s'attaque
 * donc à la seule chose qui se voit — **l'assertion de VACUITÉ**.
 *
 * *Un décompte nul lu sous le propriétaire ne distingue pas « la ligne n'existe
 * pas » de « elle est masquée ».* Or seule la seconde est une affirmation de
 * cloisonnement, et c'est justement celle qui serait fausse ici. Une assertion
 * qui ne peut pas séparer les deux n'a donc rien à faire sous cette identité :
 * elle se fait sous le rôle applicatif, où zéro veut dire quelque chose.
 *
 * Sa limite est annoncée : une assertion NON vide tirée d'une lecture sous le
 * propriétaire — « je vois deux lignes, donc rien n'est filtré » — reste hors de
 * portée d'un motif statique. Elle est plus rare, et elle se lit.
 *
 * ## Ce qui est EXCLU, et pourquoi
 *
 * Les CATALOGUES — `pg_policies`, `pg_class`, `information_schema`. Ils ne sont
 * pas cloisonnés, personne ne prétend le contraire, et c'est le propriétaire qui
 * doit les lire : « aucune politique de suppression n'existe », « la partition
 * ne porte aucun privilège » sont des assertions de vacuité légitimes et
 * nécessaires.
 */

/** Un écart : une assertion de vacuité adossée à une lecture sous le propriétaire. */
export type EcartObservation = {
  readonly fichier: string;
  readonly extrait: string;
};

/** Les lectures faites sous le propriétaire, quel que soit le nom employé. */
const LECTURES_PROPRIETAIRE = ["clientOwner(", "observerSousProprietaire("];

/** Les catalogues, exclus : ils ne sont pas cloisonnés et personne ne le prétend. */
const CATALOGUES = ["pg_", "information_schema"];

/**
 * Les matcheurs de VACUITÉ. Écrits comme motif pour absorber la mise en forme —
 * Prettier coupe volontiers `toHaveLength(\n  0,\n)`.
 */
const VACUITE =
  /^\s*(?:,[\s\S]*?\))?\s*\.\s*(?:resolves\s*\.\s*|rejects\s*\.\s*)?(?:toHaveLength\(\s*0|toBe\(\s*0|toEqual\(\s*\[\s*\]|toBeNull\(|toHaveLength\(\s*\n\s*0)/;

/** Rend l'appel `expect(…)` complet à partir de l'index de son ouverture. */
function argumentDeExpect(texte: string, debut: number): [string, number] {
  let curseur = debut + "expect(".length;
  let profondeur = 1;
  while (curseur < texte.length && profondeur > 0) {
    const caractere = texte[curseur];
    if (caractere === "(") {
      profondeur += 1;
    } else if (caractere === ")") {
      profondeur -= 1;
    }
    curseur += 1;
  }
  return [texte.slice(debut, curseur), curseur];
}

/**
 * Écarts d'un fichier de scénarios.
 *
 * `contenu` est le texte du fichier ; `fichier` sert au message.
 */
export function ecartsObservationProprietaire(
  fichier: string,
  contenu: string,
): EcartObservation[] {
  const ecarts: EcartObservation[] = [];
  const motif = /expect\(/g;
  let trouve: RegExpExecArray | null;

  while ((trouve = motif.exec(contenu)) !== null) {
    const [argument, fin] = argumentDeExpect(contenu, trouve.index);
    if (!LECTURES_PROPRIETAIRE.some((lecture) => argument.includes(lecture))) {
      continue;
    }
    if (CATALOGUES.some((catalogue) => argument.includes(catalogue))) {
      continue;
    }
    if (!VACUITE.test(contenu.slice(fin, fin + 120))) {
      continue;
    }
    ecarts.push({
      fichier,
      extrait: argument.replace(/\s+/g, " ").slice(0, 160),
    });
  }

  return ecarts;
}

/** Le message rendu à celui qui découvre ce gardien. */
export function messageObservation(ecart: EcartObservation): string {
  return (
    `${ecart.fichier} : une assertion de VACUITÉ s'appuie sur une lecture ` +
    "faite sous le PROPRIÉTAIRE — " +
    `« ${ecart.extrait} ». Un décompte nul lu sous cette identité ne ` +
    "distingue pas « la ligne n'existe pas » de « elle est masquée », et seule " +
    "la seconde est une affirmation de cloisonnement. Le propriétaire n'est pas " +
    "soumis aux mêmes règles que le rôle applicatif — sur la base jetable il est " +
    "même superutilisateur. Faites cette assertion sous `clientApp()`, où zéro " +
    "veut dire quelque chose ; ou, si la lecture doit rester sous le " +
    "propriétaire, comparez deux décomptes plutôt que d'en affirmer un nul."
  );
}
