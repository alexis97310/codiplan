import type { TonBadge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { Trajet } from "@/lib/sites/trajet-zone";

import { ouTiret } from "../presentation";

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
 * LA SECONDE LIGNE DE LA CARTE — l'agence CODIMA, labellisée (D123).
 *
 * **`null` plutôt qu'un tiret** : un site sans agence n'existe pas en base
 * (`agence_id` n'est pas nullable), mais son LIBELLÉ peut manquer si la
 * politique de cloisonnement refuse la lecture — le même cas que `client` sur
 * la ligne au-dessus, et la même réponse : la ligne s'omet plutôt que
 * d'afficher un tiret sous un mot imposé.
 */
export function agenceDuSite(agence: string | null): string | null {
  if (agence === null) {
    return null;
  }
  return `${mot("agence")}${t("ponctuation.separateur")}${agence}`;
}

/**
 * LE COMPTEUR DE TRAJET DE LA CARTE (LISTES-1) — la valeur mesurée sur le
 * site fait foi ; sinon, le défaut par zone s'affiche, mais ÉTIQUETÉ comme
 * une estimation (D56 : un nombre dont l'origine change de sens ne voyage
 * jamais sous le même libellé). Un site sans zone, ou dont la zone n'admet
 * aucune estimation (Îles, D107), rend un tiret sous le libellé ordinaire —
 * il n'y a alors ni mesure ni estimation à distinguer.
 *
 * TON FIXE — gris (PASTILLES-1) : Alexis n'a nommé aucune couleur pour ce
 * compteur, le neutre des cinq tons de `TonBadge`.
 */
export function trajetAffiche(trajet: Trajet): {
  readonly valeur: string;
  readonly libelle: string;
  readonly ton: TonBadge;
} {
  if (trajet.minutes === null) {
    return {
      valeur: ouTiret(null),
      libelle: t("sites.colonne_trajet"),
      ton: "gris",
    };
  }
  return {
    valeur: String(trajet.minutes),
    libelle:
      trajet.origine === "site"
        ? t("sites.colonne_trajet")
        : t("sites.colonne_trajet_estimation"),
    ton: "gris",
  };
}

/**
 * LE COMPTEUR D'ÉQUIPEMENTS DE LA CARTE (LISTES-1) — *« il faut le temps de
 * trajet + le nombre d'équipement enregistré »*. Compte TOUT équipement
 * enregistré, quel que soit son statut : c'est la même notion, au mot près,
 * que celle qui filtre la liste par défaut (`equipementsParSite`), et les
 * deux doivent rester la même pour qu'un site affiché à « 0 » ne soit jamais
 * aussi un site que le filtre aurait dû masquer.
 *
 * TON FIXE — rouge (PASTILLES-1), la même couleur que `compteurEquipements`
 * de l'écran client : une même notion garde le même ton partout où elle
 * apparaît.
 */
export function compteurEquipements(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton: TonBadge;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("sites.equipements_un")
        : t("sites.equipements_plusieurs"),
    ton: "rouge",
  };
}

/**
 * LE COMPTEUR D'HABILITATIONS EXIGÉES DE LA CARTE (PASTILLES-1, ajout du
 * 23/09 au soir) — *« une pastille verte lorsqu'il y a besoin d'au moins une
 * habilitation »*. Compte les lignes de `SiteHabilitationRequise`, bloquantes
 * ou non.
 *
 * `null` pour ZÉRO — jamais un compteur à zéro : la demande dit « lorsqu'il y
 * a besoin », pas « le nombre requis, même nul » ; l'appelant omet alors la
 * pastille, comme `referentClient` omet déjà une ligne absente.
 */
export function compteurHabilitations(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton: TonBadge;
} | null {
  if (nombre === 0) {
    return null;
  }
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("sites.habilitations_un")
        : t("sites.habilitations_plusieurs"),
    ton: "vert",
  };
}

/**
 * LA PASTILLE « CONTRAT » DE LA CARTE (CONTRAT-SITE-1, 23/09/2026) — jaune,
 * demandée par Alexis le soir même de PASTILLES-1. Aucun ton jaune n'existe
 * dans `TonBadge` : `orange` est le plus proche des cinq tons, et c'est celui
 * que la demande elle-même autorise à défaut de jaune.
 *
 * `null` quand le site n'est PAS sous contrat — même contrat que
 * `compteurHabilitations` juste au-dessus : une pastille qui n'a rien à dire
 * ne s'affiche pas.
 */
export function compteurContrat(sousContrat: boolean): {
  readonly valeur: string;
  readonly libelle: string;
  readonly ton: TonBadge;
} | null {
  if (!sousContrat) {
    return null;
  }
  return {
    valeur: "✓",
    libelle: t("sites.contrat"),
    ton: "orange",
  };
}

/**
 * L'ABSENCE — RÉ-EXPORTÉE depuis le module commun du back-office, où elle a
 * déménagé le 14/09/2026 quand l'écran client en a eu besoin. Importée
 * ci-dessus pour l'usage interne de `trajetAffiche`, et re-exportée ici pour
 * que les appelants existants de cet écran n'aient rien à changer.
 *
 * *Une ré-export plutôt qu'une recopie* : il n'existe toujours qu'une seule
 * écriture de ce qu'est une absence.
 */
export { ouTiret };
