import type { TonBadge } from "@/components/ui/badge";
import { enDuree } from "@/lib/calendar/duree";
import { t, type CleTraduction } from "@/lib/i18n/fr";
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

/**
 * « Client et nom du site » — le titre de la première section de
 * `/sites/nouveau` (9EK-TP-UX5-2-CREATIONS-1).
 */
export function libelleSectionQuiEtNomDuSite(): string {
  return `${t("sites.nouveau.section_qui_prefixe")} ${motDansUnePhrase("site")}`;
}

/** « Créer le site » — le bouton primaire de `/sites/nouveau`. */
export function libelleCreerSite(): string {
  return `${t("sites.action.creer_site_prefixe")} ${motDansUnePhrase("site")}`;
}

/**
 * « Seule agence active : choisie d'office. » — l'aide du rattachement quand
 * une seule agence est proposable (CS41, décision d'Alexis du 05/10/2026).
 */
export function aideAgenceUnique(): string {
  return `${t("site.rattachement.aide_agence_unique_prefixe")} ${motDansUnePhrase("agence")} ${t("site.rattachement.aide_agence_unique_suffixe")}`;
}

/** « Sites existants de ce client » — le titre de la colonne de droite. */
export function titreSitesExistants(): string {
  return `${mot("site", true)} ${t("sites.existants.suffixe")}`;
}

/**
 * ── LES HORAIRES D'ACCÈS, AFFICHÉS (9EE-TP-UX4-1-FICHE-INTERVENTION-2,
 * carte « Sur place ») ───────────────────────────────────────────────────
 *
 * `site.horaires` est un `Prisma.JsonValue | null` — ce module ne lui fait
 * jamais confiance au-delà de ce qu'il peut vérifier lui-même : une forme
 * inattendue (colonne modifiée hors de ce code, ligne corrompue) rend `null`,
 * exactement comme l'absence — jamais une exception qui ferait tomber la
 * fiche entière pour une donnée d'affichage.
 *
 * **`null` et `[]` ne disent pas la même chose** (voir `lib/sites/saisie.ts`,
 * qui pose la même distinction à l'écriture) : `null` — rien renseigné — rend
 * `null` ici aussi (la fiche affiche alors son tiret ordinaire, comme pour
 * toute absence) ; `[]` — renseigné comme « fermé » — rend le texte qui le
 * dit, jamais un tiret qui se confondrait avec « pas encore réglé ».
 *
 * **Les jours consécutifs aux mêmes heures se regroupent** (« lun.–ven.
 * 06:00–14:00 ») plutôt que de répéter la même plage cinq fois — c'est la
 * forme qu'une personne qui prépare une tournée veut lire, pas la ligne à
 * ligne que la base stocke. `jour_semaine` est ISO 1-7 (1 = lundi) ; les clés
 * `intervention.resume.jour_abrege.*` (`lib/i18n/fr.ts`) sont indexées
 * dimanche→samedi (celles que `getUTCDay()` lit déjà ailleurs sur ce dépôt,
 * §9 du 01/09) — ce module pose sa PROPRE table ISO→clé plutôt que
 * d'importer la fonction privée de `interventions/presentation.ts`, qui ne
 * prend qu'une `Date`, jamais un numéro de jour nu.
 *
 * Ces trois sorties — `null`, le texte « aucune plage », ou la liste groupée
 * — valent CONTRAT pour la fiche site (9EF-1, à venir) : elles ne se
 * recalculent pas une seconde fois.
 */
export type PlageHoraireAffichee = {
  readonly jours: string;
  readonly heures: string;
};

const CLES_JOUR_ISO: Readonly<Record<number, CleTraduction>> = {
  1: "intervention.resume.jour_abrege.lundi",
  2: "intervention.resume.jour_abrege.mardi",
  3: "intervention.resume.jour_abrege.mercredi",
  4: "intervention.resume.jour_abrege.jeudi",
  5: "intervention.resume.jour_abrege.vendredi",
  6: "intervention.resume.jour_abrege.samedi",
  7: "intervention.resume.jour_abrege.dimanche",
};

