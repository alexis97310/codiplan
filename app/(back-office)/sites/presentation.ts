import type { TonBadge } from "@/components/ui/badge";
import { enDuree } from "@/lib/calendar/duree";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import type { Trajet } from "@/lib/sites/trajet-zone";
import { ZONES_GEOGRAPHIQUES, type ZoneGeographique } from "@/lib/sites/zones";

import { decompte, ouTiret } from "../presentation";

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
    valeur: enDuree(trajet.minutes),
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
 * TON FIXE — gris (décision d'Alexis 26/09, remplace le rouge de
 * PASTILLES-1 : le rouge est réservé à ce qui demande une action) ; même ton
 * dans les deux fonctions.
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
    ton: "gris",
  };
}

/**
 * « N habilitation(s) exigée(s) » — ligne de la carte site (QE-13c,
 * 9EB-TP-UX3-2-LISTES-1). REMPLACE la pastille verte de PASTILLES-1
 * (23/09/2026) : la maquette du 28/09 nomme le CODE de l'habilitation
 * exigée, que `SiteHabilitationRequise` (identifiants seulement, aucun code
 * lu par ce lot) ne permet pas de composer sans une lecture supplémentaire —
 * écart nommé, D179. Compte les lignes bloquantes ou non, comme avant.
 *
 * `null` pour ZÉRO — jamais une ligne à zéro : même garde que
 * `compteurContrat`, juste au-dessous.
 */
export function ligneHabilitationsExigees(nombre: number): string | null {
  if (nombre === 0) {
    return null;
  }
  return decompte(
    nombre,
    t("sites.habilitation_exigee_un"),
    t("sites.habilitation_exigee_plusieurs"),
  );
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

/**
 * « N site(s) sans équipement masqué(s) » (GR12b, audit du 26/09/2026,
 * constat G15) — le rappel posé sous les filtres de `/sites` quand la case
 * « Afficher aussi… » n'est PAS cochée. Compose comme `decompte` le fait déjà
 * pour le total filtré, avec l'accord du mot imposé ET du participe
 * « masqué » sur le MÊME nombre.
 */
export function phraseSitesMasques(nombre: number): string {
  return decompte(
    nombre,
    `${motDansUnePhrase("site")} ${t("sites.masques_suffixe_un")}`,
    `${motDansUnePhrase("site", true)} ${t("sites.masques_suffixe_plusieurs")}`,
  );
}

/** « Afficher » — le texte du lien qui lève le masquage. */
export function libelleAfficherSitesMasques(): string {
  return t("sites.masques_afficher");
}

/**
 * « LE MOT SITE PARTOUT » (GR12c, audit du 26/09/2026, constat G15) — les
 * trois écrans de ce module disaient « lieu », le synonyme choisi avant que
 * D5/D47 n'imposent le vocabulaire. Chaque libellé ci-dessous compose son
 * PRÉFIXE/SUFFIXE (`lib/i18n/fr.ts`) autour de `mot("site")`/
 * `motDansUnePhrase("site")` — le mot lui-même ne s'écrit qu'à l'endroit que
 * `lib/i18n/vocabulaire.ts` lui réserve.
 */

/** « Les sites d'intervention de vos clients, leur rattachement… » */
export function sousTitreSites(): string {
  return `${t("sites.sous_titre_prefixe")} ${motDansUnePhrase("site", true)} ${t("sites.sous_titre_suffixe")}`;
}

/** « Nouveau site » — le bouton de création, et le titre de l'écran qui le porte. */
export function libelleNouveauSite(): string {
  return `${t("sites.creer_prefixe")} ${motDansUnePhrase("site")}`;
}

/** « Afficher aussi les sites sans équipement » — la case du filtre. */
export function libelleFiltreEquipement(): string {
  return `${t("sites.filtre_equipement_prefixe")} ${motDansUnePhrase("site", true)} ${t("sites.filtre_equipement_suffixe")}`;
}

/** « ← Tous les sites » — le lien de retour vers la liste. */
export function libelleRetourSites(): string {
  return `${t("sites.retour_prefixe")} ${motDansUnePhrase("site", true)}`;
}

/** « Le site a été créé. » — le message posé après la création (`?motif=`). */
export function libelleSiteCree(): string {
  return `${t("sites.cree_prefixe")} ${motDansUnePhrase("site")} ${t("sites.cree_suffixe")}`;
}

/** « Aucun interlocuteur n'est enregistré pour ce site. » */
export function videContactsSite(): string {
  return `${t("sites.fiche.contacts_vide_prefixe")} ${motDansUnePhrase("site")}.`;
}

/** « Aucune machine n'est enregistrée pour ce site. » */
export function videEquipementsSite(): string {
  return `${t("sites.fiche.equipements_vide_prefixe")} ${motDansUnePhrase("site")}.`;
}

/** « Aucune intervention n'est enregistrée pour ce site. » */
export function videInterventionsSite(): string {
  return `${t("sites.fiche.interventions_vide_prefixe")} ${motDansUnePhrase("site")}.`;
}

/**
 * LA BANDE DE CHIFFRES DE LA CARTE SITE (QE-13c, 9EB-TP-UX3-2-LISTES-1) —
 * `CarteEntite.chiffres`, DISTINCTE de `compteurs` (pastilles centrées,
 * conservées telles quelles pour la fiche site qui les utilise encore).
 */

/** Machines EN PARC — pas le compte brut d'`equipementsParSite`. */
export function chiffreMachinesSite(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("sites.equipements_un")
        : t("sites.equipements_plusieurs"),
  };
}

