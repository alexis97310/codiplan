/**
 * LA FORME IMPOSÉE D'UN PARAGRAPHE D'ARBITRAGE (R1-07).
 *
 * ## Ce que ce module garde
 *
 * Un paragraphe d'arbitrage est **le seul canal** entre une session automatique
 * et Alexis, et il sera lu **sur un téléphone, entre deux rendez-vous, par
 * quelqu'un qui n'a pas le dépôt sous les yeux**. *Un ticket d'arbitrage
 * incompréhensible par quelqu'un sans contexte est un ticket raté.*
 *
 * **La FORME se garde, le CONTENU ne se garde pas.** Aucun motif statique ne
 * peut dire si « ce que j'ai mesuré » contient réellement une mesure. Il peut
 * dire que la section existe, et qu'une réécriture du protocole ne l'a pas
 * emportée — *une section perdue ne produirait aucun signal : la question
 * suivante serait simplement posée sans dire ce qu'elle coûte.*
 *
 * ## Ce qui a changé depuis la demande d'origine
 *
 * Le ticket voulait `.github/ISSUE_TEMPLATE/arbitrage.md` — un gabarit de
 * TICKET. L'automatisation ayant été abandonnée le 11/09/2026, **un arbitrage
 * ne s'ouvre plus en ticket : il s'écrit dans le compte rendu que la session
 * rend, et dans le recueil de questions.** *La demande survit, sa destination
 * change.*
 */

/** Une section imposée : son nom, et la marque qui la reconnaît. */
export type SectionArbitrage = {
  /** Ce qu'elle est, en clair — c'est ce qui est nommé dans un écart. */
  readonly nom: string;
  /**
   * La marque LITTÉRALE cherchée dans le protocole. C'est une phrase de la
   * règle elle-même, jamais un simple mot : *chercher « la question » ferait
   * trouver n'importe quelle page qui pose une question.*
   */
  readonly marque: string;
};

/**
 * LES CINQ SECTIONS, et la première est celle que le ticket a ajoutée.
 *
 * Le protocole en portait quatre. **Le TITRE en est une cinquième**, et c'est la
 * seule qu'un lecteur voit avant de décider s'il ouvre : *« le premier
 * paragraphe doit tenir dans une notification »* ne dit rien du titre, qui est
 * ce que la notification montre en premier.
 */
export const SECTIONS_ARBITRAGE: readonly SectionArbitrage[] = [
  {
    nom: "le TITRE, sans jargon et sous 80 caractères",
    marque: "moins de 80 caractères",
  },
  {
    nom: "LA QUESTION, en une phrase",
    marque: "## La question",
  },
  {
    nom: "CE QUI A ÉTÉ MESURÉ, avec la commande ou la requête",
    marque: "## Ce que j'ai mesuré",
  },
  {
    nom: "LES ISSUES, chacune avec ce qu'elle COÛTE et ce qu'elle INTERDIT",
    marque: "## Les issues possibles",
  },
  {
    nom: "CE QUI EST BLOQUÉ, et ce qui CONTINUE",
    marque: "## En attendant",
  },
];

/**
 * Les sections manquantes.
 *
 * **La marque est cherchée dans le BLOC qui énonce la forme**, jamais dans le
 * document entier : sans cette borne, le gardien serait vert dès qu'une page
 * parlerait de « la question » ailleurs — et il aurait alors la forme d'un
 * gardien sans en être un.
 */
export function ecartsFormeArbitrage(protocole: string): string[] {
  const debut = protocole.indexOf(DEBUT_DU_BLOC);
  if (debut === -1) {
    return [
      `Le bloc qui énonce la forme d'un paragraphe d'arbitrage est introuvable ` +
        `(marque attendue : « ${DEBUT_DU_BLOC} »). Les cinq sections ne sont ` +
        "donc gardées par personne : " +
        SECTIONS_ARBITRAGE.map((s) => s.nom).join(" ; "),
    ];
  }
  const bloc = protocole.slice(debut);

  return SECTIONS_ARBITRAGE.filter(
    (section) => !bloc.includes(section.marque),
  ).map(
    (section) =>
      `La forme d'un paragraphe d'arbitrage ne porte plus « ${section.nom} ». ` +
      "C'est le seul canal vers Alexis, et il est lu sur un téléphone : ce " +
      "qui n'y est pas écrit ne sera pas demandé.",
  );
}

/** L'ancre du bloc. Elle est écrite ici et citée par le protocole. */
export const DEBUT_DU_BLOC = "Cinq sections, dans cet ordre";
