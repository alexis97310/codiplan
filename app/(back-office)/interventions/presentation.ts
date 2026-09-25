import { type TypeIntervention } from "@prisma/client";

import { libelleAgenceAvecCode } from "@/lib/agences/presentation";
import type { Annuaire } from "@/lib/auth/annuaire";
import {
  cleJour,
  dateCivile,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { quiTravaille } from "@/lib/interventions/personnes";
import {
  VUES_REGISTRE,
  type RechercheInterventions,
  type VueRegistre,
} from "@/lib/interventions/saisie";

import { hrefDeLaPage } from "../presentation";

/**
 * CE QUE LE PLANNING AFFICHE — et qui n'est ni une règle métier, ni une couleur.
 *
 * **Les couleurs de statut ne sont PAS ici** : elles sont dans
 * `lib/theme/statuts.ts`, le seul endroit du dépôt où une couleur s'écrit en
 * clair (CLAUDE.md §6). Elles y ont été déplacées le jour où elles ont été
 * écrites ici — c'est le gardien qui l'a dit, pas la relecture.
 */

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` tant qu'il est nul
 * (I10).
 *
 * Le numéro est attribué par le serveur à la première synchronisation, et
 * PERSONNE ne l'attribue aujourd'hui : la référence est donc toujours locale
 * pour l'instant, et l'écran le dit plutôt que d'afficher un vide.
 */
export function referenceAffichee(ligne: {
  id: string;
  numero: number | null;
}): string {
  if (ligne.numero !== null) {
    return `INT-${String(ligne.numero).padStart(5, "0")}`;
  }
  return `Local-${ligne.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

/**
 * LE RETOUR VERS LE PLANNING REJOINT LE CRÉNEAU, jamais le haut de la semaine
 * (N-01).
 *
 * *Refaire le chemin à la main est le geste qu'on répète cinquante fois par
 * jour* — l'argument même qui a fait quitter `/planning/{id}` pour
 * `/interventions/{id}`. La vue JOUR est celle qui montre le créneau ; la
 * date qui l'ouvre est celle de l'intervention, jamais celle du serveur.
 *
 * `date_planifiee` est une colonne `@db.Date`, un jour civil stocké à minuit
 * UTC (comme `dateCivile` le lit) : aucun fuseau ne s'y applique, le lire
 * dans celui de l'agence le décalerait d'un cran sous UTC+11.
 *
 * Une intervention encore en file d'attente n'a pas de date : le planning
 * s'ouvre alors sans paramètre, sur sa semaine par défaut.
 */
export function retourPlanning(datePlanifiee: Date | null): string {
  if (datePlanifiee === null) {
    return "/planning";
  }
  const jour: JourLocal = {
    annee: datePlanifiee.getUTCFullYear(),
    mois: datePlanifiee.getUTCMonth() + 1,
    jour: datePlanifiee.getUTCDate(),
  };
  return `/planning?vue=jour&jour=${cleJour(jour)}`;
}

/**
 * ── LE RETOUR MÈNE À L'ÉCRAN D'ORIGINE (FICHE-INTERVENTION-1) ────────────────
 *
 * *Mesuré le 23/09/2026 : le retour de la fiche était TOUJOURS
 * « Retour au planning », même en arrivant d'une fiche client, site ou
 * machine, ou de la liste des interventions.* Les écrans qui mènent à cette
 * fiche portent désormais `?depuis=…`, une valeur d'une LISTE FERMÉE — jamais
 * une URL libre reçue en clair : une redirection ouverte se forge (D50), un
 * mot d'une liste fermée ne se détourne pas.
 *
 * **`machine` est le seul cas qui porte un second paramètre**, `depuisId` :
 * une intervention peut porter PLUSIEURS machines (I1 ne le borne pas), la
 * fiche ne sait donc pas SEULE laquelle a ouvert le lien. Il n'est accepté
 * que s'il désigne une machine RÉELLEMENT rattachée à cette intervention —
 * jamais recopié tel quel vers le lien rendu.
 */
const VALEURS_DEPUIS = [
  "planning",
  "interventions",
  "client",
  "site",
  "machine",
] as const;

/** D'où on arrive sur la fiche — une liste fermée, jamais une URL libre. */
export type OrigineFiche = (typeof VALEURS_DEPUIS)[number];

function estOrigineFiche(valeur: unknown): valeur is OrigineFiche {
  return (
    typeof valeur === "string" &&
    (VALEURS_DEPUIS as readonly string[]).includes(valeur)
  );
}

/** Le lien de retour — href et libellé COMPOSÉS ENSEMBLE, jamais lus
 * séparément : un lien dont la voix dirait « à la machine » et la
 * destination mènerait au planning serait une fiche qui ment sur elle-même
 * (§9, 01/09 — deux lectures d'un même critère divergent en silence). */
export type RetourFiche = { readonly href: string; readonly libelle: string };

/**
 * ── LE RETOUR AU REGISTRE REJOINT LA LISTE TELLE QU'ON L'AVAIT LAISSÉE
 * (78-LIENS-2) ────────────────────────────────────────────────────────────
 *
 * *Mesuré sur main le 25/09/2026 : `case "interventions"` rendait
 * `/interventions` nu — la vue, la recherche, les filtres et la page étaient
 * PERDUS à chaque fiche ouverte depuis le registre.* Le lien de ligne du
 * registre porte désormais `retour=<la requête active, encodée>`, et cette
 * fonction la REJOUE — jamais recopiée telle quelle : `retour` arrive dans
 * l'URL d'une fiche, exactement comme `depuis` (D50, redirection ouverte), et
 * se filtre contre la MÊME liste fermée que le registre lit déjà
 * (`parametresActifs`, `page.tsx`) plutôt que d'en tenir une seconde qui
 * pourrait diverger en silence (§9, 01/09).
 *
 * Rejetée EN BLOC — retour à `/interventions` nu — dès que la valeur brute
 * porte `://`, `//` ou `:` : aucune des clés connues ne porte ce caractère
 * dans une valeur légitime (dates sans heure, UUID sans deux-points, entiers,
 * texte de recherche), donc sa présence ne peut être qu'un schéma d'URL
 * détourné (`javascript:`, `//hôte-étranger`, `https://…`).
 */

/**
 * LA LISTE FERMÉE DES PARAMÈTRES QUE LE RETOUR PORTE — EXPORTÉE pour que le
 * lien de ligne du registre (`page.tsx`) compose `retour=` sur EXACTEMENT
 * cette liste, jamais une seconde liste tenue à la main qui pourrait
 * diverger en silence de celle que `retourVersRegistre` relit plus bas (§9,
 * 01/09).
 */
export const PARAMETRES_RETOUR_REGISTRE = [
  "vue",
  "q",
  "technicien",
  "agence",
  "type",
  "statut",
  "du",
  "au",
  "sans_duree_a_venir",
  "page",
] as const;

/** Une valeur de retour plus longue que ceci n'est pas un filtre plausible. */
const LONGUEUR_MAXIMALE_VALEUR_RETOUR = 200;

/**
 * LA REQUÊTE ACTIVE DU REGISTRE, ENCODÉE — composée sur le lien de chaque
 * ligne (`page.tsx`), pour que `retourVersRegistre` ci-dessous la rejoue
 * depuis la fiche. Prend les valeurs BRUTES de la requête en cours, jamais
 * les critères déjà analysés (`RechercheInterventions`) : `du`/`au` y
 * seraient des `Date`, que réencoder ferait diverger du format
 * `<input type="date">` que le formulaire relit au retour.
 */
export function retourActuelDuRegistre(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const requete = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_REGISTRE) {
    const valeur = params[cle];
    const premiere = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof premiere === "string" && premiere.length > 0) {
      requete.set(cle, premiere);
    }
  }
  return requete.toString();
}