/** Interventions hors `STATUTS_INTERVENTION_FERMES` — sans ton, la maquette n'en pose aucun ici. */
export function chiffreOuvertes(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
} {
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("sites.chiffre_ouverte_un")
        : t("sites.chiffre_ouverte_plusieurs"),
  };
}

/** Le trajet, converti pour la bande de chiffres (jamais de pastille ici, contrairement à `trajetAffiche`). */
export function chiffreTrajet(trajet: Trajet): {
  readonly valeur: string;
  readonly libelle: string;
  readonly ton?: "avertissement";
} {
  const { valeur, libelle } = trajetAffiche(trajet);
  return {
    valeur,
    libelle,
    ton: trajet.minutes === null ? "avertissement" : undefined,
  };
}

/**
 * « N VGP dépassée(s) » — UNIQUEMENT si au moins une. `null` sinon : jamais
 * un chiffre à zéro dans cette bande (même garde que `compteurContrat`).
 */
export function chiffreVgpDepassee(nombre: number): {
  readonly valeur: number;
  readonly libelle: string;
  readonly ton: "retard";
} | null {
  if (nombre === 0) {
    return null;
  }
  return {
    valeur: nombre,
    libelle:
      nombre === 1
        ? t("sites.chiffre_vgp_depassee_un")
        : t("sites.chiffre_vgp_depassee_plusieurs"),
    ton: "retard",
  };
}

/**
 * LE LIBELLÉ D'UNE ZONE, EN SÉCURITÉ — `null`, ou une valeur qui ne serait
 * plus l'une des six de D23, rendent la même phrase que la puce « Sans
 * zone » : UNE SEULE clé pour les deux usages. La carte décide seule
 * d'appliquer le ton orange — cette fonction ne rend que du texte.
 */
export function libelleZone(zone: string | null): string {
  if (zone === null || !estUneZoneConnue(zone)) {
    return t("sites.sans_zone");
  }
  return t(`site.zone.${zone}`);
}

function estUneZoneConnue(valeur: string): valeur is ZoneGeographique {
  return (ZONES_GEOGRAPHIQUES as readonly string[]).includes(valeur);
}

/** « Agence Ducos » — le mot imposé ne s'écrit pas ici (§3, D5/D47). */
export function libelleAgenceDeLaLigne(agence: string): string {
  return `${mot("agence")} ${agence}`;
}

/** « Sous contrat » — le libellé de la pastille bleue de la carte (QE-13c). */
export function libelleBadgeSousContrat(): string {
  return t("sites.badge_sous_contrat");
}