type PlageHoraireBrute = {
  readonly jour_semaine: number;
  readonly debut_minutes: number;
  readonly fin_minutes: number;
};

function estPlageHoraireBrute(valeur: unknown): valeur is PlageHoraireBrute {
  if (typeof valeur !== "object" || valeur === null) {
    return false;
  }
  const { jour_semaine, debut_minutes, fin_minutes } = valeur as Record<
    string,
    unknown
  >;
  return (
    typeof jour_semaine === "number" &&
    jour_semaine in CLES_JOUR_ISO &&
    typeof debut_minutes === "number" &&
    typeof fin_minutes === "number"
  );
}

function heureDepuisMinutes(minutes: number): string {
  const bornees = Math.max(0, Math.min(1440, Math.trunc(minutes)));
  if (bornees === 1440) {
    return "24:00";
  }
  const heures = Math.floor(bornees / 60) % 24;
  const reste = bornees % 60;
  return `${String(heures).padStart(2, "0")}:${String(reste).padStart(2, "0")}`;
}

/**
 * ── LE GABARIT DE FICHE (9EF-TP-UX4-2-FICHES-1) ─────────────────────────────
 *
 * Trois titres composés plutôt qu'écrits en dur : le mot imposé « site »
 * (D5/D47) ne s'écrit jamais au dictionnaire hors de `vocabulaire.*`.
 */

/** « Machines du site (n) » — le titre du bloc des machines, avec son compte. */
export function titreMachinesDuSite(nombre: number): string {
  return `${t("sites.fiche.machines_titre_prefixe")} ${motDansUnePhrase("site")} (${nombre})`;
}

/** « VGP du site (n) » — le titre du bloc VGP, avec le compte des soumises. */
export function titreVgpDuSite(nombre: number): string {
  return `${t("sites.fiche.vgp_titre_prefixe")} ${motDansUnePhrase("site")} (${nombre})`;
}

/**
 * « Client inactif. Ce site n'apparaît plus au planning ; son historique
 * reste consultable. » — l'alerte de l'en-tête quand le client de ce site
 * est inactif (maq:3860).
 */
export function alerteClientInactifDuSite(): string {
  return `${t("sites.fiche.client_inactif_bandeau_prefixe")} ${motDansUnePhrase("site")} ${t("sites.fiche.client_inactif_bandeau_suffixe")}`;
}

export function horairesAffiches(
  horaires: unknown,
): readonly PlageHoraireAffichee[] | null {
  if (horaires === null) {
    return null;
  }
  if (!Array.isArray(horaires) || !horaires.every(estPlageHoraireBrute)) {
    return null;
  }
  const triees = [...horaires].sort((a, b) => a.jour_semaine - b.jour_semaine);
  const groupes: {
    jourDebut: number;
    jourFin: number;
    debut_minutes: number;
    fin_minutes: number;
  }[] = [];
  for (const plage of triees) {
    const dernier = groupes[groupes.length - 1];
    if (
      dernier !== undefined &&
      dernier.jourFin + 1 === plage.jour_semaine &&
      dernier.debut_minutes === plage.debut_minutes &&
      dernier.fin_minutes === plage.fin_minutes
    ) {
      dernier.jourFin = plage.jour_semaine;
      continue;
    }
    groupes.push({
      jourDebut: plage.jour_semaine,
      jourFin: plage.jour_semaine,
      debut_minutes: plage.debut_minutes,
      fin_minutes: plage.fin_minutes,
    });
  }
  return groupes.map((groupe) => ({
    jours:
      groupe.jourDebut === groupe.jourFin
        ? t(CLES_JOUR_ISO[groupe.jourDebut]!)
        : `${t(CLES_JOUR_ISO[groupe.jourDebut]!)}–${t(CLES_JOUR_ISO[groupe.jourFin]!)}`,
    heures: `${heureDepuisMinutes(groupe.debut_minutes)}–${heureDepuisMinutes(groupe.fin_minutes)}`,
  }));
}