export function retourVersRegistre(
  retour: string | readonly string[] | undefined,
): string {
  const brut = Array.isArray(retour) ? retour[0] : retour;
  if (typeof brut !== "string" || brut.length === 0) {
    return "/interventions";
  }
  if (brut.includes("://") || brut.includes("//") || brut.includes(":")) {
    return "/interventions";
  }
  const recus = new URLSearchParams(brut);
  const conserves = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_REGISTRE) {
    const valeur = recus.get(cle);
    if (valeur !== null && valeur.length <= LONGUEUR_MAXIMALE_VALEUR_RETOUR) {
      conserves.set(cle, valeur);
    }
  }
  const requete = conserves.toString();
  return requete.length === 0 ? "/interventions" : `/interventions?${requete}`;
}

/**
 * LE RETOUR — `planning` par défaut, comme avant ce ticket, quand `depuis`
 * est absent, ne vaut rien de connu, ou — cas de `machine` — désigne une
 * machine qui n'est PAS rattachée à cette intervention : la destination
 * retombe sur le planning, et le LIBELLÉ avec elle, jamais l'un sans
 * l'autre.
 */
export function retourFiche(
  parametres: {
    readonly depuis: string | readonly string[] | undefined;
    readonly depuisId: string | readonly string[] | undefined;
    readonly retour: string | readonly string[] | undefined;
  },
  ligne: {
    readonly client_id: string;
    readonly site_id: string;
    readonly date_planifiee: Date | null;
    readonly machines: readonly { readonly machine_id: string }[];
  },
): RetourFiche {
  const parPlanning: RetourFiche = {
    href: retourPlanning(ligne.date_planifiee),
    libelle: t("planning.retour_fleche"),
  };
  const depuis = Array.isArray(parametres.depuis)
    ? parametres.depuis[0]
    : parametres.depuis;
  if (!estOrigineFiche(depuis)) {
    return parPlanning;
  }
  switch (depuis) {
    case "interventions":
      return {
        href: retourVersRegistre(parametres.retour),
        libelle: t("intervention.retour.interventions"),
      };
    case "client":
      return {
        href: `/clients/${ligne.client_id}`,
        libelle: t("intervention.retour.client"),
      };
    case "site":
      return {
        href: `/sites/${ligne.site_id}`,
        libelle: `${t("intervention.retour.site_prefixe")} ${motDansUnePhrase("site")}`,
      };
    case "machine": {
      const depuisId = Array.isArray(parametres.depuisId)
        ? parametres.depuisId[0]
        : parametres.depuisId;
      const rattachee =
        typeof depuisId === "string" &&
        ligne.machines.some((machine) => machine.machine_id === depuisId);
      return rattachee
        ? {
            href: `/parc/${depuisId}`,
            libelle: t("intervention.retour.machine"),
          }
        : parPlanning;
    }
    case "planning":
      return parPlanning;
  }
}

