import { type TypeIntervention } from "@prisma/client";

import type { Annuaire } from "@/lib/auth/annuaire";
import {
  cleJour,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { quiTravaille } from "@/lib/interventions/personnes";

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

/**
 * L'HREF DU RETOUR — `planning` par défaut, comme avant ce ticket, quand
 * `depuis` est absent ou ne vaut rien de connu.
 */
export function retourFiche(
  parametres: {
    readonly depuis: string | readonly string[] | undefined;
    readonly depuisId: string | readonly string[] | undefined;
  },
  ligne: {
    readonly client_id: string;
    readonly site_id: string;
    readonly date_planifiee: Date | null;
    readonly machines: readonly { readonly machine_id: string }[];
  },
): string {
  const depuis = Array.isArray(parametres.depuis)
    ? parametres.depuis[0]
    : parametres.depuis;
  if (!estOrigineFiche(depuis)) {
    return retourPlanning(ligne.date_planifiee);
  }
  switch (depuis) {
    case "interventions":
      return "/interventions";
    case "client":
      return `/clients/${ligne.client_id}`;
    case "site":
      return `/sites/${ligne.site_id}`;
    case "machine": {
      const depuisId = Array.isArray(parametres.depuisId)
        ? parametres.depuisId[0]
        : parametres.depuisId;
      const rattachee =
        typeof depuisId === "string" &&
        ligne.machines.some((machine) => machine.machine_id === depuisId);
      return rattachee ? `/parc/${depuisId}` : retourPlanning(ligne.date_planifiee);
    }
    case "planning":
      return retourPlanning(ligne.date_planifiee);
  }
}

/** Le libellé du lien de retour, assorti à `retourFiche` ci-dessus. */
export function libelleRetourFiche(
  depuis: string | readonly string[] | undefined,
): string {
  const valeur = Array.isArray(depuis) ? depuis[0] : depuis;
  if (!estOrigineFiche(valeur)) {
    return t("planning.retour_fleche");
  }
  switch (valeur) {
    case "interventions":
      return t("intervention.retour.interventions");
    case "client":
      return t("intervention.retour.client");
    case "site":
      return `${t("intervention.retour.site_prefixe")} ${motDansUnePhrase("site")}`;
    case "machine":
      return t("intervention.retour.machine");
    case "planning":
      return t("planning.retour_fleche");
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
