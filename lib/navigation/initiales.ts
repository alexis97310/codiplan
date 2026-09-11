/**
 * LES INITIALES affichées dans la pastille de la barre — `.avatar` de la
 * maquette (D95).
 *
 * **Deux lettres au plus, et jamais une image.** Un logo de personne suppose un
 * stockage de fichiers que le produit n'a pas encore ; la maquette montre deux
 * lettres sur un rond de couleur, et c'est ce qui est rendu.
 *
 * **Ce n'est pas de l'identité, c'est du repère.** La pastille dit « vous êtes
 * connecté, et voici sous quel nom » ; elle ne sert à aucun contrôle. Elle est
 * d'ailleurs cachée aux lecteurs d'écran — le nom complet, lui, est lisible sur
 * `/arrivee`, et deux lettres lues à voix haute ne renseignent personne.
 *
 * **Les cas limites sont traités plutôt que supposés**, parce qu'un nom est une
 * donnée saisie : un nom vide, un nom d'un seul mot, un nom composé, un nom
 * dont le premier caractère n'est pas une lettre. Aucun ne doit rendre une
 * pastille vide ni faire échouer un rendu — *la charte n'est jamais un motif
 * d'échec de rendu*, et le repère qui l'accompagne non plus.
 */

/**
 * Les initiales d'un nom : la première lettre des deux premiers mots, ou les
 * deux premières lettres d'un mot unique. `null` si rien d'utilisable.
 *
 * **L'APOSTROPHE NE COUPE PAS**, et c'est mesuré plutôt que supposé : découper
 * dessus rendait « ND » pour « N'Diaye Koné », c'est-à-dire les deux moitiés du
 * nom de famille au lieu du prénom et du nom. Le trait d'union, lui, coupe —
 * « Jean-Baptiste » rend « JB ». Deux séparateurs qui se ressemblent, deux
 * usages opposés dans les noms calédoniens.
 */
export function initialesDuNom(nom: string | null | undefined): string | null {
  if (nom === null || nom === undefined) return null;
  const mots = nom
    .split(/[\s-]+/)
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  if (mots.length === 0) return null;
  if (mots.length === 1) {
    return mots[0].slice(0, 2).toLocaleUpperCase("fr-FR");
  }
  return (mots[0][0] + mots[1][0]).toLocaleUpperCase("fr-FR");
}