/**
 * ── CE QU'UN BLOC D'INTERVENTION DIT, ET CE QU'IL DISAIT ─────────────────────
 *
 * La maquette fait foi sur la disposition (D95), et elle écrit
 * **« 08:00 Garage Boulari » puis « Préventif — pont 2 col. »** : une HEURE, un
 * CLIENT, puis l'OBJET. Le bloc rendait une **référence interne**, le client
 * **et** le site — trois écarts d'un coup, et `creneau_debut` était lu depuis
 * toujours **sans jamais être affiché**.
 *
 * *L'heure est la seule information qu'un planificateur cherche dans une case
 * qu'il survole*, et c'était la seule qui manquait.
 *
 * **La référence sort du bloc**, et elle ne disparaît pas : la file d'attente et
 * la fiche la portent. *Une référence interne ne dit rien à qui regarde une
 * journée ; elle sert à en parler au téléphone.*
 */

/**
 * L'HEURE DU CRÉNEAU, dans le fuseau de l'AGENCE — jamais celui de l'appareil.
 *
 * Rend `null` quand le créneau n'est pas posé : une intervention datée sans
 * heure existe (c'est la file de planification), et *écrire « 00:00 » dirait
 * minuit là où il faut lire « pas encore d'heure »*.
 */
export function heureDuCreneau(
  ligne: { creneau_debut: Date | null },
  fuseau: Fuseau,
): string | null {
  if (ligne.creneau_debut === null) {
    return null;
  }
  const local = versLocal(ligne.creneau_debut, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

/**
 * LA PREMIÈRE LIGNE DU BLOC : l'heure et le client, dans cet ordre.
 *
 * Le SITE n'y est pas. La maquette ne le montre pas, et la raison se voit à
 * l'usage : *une cellule de grille fait cent-vingt pixels de large, et un client
 * suivi d'un site y tient sur trois lignes* — la densité double, et c'est la
 * longueur du contenu qui fait grandir les lignes, pas la feuille de style. Le
 * site reste sur la fiche, où on le cherche.
 */
export function enTeteDuBloc(
  ligne: { creneau_debut: Date | null; client: { raison_sociale: string } },
  fuseau: Fuseau,
): string {
  const heure = heureDuCreneau(ligne, fuseau);
  const client = ligne.client.raison_sociale;
  return heure === null ? client : `${heure} ${client}`;
}

/**
 * L'OBJET DU BLOC — la NATURE de l'intervention, et rien de plus aujourd'hui.
 *
 * La maquette écrit « Préventif — pont 2 col. » : une nature **et** le matériel
 * concerné. **Le matériel n'est pas rendu**, et c'est écrit plutôt que tu : il
 * vit dans `intervention_machine` (L2-08a), que `listerPlanning` ne charge pas,
 * et RG-INT-01 ne l'exige qu'au passage en statut de travail — *le dépannage à
 * l'aveugle est le cas ordinaire.* Une case vide se lirait comme une donnée
 * manquante là où il n'y a rien à afficher.
 */
export function objetDuBloc(ligne: { type: TypeIntervention }): string {
  return t(`type_intervention.${ligne.type}`);
}

/** Le signe d'absence — aucune machine affectée (RG-INT-01, dépannage à l'appel). */
const ABSENT_MACHINE = "—";

/**
 * LES MACHINES D'UNE INTERVENTION — GAP COMBLÉ (audit du 18/09/2026) pour le
 * registre `/interventions`, puis REPRISE pour sa fiche (audit du
 * 19/09/2026) : `CHAMPS_LIGNE` (`lib/interventions/depot.ts`) lit déjà
 * `machines`, et c'était la SEULE des deux vues à les montrer — la fiche ne
 * portait aucun champ machine, zéro occurrence du mot dans son fichier.
 *
 * **Une seule écriture pour les deux vues** : la liste et la fiche posent la
 * même question — « quelles machines, dans quel ordre, avec quel mot pour
 * zéro » — et deux réponses risqueraient de diverger en silence (§9, 01/09).
 *
 * **LA RÈGLE RETENUE POUR PLUSIEURS MACHINES** — décidée ici, faute d'une
 * règle de gestion écrite au chapitre 10 : chaque exemplaire s'affiche par
 * son modèle (« marque référence », comme `titreDeLaLigne` sur `/parc`),
 * jamais par son numéro de série — une fiche `SN-INCONNU-…` n'aiderait pas
 * plus à distinguer deux exemplaires dans une cellule dense — et les
 * libellés sont joints par une virgule, sans troncature : le chapitre 11.3
 * ne borne le nombre de machines par intervention nulle part, et tronquer
 * cacherait une machine réellement affectée.
 */
export function machinesAffichees(
  ligne: { readonly machines: readonly { readonly machine_id: string }[] },
  libellesMachines: ReadonlyMap<string, string>,
): string {
  if (ligne.machines.length === 0) {
    return ABSENT_MACHINE;
  }
  return ligne.machines
    .map((m) => libellesMachines.get(m.machine_id) ?? ABSENT_MACHINE)
    .join(", ");
}

/**
 * LES MÊMES MACHINES, IDENTIFIÉES — pour la fiche, qui mène chacune à sa fiche
 * (LIENS-1). `machinesAffichees` ci-dessus reste la forme CHAÎNE, pour la
 * liste et le bon imprimable, qui ne composent pas de lien : cette fonction
 * n'y touche pas, elle répond à la même question sous une forme différente,
 * que la fiche seule compose en liens.
 *
 * `libelle: null` — jamais filtré — quand l'identifiant n'a pas de libellé
 * lu : la fiche affiche alors le signe d'absence, jamais un lien vers une
 * machine qu'elle n'a pas les moyens de nommer.
 */
export function machinesIdentifiees(
  ligne: { readonly machines: readonly { readonly machine_id: string }[] },
  libellesMachines: ReadonlyMap<string, string>,
): readonly { readonly machineId: string; readonly libelle: string | null }[] {
  return ligne.machines.map((m) => ({
    machineId: m.machine_id,
    libelle: libellesMachines.get(m.machine_id) ?? null,
  }));
}

/**
 * LE TECHNICIEN SUR LA FICHE — un NOM, jamais l'identifiant technique (D-04,
 * I10).
 *
 * *Mesuré sur la fiche : `ligne.technicien_id ?? t("intervention.aucun_technicien")`
 * affichait l'UUID brut dès qu'un technicien était affecté — exactement ce
 * qu'un `id` ne doit jamais faire (I10 : « clé technique et numéro affiché
 * sont distincts »).* `lib/interventions/personnes.ts` résout déjà cette même
 * question pour le planning, sous les trois états que l'annuaire distingue
 * (nom, refusée, jamais demandée) : les reprendre ici évite une seconde
 * lecture du même critère (§9, 01/09), qui aurait pu diverger de la première.
 *
 * L'absence d'affectation garde son propre libellé, `intervention.aucun_technicien`
 * — « Interventions non affectées » (le repli de `quiTravaille`) est écrit
 * pour une COLONNE de planning, pas pour une fiche d'une seule intervention.
 */
export function technicienAfficheSurLaFiche(
  technicienId: string | null,
  annuaire: Annuaire,
): string {
  if (technicienId === null) {
    return t("intervention.aucun_technicien");
  }
  return quiTravaille(technicienId, annuaire);
}

/**
 * ── LES FILTRES DU REGISTRE, ET LEURS OPTIONS « TOUS/TOUTES » (AT-07) ───────
 *
 * La maquette annonce quatre filtres pour cet écran — « agence · type · statut
 * · période » — et le mot imposé « agence » (D5, D47) ne s'écrit PAS ici : il
 * se compose depuis `mot`/`motDansUnePhrase`, exactement comme le fait déjà
 * `libelleRattachement` de `sites/presentation.ts`.
 */

/** Le libellé du filtre « agence » — l'étiquette du `<select>`. */
export function libelleFiltreAgence(): string {
  return mot("agence");
}

/** L'option par défaut du filtre « agence » — aucune agence choisie. */
export function optionToutesLesAgences(): string {
  return `${t("interventions.filtre_toutes_prefixe")} ${motDansUnePhrase("agence", true)}`;
}

/**
 * ── LES ONGLETS DU REGISTRE (52-REGISTRE-1) ──────────────────────────────
 *
 * « Toutes » (`vue === null`) en tête, puis les six vues nommées, dans
 * l'ordre où le ticket les énumère — celui où un exploitant les cherche :
 * ce qui reste à planifier, aujourd'hui, ce qui roule, ce qui est bloqué, ce
 * qui reste à contrôler, l'historique.
 */
export const ONGLETS_REGISTRE: readonly (VueRegistre | null)[] = [
  null,
  ...VUES_REGISTRE,
];

/** La clé du dictionnaire pour le libellé d'un onglet. */
export function libelleCleOnglet(vue: VueRegistre | null): CleTraduction {
  return vue === null ? "interventions.vue.toutes" : `interventions.vue.${vue}`;
}

/**
 * LE LIBELLÉ D'UN ONGLET AVEC SON COMPTE — « À planifier (3) ».
 *
 * Composé ICI, jamais dans le JSX de l'écran (AT-07, même raison que
 * `decompte`/`libellePage` de `../presentation`) : le gardien des chaînes
 * visibles (L0-11) refuse un littéral — même la seule ponctuation d'un
 * compte — posé nu dans un conteneur JSX.
 */
export function libelleOngletAvecCompte(
  vue: VueRegistre | null,
  compte: number,
): string {
  return `${t(libelleCleOnglet(vue))} (${compte})`;
}

/**
 * L'URL D'UN ONGLET — les AUTRES filtres actifs préservés, `vue` posé (ou
 * retiré pour « Toutes »), et la page toujours remise à 1 : changer d'onglet
 * est une nouvelle recherche, pas une page suivante de l'ancienne.
 */
export function hrefOnglet(
  parametresActifs: Readonly<Record<string, string | undefined>>,
  vue: VueRegistre | null,
): string {
  return hrefDeLaPage(
    "/interventions",
    { ...parametresActifs, vue: vue ?? undefined },
    1,
  );
}

/**
 * LES OPTIONS DU FILTRE « TECHNICIEN » (57-REGISTRE-2) — les techniciens
 * ACTIFS de la société, nommés par le même `quiTravaille` que la colonne
 * « Technicien » de ce registre (jamais une seconde lecture du nom, §9,
 * 01/09). « Tous » et « Non affectées » sont deux options FIXES, composées à
 * part dans l'écran : elles ne désignent personne dans l'annuaire.
 */
export function optionsFiltreTechnicien(
  techniciens: readonly { readonly utilisateur_id: string }[],
  annuaire: Annuaire,
): readonly { readonly valeur: string; readonly libelle: string }[] {
  return techniciens
    .map((technicien) => ({
      valeur: technicien.utilisateur_id,
      libelle: quiTravaille(technicien.utilisateur_id, annuaire),
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
}

/**
 * ── LES PUCES DE FILTRES ACTIFS (88-REGISTRE-5) ──────────────────────────
 *
 * *Mesuré le 25/09/2026 (audit d'ergonomie, constats 17 et 18) : après une
 * recherche, RIEN ne rappelait le critère appliqué, ni ne permettait de
 * l'effacer autrement qu'en rouvrant le formulaire.* Une puce par critère
 * RÉELLEMENT appliqué — jamais un paramètre brut : une recherche invalide
 * (`criteres.success === false`) n'en pose aucune, puisqu'aucun filtre n'a
 * RÉELLEMENT atteint la lecture en base.
 *
 * `du`/`au` partagent une seule puce, « Période » — les deux bornes d'un
 * même critère, retirées ensemble, jamais deux puces qui pourraient se
 * retirer l'une sans l'autre et laisser une période à moitié posée.
 */
export type PuceFiltre = {
  readonly cle: string;
  readonly libelle: string;
  readonly href: string;
};

export function puceFiltresActifs(
  criteres: RechercheInterventions,
  parametresPuces: Readonly<Record<string, string | undefined>>,
  agences: readonly {
    readonly id: string;
    readonly libelle: string;
    readonly code: string;
  }[],
  annuaire: Annuaire,
): readonly PuceFiltre[] {
  const deuxPoints = t("ponctuation.deux_points");
  const sansCritere = (cles: readonly string[]): string =>
    hrefDeLaPage(
      "/interventions",
      {
        ...parametresPuces,
        ...Object.fromEntries(cles.map((cle) => [cle, undefined])),
      },
      1,
    );

  const puces: PuceFiltre[] = [];

  if (criteres.texte !== null) {
    puces.push({
      cle: "q",
      libelle: `${t("interventions.puce_recherche")}${deuxPoints}${criteres.texte}`,
      href: sansCritere(["q"]),
    });
  }
  if (criteres.agence_id !== null) {
    const agence = agences.find(
      (candidate) => candidate.id === criteres.agence_id,
    );
    if (agence !== undefined) {
      puces.push({
        cle: "agence",
        libelle: `${mot("agence")}${deuxPoints}${libelleAgenceAvecCode(agence.libelle, agence.code)}`,
        href: sansCritere(["agence"]),
      });
    }
  }
  if (criteres.type !== null) {
    puces.push({
      cle: "type",
      libelle: `${t("intervention.type")}${deuxPoints}${t(`type_intervention.${criteres.type}`)}`,
      href: sansCritere(["type"]),
    });
  }
  if (criteres.statut !== null) {
    puces.push({
      cle: "statut",
      libelle: `${t("intervention.statut")}${deuxPoints}${t(`statut.${criteres.statut}`)}`,
      href: sansCritere(["statut"]),
    });
  }
  const { du, au } = criteres;
  if (du !== null && au !== null) {
    puces.push({
      cle: "periode",
      libelle: `${t("interventions.puce_periode")}${deuxPoints}${dateCivile(du)} ${t("interventions.puce_periode_jusqua")} ${dateCivile(au)}`,
      href: sansCritere(["du", "au"]),
    });
  } else if (du !== null) {
    puces.push({
      cle: "periode",
      libelle: `${t("interventions.filtre_periode_du")} ${dateCivile(du)}`,
      href: sansCritere(["du", "au"]),
    });
  } else if (au !== null) {
    puces.push({
      cle: "periode",
      libelle: `${t("interventions.filtre_periode_au")} ${dateCivile(au)}`,
      href: sansCritere(["du", "au"]),
    });
  }
  if (criteres.technicien !== null) {
    const libelleTechnicien =
      criteres.technicien === "aucun"
        ? t("interventions.filtre_technicien_non_affectees")
        : quiTravaille(criteres.technicien, annuaire);
    puces.push({
      cle: "technicien",
      libelle: `${t("intervention.technicien")}${deuxPoints}${libelleTechnicien}`,
      href: sansCritere(["technicien"]),
    });
  }
  if (criteres.sans_duree_a_venir) {
    puces.push({
      cle: "sans_duree_a_venir",
      libelle: t("interventions.puce_sans_duree"),
      href: sansCritere(["sans_duree_a_venir"]),
    });
  }
  return puces;
}

/**
 * « TOUT EFFACER » — reprend l'onglet (`vue`) tel quel, retire tout le
 * reste. L'onglet est une NAVIGATION (les tabs au-dessus du tableau), pas un
 * filtre du formulaire : l'effacer ici surprendrait qui vient de cliquer
 * « Bloquées » puis « Tout effacer » sur une recherche posée par-dessus.
 */
export function hrefEffacerLesFiltres(
  parametresPuces: Readonly<Record<string, string | undefined>>,
): string {
  return hrefDeLaPage("/interventions", { vue: parametresPuces.vue }, 1);
}

/**
 * UN INSTANT, EN DATE ET HEURE LOCALES — pour le bon d'intervention (BON-1).
 *
 * *Un segment de travail est un INSTANT (`Timestamptz`), pas un jour
 * (`@db.Date`)* : `dateCivile` lit les composantes UTC d'une colonne déjà
 * posée à minuit UTC, ce qui n'est pas le cas ici — un aller commencé à
 * 22 h 30 sous UTC+11 se lirait la veille en UTC. `versLocal`, dans le fuseau
 * de l'AGENCE de l'intervention, est le seul passage qui ne se trompe pas de
 * jour (L0-08).
 */
export function dateHeureLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  const heures = String(local.heures).padStart(2, "0");
  const minutes = String(local.minutes).padStart(2, "0");
  return `${jour}/${mois}/${local.annee} ${heures}:${minutes}`;
}

/** Un évènement de la chronologie — un libellé (clé du dictionnaire) et son instant. */
export type EvenementChronologie = {
  readonly cle: CleTraduction;
  readonly instant: Date;
};

/**
 * LA CHRONOLOGIE DE LA FICHE (50-INTERVENTIONS-2) — depuis les FAITS DATÉS de
 * l'intervention, **jamais depuis `journal_audit`**.
 *
 * *Choix nommé, comme le ticket le demande.* La politique de lecture du
 * journal (`app_peut_consulter_journal_audit`, migration
 * `20260829120000_journal_audit`) ne l'ouvre qu'à `admin_societe` et
 * `direction` — une chronologie qui en dépendrait serait vide pour tout autre
 * rôle consultant cette même fiche, l'ADV compris. C'est exactement le défaut
 * que D88 nomme ailleurs : une section vide se lit comme « rien ne s'est
 * passé », pas comme « vous n'y avez pas droit ».
 *
 * **« Planification » et « déplacement » n'y figurent PAS.** Aucune colonne
 * ne date le changement lui-même — seul l'état COURANT (`date_planifiee`) est
 * connu, jamais l'instant où il a été posé ou modifié. Une date approchée
 * serait une date inventée, la même faute que le §9 (20/08) interdit déjà sur
 * `suspendue_le` : *on ne fabrique pas l'âge d'un fait.* Ce que cette
 * chronologie montre, elle le montre avec certitude ; ce qu'elle ne peut pas
 * dater, elle ne l'affirme pas.
 *
 * Triée du plus ANCIEN au plus RÉCENT — une chronologie se lit dans l'ordre
 * où les faits ont eu lieu.
 */
export function chronologieDeLaFiche(fiche: {
  readonly creeLe: Date;
  readonly pauses: readonly {
    readonly debut: Date;
    readonly fin: Date | null;
  }[];
  readonly clotureeLe: Date | null;
  readonly annuleeLe: Date | null;
}): readonly EvenementChronologie[] {
  const autresInstants: Date[] = [];
  const evenements: EvenementChronologie[] = [];
  for (const pause of fiche.pauses) {
    evenements.push({
      cle: "intervention.chronologie.suspension",
      instant: pause.debut,
    });
    autresInstants.push(pause.debut);
    if (pause.fin !== null) {
      evenements.push({
        cle: "intervention.chronologie.reprise",
        instant: pause.fin,
      });
      autresInstants.push(pause.fin);
    }
  }
  if (fiche.clotureeLe !== null) {
    evenements.push({
      cle: "intervention.chronologie.cloture",
      instant: fiche.clotureeLe,
    });
    autresInstants.push(fiche.clotureeLe);
  }
  if (fiche.annuleeLe !== null) {
    evenements.push({
      cle: "intervention.chronologie.annulation",
      instant: fiche.annuleeLe,
    });
    autresInstants.push(fiche.annuleeLe);
  }
  // Fiche REPRISE d'un import (audit du 25/09, constat 22) : un fait daté
  // précède `creeLe`, l'instant d'enregistrement de la ligne. « Créée » y
  // mentirait — l'évènement se nomme alors pour ce qu'il est.
  const repriseDunImport = autresInstants.some(
    (instant) => instant.getTime() < fiche.creeLe.getTime(),
  );
  evenements.push({
    cle: repriseDunImport
      ? "intervention.chronologie.enregistrement"
      : "intervention.chronologie.creation",
    instant: fiche.creeLe,
  });
  return [...evenements].sort(
    (a, b) => a.instant.getTime() - b.instant.getTime(),
  );
}

/**
 * TROIS PHRASES DU BON D'INTERVENTION QUI COMPOSENT LE MOT IMPOSÉ (BON-1).
 *
 * *Le mot « site » ne s'écrit qu'aux entrées `vocabulaire.*`* (D5, D47,
 * L0-11) : ces trois clés portent donc un PRÉFIXE, et c'est ici, jamais dans
 * le dictionnaire, qu'il se complète avec `motDansUnePhrase("site")`.
 */
export function segmentsSurSiteTitre(): string {
  return `${t("intervention.bon.segments_titre")} ${motDansUnePhrase("site")}`;
}

export function tempsTotalSurSiteLibelle(): string {
  return `${t("intervention.bon.temps_total")} ${motDansUnePhrase("site")}`;
}

export function aucuneMachineSurLeSite(): string {
  return `${t("intervention.bon.aucune_machine")} ${motDansUnePhrase("site")}.`;
}

/**
 * QUATRE TEXTES DE `/interventions/nouvelle` (92-CREATION-2, audit
 * d'ergonomie du 25/09/2026, constats 7 et 8) — même raison que
 * `segmentsSurSiteTitre` ci-dessus : le mot imposé ne s'écrit qu'ici, jamais
 * dans le dictionnaire ni dans l'écran.
 */

/** Un libellé de champ, marqué obligatoire — Site, Nature, la panne signalée. */
export function libelleChampObligatoire(libelleChamp: string): string {
  return `${libelleChamp} ${t("intervention.creation.obligatoire_suffixe")}`;
}

/** « Choisissez d'abord un site » — l'option vide de Machine et de Contact
 * tant qu'aucun site n'est choisi. */
export function libelleChoisirLeLieuDabord(): string {
  return `${t("intervention.creation.choisir_lieu_prefixe")} ${motDansUnePhrase("site")}`;
}

/** L'aide sous le champ Site — ce qu'on peut y taper. */
export function aideRechercheSite(): string {
  return `${t("intervention.creation.aide_recherche_prefixe")} ${motDansUnePhrase("site")} ${t("intervention.creation.aide_recherche_suffixe")}`;
}

/**
 * LA NOTE SOUS LE CHAMP SITE — reformulée pour dire ce qui se déduit de quoi
 * (constat 8) : l'agence n'est plus « déduite du lieu d'intervention », elle
 * l'est du SITE choisi juste au-dessus (D56).
 */
export function agenceDeduiteDuSite(): string {
  return `${t("intervention.creation.agence_deduite_prefixe")} ${motDansUnePhrase("site")} ${t("intervention.creation.agence_deduite_milieu")}${motDansUnePhrase("agence")} ${t("intervention.creation.agence_deduite_suffixe")}`;
}
