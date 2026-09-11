import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * CE QUE LES ÉCRANS « SITES » COMPOSENT, et qu'ils ne peuvent pas composer
 * eux-mêmes (L3-16).
 *
 * ## Pourquoi un module sans JSX
 *
 * Le gardien des chaînes visibles (L0-11) DÉDUIT les fichiers concernés — un
 * fichier qui contient du JSX est scanné **en entier**, variables comprises.
 * Un gabarit qui assemble deux clés du dictionnaire y est donc pris pour du
 * texte en dur, et le gardien a raison de ne pas savoir faire la différence :
 * *ce n'est pas le fichier qui est exempté, c'est une forme d'écriture.*
 *
 * **L'assemblage vit donc ici**, comme `presentation.ts` du planning le fait
 * déjà pour la référence d'une intervention. Rien n'y est écrit en clair : tout
 * vient du dictionnaire et du vocabulaire imposé.
 */

/**
 * « Agence — Rattachement », le libellé complet du champ.
 *
 * **Le mot imposé ne s'écrit pas**, il se compose : « agence » se définit une
 * fois, sous `vocabulaire.agence`, et un gardien refuse qu'il soit écrit
 * ailleurs (D5, D47, L0-11).
 */
export function libelleRattachement(): string {
  return `${mot("agence")} — ${t("site.rattachement")}`;
}

/**
 * CE QU'ON ÉCRIT LÀ OÙ UNE DONNÉE MANQUE — un tiret, jamais un zéro.
 *
 * *Un zéro dirait que la valeur vaut zéro ; une case vide dirait qu'on ne l'a
 * pas remplie.* Le tiret dit qu'il n'y a rien à dire, et c'est la troisième
 * chose — celle que D88 distingue sur le registre des VGP.
 *
 * **Il passe par une fonction et non par une constante employée dans le JSX** :
 * le gardien des chaînes visibles lit les enfants d'un élément, et il a raison
 * de ne pas savoir si `{x ?? TIRET}` rend une clé ou du texte.
 */
export function ouTiret(valeur: string | number | null): string {
  return valeur === null ? "—" : String(valeur);
}
