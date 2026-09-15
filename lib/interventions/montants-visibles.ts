import { niveau } from "@/lib/auth/habilitations";
import { type Role } from "@/lib/auth/roles";
import { type CleTraduction } from "@/lib/i18n/fr";

/**
 * QUI VOIT LA VALORISATION — la ligne « voir les montants de vente » de la
 * matrice du §5.2, enfin LUE par un écran.
 *
 * ## Le défaut que ce module ferme
 *
 * D37 retire les montants de vente à `admin_societe` — *« il administre
 * comptes, agences et habilitations de SA société ; il ne lit pas les données
 * financières »* —, et l'arbitrage 3.8 les retire au portail. **Aucun écran ne
 * lisait cette ligne** : la fiche d'intervention affichait taux horaire,
 * main-d'œuvre, forfait, majoration et total hors taxes à qui l'ouvrait.
 *
 * *Ce n'était pas une fuite de cloisonnement — la politique de `intervention`
 * fait son travail, et la ligne appartient bien à la société de l'appelant.
 * C'était une règle écrite que rien n'appliquait*, ce qui est plus discret et
 * se corrige moins vite : une règle qu'aucun code ne lit ne rougit jamais.
 *
 * ## POURQUOI LA MATRICE DÉCIDE, ET NON UNE COMPARAISON DE RÔLE
 *
 * Même raison qu'à `perimetre-technicien.ts` : `role === admin_societe` écrit
 * dans un écran serait la **recopie d'une ligne de matrice**, et elle
 * deviendrait fausse le jour où un second rôle perd le droit — sans que rien ne
 * rougisse (§9, 01/09). Le critère se LIT de `niveau(role,
 * "voir_montants_vente")`, et il n'est écrit qu'ici.
 *
 * ## CE N'EST PAS UN CONTRÔLE D'ACCÈS, ET IL FAUT LE DIRE
 *
 * Masquer un bloc n'empêche personne d'interroger la base : `intervention`
 * porte `temps_valide_min`, `forfait_id` et `mode_valorisation`, et rien en
 * base ne distingue `admin_societe` de la direction sur ces colonnes. **Ce
 * module décide ce qu'un ÉCRAN montre, jamais ce qu'une requête rend** — la
 * même limite que `lib/navigation/chrome.ts` écrit sur la barre : *masquer une
 * entrée n'est jamais une permission.*
 *
 * Le faire tenir par la base demanderait une quatorzième forme de politique sur
 * des COLONNES, ce qu'aucune des treize ne fait — c'est un arbitrage, et il est
 * nommé plutôt que commis en passant.
 *
 * ## DEUX VERDICTS, ET LE SECOND PORTE SON MOTIF
 *
 * *Un bloc qui disparaît en silence se lit « il n'y a pas de montant »*, là où
 * il faut lire « ce n'est pas pour vous » — c'est le motif de D88, et c'est la
 * forme que cet écran donne déjà à ses refus d'action : le refus s'affiche À LA
 * PLACE de ce qu'il refuse, avec sa raison.
 */
export type AccesAuxMontants =
  | { readonly montre: true }
  | { readonly montre: false; readonly cle: CleTraduction };

/**
 * Ce que ce rôle a le droit de voir de la valorisation.
 *
 * **Il prend un RÔLE et non un contexte**, à la différence de
 * `perimetreDuPlanning` qui a besoin de l'identité : *ce qui ne sert pas ne se
 * demande pas*, et un paramètre plus large ferait croire que la décision
 * dépend de la personne. Elle ne dépend que de la ligne de matrice.
 *
 * **`null` — aucune société active — rend le refus**, et c'est le bon sens de
 * défaillance : sans rôle, la matrice ne dit rien, et *« elle ne dit rien » ne
 * se lit pas « elle autorise »*. L'écran a d'ailleurs déjà redirigé dans ce
 * cas ; cette branche existe pour que la fonction n'ait pas besoin qu'il l'ait
 * fait.
 *
 * **`restreint` est traité comme `complet`, et c'est délibéré** : aucun rôle ne
 * porte aujourd'hui ce degré sur cette ligne, et le jour où l'un le portera, ce
 * qu'il signifie — un plafond ? ses propres interventions ? — sera une décision
 * à prendre, pas une valeur par défaut à deviner. *Le sens de défaillance
 * choisi là est celui qui ne retire rien à personne sans qu'on l'ait voulu*, et
 * il n'est pas le même que celui du rôle absent parce que la question n'est pas
 * la même : ici la matrice répond, là elle se tait.
 */
export function accesAuxMontants(role: Role | null): AccesAuxMontants {
  if (role === null) {
    return { montre: false, cle: "intervention.valorisation.sans_droit" };
  }
  return niveau(role, "voir_montants_vente") === "aucun"
    ? { montre: false, cle: "intervention.valorisation.sans_droit" }
    : { montre: true };
}
