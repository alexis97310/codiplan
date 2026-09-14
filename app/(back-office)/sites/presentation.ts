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
 * L'ABSENCE — ré-exportée depuis le module commun du back-office, où elle a
 * déménagé le 14/09/2026 quand l'écran client en a eu besoin.
 *
 * *Une ré-export plutôt qu'une recopie* : les appelants de cet écran ne changent
 * pas, et il n'existe toujours qu'une seule écriture de ce qu'est une absence.
 */
export { ouTiret } from "../presentation";
