import { type TypeIntervention } from "@prisma/client";

import type { Colonne } from "@/components/ui/tableau";
import { libelleAgenceAvecCode } from "@/lib/agences/presentation";
import type { Annuaire } from "@/lib/auth/annuaire";
import {
  cleJour,
  dateCivile,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { ancienneteEnJours } from "@/lib/interventions/affichage";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import type { IssueSignature } from "@/lib/interventions/saisie";
import { quiTravaille } from "@/lib/interventions/personnes";
import {
  PRIORITES,
  type RechercheInterventions,
  type StatutIntervention,
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
 * LE CHAMP EN CAUSE D'UN REFUS DE SAISIE (GR17-M14, audit GR du 26/09,
 * constats M14) — pour encadrer et focaliser CE champ sur
 * `/interventions/nouvelle`, plutôt que de laisser le bandeau seul porter la
 * raison.
 *
 * Seuls trois motifs désignent un champ avec CERTITUDE : `type` pour la
 * nature manquante, `description` pour la panne manquante, et depuis
 * TP-UX5-1-FORMULAIRES (décision 15 d'Alexis du 05/10/2026) `priorite` pour
 * la priorité manquante. `intervention.refus.lieu_inconnu` est un REPLI qui
 * couvre « tout le reste » (`app/api/interventions/creer/route.ts`) — jamais
 * le champ Site à coup sûr — et rend `null`, comme tout motif qui n'est
 * aucun des trois.
 */
export function champEnCause(
  motif: string,
): "type" | "description" | "priorite" | null {
  if (motif === "intervention.refus.nature_manquante") {
    return "type";
  }
  if (motif === "intervention.refus.panne_manquante") {
    return "description";
  }
  if (motif === "intervention.refus.priorite_manquante") {
    return "priorite";
  }
  return null;
}

/**
 * LE MOTIF D'UNE RECHERCHE INVALIDE (IN-07, audit du 28/09) — jusqu'ici
 * `criteres.error` n'était lu nulle part : `schemaRechercheInterventions`
 * échoue, et la page se vide en silence (`COMPTES_VUE_VIDES`), sans jamais
 * dire pourquoi.
 *
 * **La période inversée est le seul cas qu'on puisse NOMMER avec certitude**
 * — le refine du schéma pose son issue sur `au`, avec le code `"custom"` que
 * seul CE refine émet dans ce schéma. Tout le reste (un UUID malformé, par
 * exemple) retombe sur un motif générique : mieux vaut une phrase qui invite
 * à tout effacer qu'une désignation de champ hasardeuse.
 */
export function motifCriteresInvalides(erreur: {
  readonly issues: ReadonlyArray<{
    readonly path: ReadonlyArray<PropertyKey>;
    readonly code: string;
  }>;
}):
  | "interventions.refus.periode_inversee"
  | "interventions.refus.recherche_invalide" {
  const periodeInversee = erreur.issues.some(
    (issue) => issue.code === "custom" && issue.path.join(".") === "au",
  );
  return periodeInversee
    ? "interventions.refus.periode_inversee"
    : "interventions.refus.recherche_invalide";
}

/**
 * L'ÉTAT VIDE DU REGISTRE (IN-12, audit du 28/09) — jusqu'ici, `interventions.
 * vide` s'affichait à la fois pour un registre RÉELLEMENT vide (aucune
 * intervention n'existe) et pour un filtre ou une recherche qui n'en trouve
 * aucune : le second cas a une action (« effacez vos critères »), le premier
 * n'en a aucune, et le même texte servait les deux à tort.
 *
 * `criteresValides === false` compte comme un filtre actif : une recherche
 * invalide reste une intention de filtrer, jamais un registre vide.
 */
export function etatVideDuRegistre(parametres: {
  readonly criteresValides: boolean;
  readonly filtreActif: boolean;
}): "interventions.vide" | "interventions.vide_filtre" {
  return !parametres.criteresValides || parametres.filtreActif
    ? "interventions.vide_filtre"
    : "interventions.vide";
}

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
 * LE TITRE DE LA FICHE — « <client> — Intervention <référence> » (TR-51,
 * audit du 28/09/2026 ; 9DR-TP-NAV2-RETOURS-FIL). Mesuré faux sur main : le
 * `<h1>` ne portait que « Intervention <ref> », sans jamais nommer le
 * client — une fiche ouverte par son numéro ne disait pas DE QUI il
 * s'agissait. `client` vient déjà résolu de `lireFicheIntervention`
 * (jointure sous le contexte cloisonné) : `null` seulement si l'intervention
 * est hors périmètre, un cas que la garde d'accès a déjà écarté avant que
 * cette fonction soit appelée — mais le repli reste écrit, jamais supposé.
 *
 * `generateMetadata` et le `<h1>` appellent la MÊME fonction : le titre
 * d'onglet suit le titre affiché, jamais une seconde composition (§9, 01/09).
 */
export function titreDeLaFiche(
  ligne: { id: string; numero: number | null },
  client: string | null,
): string {
  const titre = `${t("intervention.titre")} ${referenceAffichee(ligne)}`;
  return client === null
    ? titre
    : `${client}${t("ponctuation.separateur")}${titre}`;
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
 * **`machine` et `demande` portent un second paramètre**, `depuisId` : une
 * intervention peut porter PLUSIEURS machines (I1 ne le borne pas), la fiche
 * ne sait donc pas SEULE laquelle a ouvert le lien — et une demande n'est
 * qu'une COLONNE (`demande_id`), pas une clé qui se vérifierait seule. Dans
 * les deux cas, il n'est accepté que s'il désigne quelque chose RÉELLEMENT
 * rattaché à cette intervention — jamais recopié tel quel vers le lien rendu.
 *
 * *99I-RETOUR-FICHE, audit d'ergonomie du 25/09/2026, constat 21 (2e
 * moitié) : les deux écrans qui ouvrent cette fiche depuis une demande
 * (`/demandes/{id}`) ou depuis les absences (`/absences`) ne posaient AUCUN
 * `depuis` — le retour y affichait donc « Retour au planning », faux dans
 * les deux cas.*
 *
 * **`tableau_de_bord` s'ajoute le 06/10/2026** (audit TP-NAV du 28/09,
 * constat 3 ; 9DR-TP-NAV2-RETOURS-FIL) : les trois listes de priorités du
 * tableau de bord menaient déjà à cette fiche sans poser `depuis`, et le
 * retour y affichait donc « Retour au planning », faux depuis ce tableau.
 */
const VALEURS_DEPUIS = [
  "planning",
  "interventions",
  "client",
  "site",
  "machine",
  "demande",
  "absences",
  "tableau_de_bord",
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
  // TP-UX3-1-REGISTRE-1 (QE-8) — trois états de plus que le retour doit
  // rejouer : la priorité, le suivi, et la densité d'affichage.
  "priorite",
  "suivi",
  "densite",
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
    readonly demande_id: string | null;
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
    case "demande": {
      const depuisId = Array.isArray(parametres.depuisId)
        ? parametres.depuisId[0]
        : parametres.depuisId;
      const rattachee =
        typeof depuisId === "string" && depuisId === ligne.demande_id;
      return rattachee
        ? {
            href: `/demandes/${depuisId}`,
            libelle: t("intervention.retour.demande"),
          }
        : parPlanning;
    }
    case "absences":
      return {
        href: "/absences",
        libelle: `${t("intervention.retour.absences_prefixe")} ${decapitalisee(t("absences.titre"))}`,
      };
    case "tableau_de_bord":
      return {
        href: "/tableau-de-bord",
        libelle: t("intervention.retour.tableau_de_bord"),
      };
    case "planning":
      return parPlanning;
  }
}

/**
 * MÊME DÉCAPITALISATION QUE `motDansUnePhrase` (`lib/i18n/vocabulaire.ts`),
 * mais pour un TITRE D'ÉCRAN plutôt qu'un mot imposé : ce lien-ci glisse le
 * titre de la page des absences au milieu d'une phrase, et sa capitale
 * d'écran y serait une faute de français.
 */
function decapitalisee(texte: string): string {
  return texte.charAt(0).toLocaleLowerCase("fr") + texte.slice(1);
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

const SEPARATEUR_RESUME = " · ";
const TIRET_CRENEAU = "–";

/**
 * LE JOUR ABRÉGÉ D'UN JOUR CIVIL, SANS FUSEAU — comme `dateCivile`
 * (`date_planifiee` est une colonne `@db.Date`, un jour civil stocké à minuit
 * UTC ; le lire dans un fuseau le déplacerait d'un cran sous UTC+11, la même
 * réserve que celle qui vit sur `dateCivile`).
 *
 * Distinct de `jour.court.N` (`fr.ts`) — capitalisé, sans point, réservé aux
 * en-têtes de colonne du planning et des absences : la même valeur écrite
 * dans une autre casse serait un second vocabulaire pour le même jour.
 */
function jourAbregeDuJourCivil(date: Date): CleTraduction {
  switch (date.getUTCDay()) {
    case 0:
      return "intervention.resume.jour_abrege.dimanche";
    case 1:
      return "intervention.resume.jour_abrege.lundi";
    case 2:
      return "intervention.resume.jour_abrege.mardi";
    case 3:
      return "intervention.resume.jour_abrege.mercredi";
    case 4:
      return "intervention.resume.jour_abrege.jeudi";
    case 5:
      return "intervention.resume.jour_abrege.vendredi";
    default:
      return "intervention.resume.jour_abrege.samedi";
  }
}

/**
 * « 25/09 » — LE JOUR ET LE MOIS D'UN JOUR CIVIL, SANS FUSEAU (voir
 * `jourAbregeDuJourCivil` juste au-dessus pour la réserve sur le fuseau).
 *
 * Partagé par `jourEtDateAbregee` et `mentionDeplanifiee`
 * (9CC-DEPLANIFIEE-1) : *jamais un second formateur* pour le même « JJ/MM »
 * (§9, 01/09).
 *
 * EXPORTÉE depuis TP-UX3-1-REGISTRE-2 : la colonne « Pièce attendue » du
 * registre en a besoin pour « disponible le JJ/MM » (`date_dispo_prevue` est
 * `@db.Date`, la même réserve sur le fuseau que `date_planifiee`).
 */
export function jourMois(date: Date): string {
  const jour = String(date.getUTCDate()).padStart(2, "0");
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

/**
 * « jeu. 25/09 », ou « jeu. 25/09/2025 » AVEC `avecAnnee` — le jour abrégé et
 * le jour civil (IN-23, audit du 28/09/2026) : une fiche REPRISE d'un import
 * peut dater de plusieurs années, et l'année manquante y devient ambiguë,
 * alors qu'elle ne l'est jamais sur une fiche courante.
 */
function jourEtDateAbregee(date: Date, avecAnnee: boolean): string {
  const base = `${t(jourAbregeDuJourCivil(date))} ${jourMois(date)}`;
  return avecAnnee ? `${base}/${date.getUTCFullYear()}` : base;
}

/**
 * LE CRÉNEAU ET SA DURÉE, DANS LE RÉSUMÉ DE LA FICHE (PG-A5-FICHE-CRENEAU,
 * audit d'ergonomie du 27/09/2026, §4.4) — *l'information n°1 d'un
 * planificateur qui ouvre cette fiche* affichait une date et une heure, jamais
 * la durée, alors qu'elle est obligatoire pour planifier (contrainte
 * `intervention_planifiee_a_sa_duree`).
 *
 * L'heure de fin est celle que porte déjà `creneau_fin` — la même colonne que
 * la pose écrit aux côtés de `creneau_debut` (`lib/interventions/depot.ts`),
 * jamais recalculée ici à partir de la durée (§9, 01/09 : une seconde lecture
 * d'un même fait diverge en silence).
 *
 * `avecAnnee` (IN-23) : l'appelant la pose à `true` sur une fiche REPRISE
 * d'un import (`estRepriseDunImport`) — jamais recalculée ici, l'année n'est
 * qu'un habillage de la même date.
 */
export function resumeDuCreneau(
  ligne: {
    readonly date_planifiee: Date | null;
    readonly creneau_debut: Date | null;
    readonly creneau_fin: Date | null;
    readonly duree_estimee_min: number | null;
  },
  fuseau: Fuseau,
  options?: { readonly avecAnnee?: boolean },
): string {
  if (ligne.date_planifiee === null) {
    return t("statut.a_planifier");
  }
  const jourEtDate = jourEtDateAbregee(
    ligne.date_planifiee,
    options?.avecAnnee ?? false,
  );
  const debut = heureDuCreneau(ligne, fuseau);
  if (debut === null) {
    return `${jourEtDate}${SEPARATEUR_RESUME}${t("intervention.resume.heure_non_fixee")}`;
  }
  if (ligne.duree_estimee_min === null) {
    return `${jourEtDate}${SEPARATEUR_RESUME}${debut}${SEPARATEUR_RESUME}${t("intervention.resume.duree_non_renseignee")}`;
  }
  const fin = heureDuCreneau({ creneau_debut: ligne.creneau_fin }, fuseau);
  const intervalle = fin === null ? debut : `${debut}${TIRET_CRENEAU}${fin}`;
  return `${jourEtDate}${SEPARATEUR_RESUME}${intervalle} (${enDuree(ligne.duree_estimee_min)})`;
}

/** Ce qu'une carte ou une fiche affiche pour une ligne déplanifiée par une absence. */
export type MentionDeplanifiee = {
  /** « Déplanifiée — absence de X le JJ/MM ». */
  readonly titre: string;
  /** « Ancien créneau : jeu. 25/09 · 09:00–10:00 (1 h) ». */
  readonly ancienCreneau: string;
};

/**
 * LA MENTION « DÉPLANIFIÉE — ABSENCE DE X LE JJ/MM » (9CC-DEPLANIFIEE-1,
 * constat 38 de l'audit d'ergonomie du 25/09/2026) — dans la file « À
 * planifier » et sur la fiche, jamais ailleurs.
 *
 * `null` dès que la ligne n'a plus de trace (`deplanifiee_date` nul) OU
 * qu'elle n'est plus `a_planifier` : une ligne reposée efface sa trace
 * (`deplacerIntervention`), et cette fonction ne juge rien d'autre que ce que
 * la ligne porte déjà — jamais un second critère de « vient-elle d'une
 * absence ? ».
 *
 * **« le JJ/MM » lit `deplanifiee_date` — le jour de l'absence, toujours
 * compris dans sa période (`interventionsADeplanifier`) — jamais
 * `deplanifiee_le` (l'instant où le blocage a été posé)** : point à confirmer
 * par Alexis (voir la passation du ticket), qui ne coûte qu'un changement
 * d'affichage s'il devait changer.
 *
 * **L'ancien créneau est composé par `resumeDuCreneau`, appliquée aux quatre
 * champs `deplanifiee_*` et à `duree_estimee_min` (GARDÉE, jamais effacée par
 * une déplanification — voir `lib/absences/depot.ts`)** : jamais un second
 * calcul de résumé de créneau (§9, 01/09).
 */
/**
 * LA LIGNE EST-ELLE DÉPLANIFIÉE, EN ATTENTE D'UNE NOUVELLE POSE ? — le même
 * garde-fou que `mentionDeplanifiee` ci-dessous, EXTRAIT pour que la colonne
 * « Demande » du registre (TP-UX3-1-REGISTRE-2, pastille « rendue par une
 * absence ») le lise sans avoir besoin du nom de l'absent ni du fuseau —
 * elle ne montre qu'une mention fixe, jamais l'ancien créneau détaillé.
 * Jamais une seconde écriture de ce critère (§9, 01/09).
 */
export function estDeplanifieeEnAttente<
  T extends {
    readonly statut: StatutIntervention;
    readonly deplanifiee_date: Date | null;
  },
>(ligne: T): ligne is T & { readonly deplanifiee_date: Date } {
  return ligne.deplanifiee_date !== null && ligne.statut === "a_planifier";
}

export function mentionDeplanifiee(
  ligne: {
    readonly statut: StatutIntervention;
    readonly deplanifiee_date: Date | null;
    readonly deplanifiee_creneau_debut: Date | null;
    readonly deplanifiee_creneau_fin: Date | null;
    readonly duree_estimee_min: number | null;
  },
  nomAbsent: string,
  fuseau: Fuseau,
): MentionDeplanifiee | null {
  if (!estDeplanifieeEnAttente(ligne)) {
    return null;
  }
  return {
    titre: `${t("intervention.deplanifiee.avant")} ${nomAbsent} ${t("intervention.deplanifiee.le")} ${jourMois(ligne.deplanifiee_date)}`,
    ancienCreneau: `${t("intervention.deplanifiee.ancien_creneau")} ${resumeDuCreneau(
      {
        date_planifiee: ligne.deplanifiee_date,
        creneau_debut: ligne.deplanifiee_creneau_debut,
        creneau_fin: ligne.deplanifiee_creneau_fin,
        duree_estimee_min: ligne.duree_estimee_min,
      },
      fuseau,
    )}`,
  };
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
 * L'URL D'UN ONGLET — les AUTRES filtres actifs préservés, `vue` posé, et la
 * page toujours remise à 1 : changer d'onglet est une nouvelle recherche,
 * pas une page suivante de l'ancienne.
 *
 * **« Toutes » pose `?vue=toutes` EN TOUTES LETTRES** (décision 13 d'Alexis
 * du 05/10/2026) — jamais une adresse nue : depuis ce ticket, l'adresse nue
 * ouvre « À planifier » (voir `vueEffectiveDuRegistre` ci-dessous), et
 * « Toutes » a donc besoin de sa propre marque explicite pour rester
 * atteignable par son propre lien. `schemaRechercheInterventions` accepte
 * déjà `"toutes"` et le rend `null` — une valeur hors de `VUES_REGISTRE`,
 * comme n'importe quelle autre valeur inconnue (§9, 01/09 : un même critère,
 * jamais une seconde forme).
 */
export function hrefOnglet(
  parametresActifs: Readonly<Record<string, string | undefined>>,
  vue: VueRegistre | null,
): string {
  return hrefDeLaPage(
    "/interventions",
    { ...parametresActifs, vue: vue ?? "toutes" },
    1,
  );
}

/**
 * L'ONGLET VRAIMENT ACTIF (décision 13 d'Alexis du 05/10/2026,
 * TP-UX3-1-REGISTRE-1) — `schemaRechercheInterventions` ne peut pas
 * distinguer « absent » de « `vue=toutes` » : les deux retombent à `null`
 * (§9, 01/09 : une valeur hors liste fermée ne doit jamais faire échouer
 * toute la recherche). Cette fonction lit donc le paramètre BRUT, une seule
 * fois, pour que la page, les onglets et tous les liens qu'elle compose
 * s'accordent sur UNE SEULE réponse à « quel onglet est ouvert ? ».
 *
 * `"toutes"` EXPLICITE → « Toutes » (aucun filtre de statut). Toute autre
 * valeur absente ou inconnue → `a_planifier`, l'onglet par défaut de la
 * maquette (§5.3). Une valeur de `VUES_REGISTRE` reste elle-même.
 */
export function vueEffectiveDuRegistre(
  vueBrut: string | readonly string[] | undefined,
  vueAnalysee: VueRegistre | null,
): VueRegistre | "toutes" {
  if (vueAnalysee !== null) {
    return vueAnalysee;
  }
  const brut = Array.isArray(vueBrut) ? vueBrut[0] : vueBrut;
  return brut === "toutes" ? "toutes" : "a_planifier";
}

/**
 * L'URL D'UN CHOIX DE DENSITÉ (TP-UX3-1-REGISTRE-1) — TOUS les autres
 * paramètres actifs préservés, la PAGE COURANTE comprise (changer de
 * densité ne doit pas renvoyer à la page 1, à la différence d'un onglet ou
 * d'un filtre : ce n'est pas une nouvelle recherche). `densite` est retiré
 * pour « Confort » (son état par défaut), posé pour « Compact ».
 */
export function hrefDensite(
  parametresActifs: Readonly<Record<string, string | undefined>>,
  page: number,
  densite: "confort" | "compact",
): string {
  return hrefDeLaPage(
    "/interventions",
    {
      ...parametresActifs,
      densite: densite === "compact" ? "compact" : undefined,
    },
    page,
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
  if (criteres.priorite !== null) {
    puces.push({
      cle: "priorite",
      libelle: `${t("interventions.filtre_priorite_label")}${deuxPoints}${t(`priorite.${criteres.priorite}`)}`,
      href: sansCritere(["priorite"]),
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
  // LE SUIVI (TP-UX3-1-REGISTRE-1) — `suivi=sans_duree_a_venir` est un second
  // CHEMIN vers le MÊME critère que le paramètre historique
  // `sans_duree_a_venir=1` (AFFICHAGE-MATERIEL-1) : une seule puce pour les
  // deux, qui retire les DEUX clés — poser l'une sans l'autre laisserait le
  // filtre actif sous l'autre forme.
  if (criteres.sans_duree_a_venir || criteres.suivi === "sans_duree_a_venir") {
    puces.push({
      cle: "sans_duree_a_venir",
      libelle: t("interventions.puce_sans_duree"),
      href: sansCritere(["sans_duree_a_venir", "suivi"]),
    });
  }
  // SUIVI « SOUS GARANTIE, OUVERTES » (TP-UX3-1-REGISTRE-2, choix du pilote
  // C1 du 07/10/2026) — une seule valeur de `suivi`, jamais un second chemin
  // comme `sans_duree_a_venir` ci-dessus.
  if (criteres.suivi === "garantie_ouvertes") {
    puces.push({
      cle: "suivi",
      libelle: t("interventions.puce_garantie_ouvertes"),
      href: sansCritere(["suivi"]),
    });
  }
  return puces;
}

/**
 * « TOUT EFFACER » — reprend l'onglet (`vue`) ET la densité tels quels,
 * retire tout le reste. L'onglet est une NAVIGATION (les tabs au-dessus du
 * tableau), pas un filtre du formulaire : l'effacer ici surprendrait qui
 * vient de cliquer « Bloquées » puis « Tout effacer » sur une recherche
 * posée par-dessus. La densité (TP-UX3-1-REGISTRE-1) n'est pas davantage un
 * filtre — un choix d'affichage, jamais un critère de recherche.
 */
export function hrefEffacerLesFiltres(
  parametresPuces: Readonly<Record<string, string | undefined>>,
): string {
  return hrefDeLaPage(
    "/interventions",
    { vue: parametresPuces.vue, densite: parametresPuces.densite },
    1,
  );
}

/**
 * LE LIEN D'EXPORT (MO-9, D169) — mêmes paramètres d'adresse que le registre
 * lui-même, `page` exclu : l'export n'en pagine aucun, il rend tout le
 * filtre (`listerInterventionsPourExport`, `lib/interventions/depot.ts`).
 */
/**
 * `idsSelectionnes` (TP-UX3-1-REGISTRE-2) — les identifiants cochés dans la
 * barre de sélection, un paramètre `id` RÉPÉTÉ (jamais une liste jointe en un
 * seul paramètre, que l'export lirait par `getAll` — voir
 * `app/api/interventions/exporter/route.ts`).
 */
export function hrefExportInterventions(
  parametres: Readonly<Record<string, string | undefined>>,
  idsSelectionnes?: readonly string[],
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur.length > 0) {
      recherche.set(cle, valeur);
    }
  }
  for (const id of idsSelectionnes ?? []) {
    recherche.append("id", id);
  }
  const chaine = recherche.toString();
  return `/api/interventions/exporter${chaine.length > 0 ? `?${chaine}` : ""}`;
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
  const heures = String(local.heures).padStart(2, "0");
  const minutes = String(local.minutes).padStart(2, "0");
  return `${dateLocale(instant, fuseau)} ${heures}:${minutes}`;
}

/**
 * LE MÊME JOUR, SANS L'HEURE (TP-UX3-1-REGISTRE-2) — la colonne « Depuis » du
 * registre (`suspendue_le`, un `Timestamptz` comme un segment de travail,
 * voir `dateHeureLocale` ci-dessus pour la même réserve sur le fuseau).
 * Extraite plutôt que recopiée : `dateHeureLocale` l'appelle désormais, jamais
 * un second calcul des mêmes trois composantes (§9, 01/09).
 */
export function dateLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}

/** Un évènement de la chronologie — un libellé (clé du dictionnaire) et son instant. */
export type EvenementChronologie = {
  readonly cle: CleTraduction;
  readonly instant: Date;
};

/** Le minimum qu'une fiche porte pour juger si elle est reprise d'un import. */
export type FichePourReprise = {
  readonly creeLe: Date;
  readonly pauses: readonly {
    readonly debut: Date;
    readonly fin: Date | null;
  }[];
  readonly clotureeLe: Date | null;
  readonly annuleeLe: Date | null;
};

/**
 * LA FICHE EST-ELLE REPRISE D'UN IMPORT ? (audit du 25/09, constat 22 ;
 * extrait pour IN-23, audit du 28/09/2026) — un fait daté précède `creeLe`,
 * l'instant d'enregistrement de la ligne. `creerInterventionsRepriseEnLot`
 * (`lib/interventions/depot-reprise.ts`) écrit toujours `cloturee_le` au jour
 * du document, sans créneau ni pause : c'est ce seul fait, antérieur à
 * l'enregistrement, qui trahit l'archive — jamais une seconde colonne.
 *
 * MÊME CRITÈRE que celui déjà écrit dans `chronologieDeLaFiche`, qui
 * l'appelle désormais plutôt que de le recalculer (§9, 01/09 : une seconde
 * lecture d'un même fait diverge en silence).
 */
export function estRepriseDunImport(fiche: FichePourReprise): boolean {
  const instants: Date[] = [];
  for (const pause of fiche.pauses) {
    instants.push(pause.debut);
    if (pause.fin !== null) {
      instants.push(pause.fin);
    }
  }
  if (fiche.clotureeLe !== null) {
    instants.push(fiche.clotureeLe);
  }
  if (fiche.annuleeLe !== null) {
    instants.push(fiche.annuleeLe);
  }
  return instants.some((instant) => instant.getTime() < fiche.creeLe.getTime());
}

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
export function chronologieDeLaFiche(
  fiche: FichePourReprise,
): readonly EvenementChronologie[] {
  const evenements: EvenementChronologie[] = [];
  for (const pause of fiche.pauses) {
    evenements.push({
      cle: "intervention.chronologie.suspension",
      instant: pause.debut,
    });
    if (pause.fin !== null) {
      evenements.push({
        cle: "intervention.chronologie.reprise",
        instant: pause.fin,
      });
    }
  }
  if (fiche.clotureeLe !== null) {
    evenements.push({
      cle: "intervention.chronologie.cloture",
      instant: fiche.clotureeLe,
    });
  }
  if (fiche.annuleeLe !== null) {
    evenements.push({
      cle: "intervention.chronologie.annulation",
      instant: fiche.annuleeLe,
    });
  }
  // Fiche REPRISE d'un import (audit du 25/09, constat 22) : « Créée »
  // mentirait — l'évènement se nomme alors pour ce qu'il est.
  evenements.push({
    cle: estRepriseDunImport(fiche)
      ? "intervention.chronologie.enregistrement"
      : "intervention.chronologie.creation",
    instant: fiche.creeLe,
  });
  return [...evenements].sort(
    (a, b) => a.instant.getTime() - b.instant.getTime(),
  );
}

/**
 * LE TEXTE QUAND AUCUN SEGMENT N'EST ENREGISTRÉ (correctif IN-23, audit du
 * 28/09/2026) — *mesuré fautif sur `main` :* une intervention CLÔTURÉE ou
 * ANNULÉE affichait « le compteur n'a pas encore tourné », qui annonce un
 * avenir que ces deux statuts n'ont plus. Le texte d'origine reste exact
 * pour tout autre statut, où le compteur peut encore tourner.
 */
export function texteSansSegment(statut: StatutIntervention): CleTraduction {
  return statut === "cloturee" || statut === "annulee"
    ? "intervention.realisation.aucun_segment_termine"
    : "intervention.realisation.aucun_segment";
}

/**
 * LE BANDEAU D'UNE FICHE REPRISE D'UN IMPORT (IN-23, audit du 28/09/2026) —
 * *aucun bandeau n'existait*, alors que rien ne distingue à l'écran une
 * fiche née d'un import d'une fiche née dans CODIPLAN. `clotureeLe` est le
 * jour du document (`creerInterventionsRepriseEnLot`), un jour CIVIL —
 * `dateCivile`, jamais un fuseau.
 */
export function texteBandeauReprise(clotureeLe: Date): string {
  return `${t("intervention.reprise.bandeau")} ${dateCivile(clotureeLe)}`;
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

/** La note sous le champ Site de la fiche et de la demande — « Déduite du
 * site. » (GR16h). Même raisonnement que les trois fonctions ci-dessus. */
export function deduiteDuSite(): string {
  return `${t("intervention.deduite_du_prefixe")} ${motDansUnePhrase("site")}.`;
}

/**
 * TROIS TEXTES DE `/interventions/nouvelle` (92-CREATION-2, audit
 * d'ergonomie du 25/09/2026, constats 7 et 8) — même raison que
 * `segmentsSurSiteTitre` ci-dessus : le mot imposé ne s'écrit qu'ici, jamais
 * dans le dictionnaire ni dans l'écran.
 *
 * `libelleChampObligatoire` a déménagé vers `lib/i18n/obligatoire.ts`
 * (GR16i, 27/09/2026) : elle ne compose aucun mot imposé, et la fiche
 * machine devait pouvoir l'appeler sans dépendre de ce module.
 */

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

/**
 * LE LIBELLÉ DU CHAMP MACHINE, DEVENU FACULTATIF À L'ÉCRAN (TP-UX5-1-
 * FORMULAIRES, maquette du 28/09) — « Machine (facultatif : sans machine,
 * l'intervention porte sur le site) ». Le mot imposé se compose ici, jamais
 * dans `fr.ts` (D5, D47, L0-11), comme `agenceDeduiteDuSite` juste au-dessus.
 */
export function libelleMachineFacultative(): string {
  return `${t("intervention.machine")} ${t("intervention.machine.facultatif_prefixe")} ${motDansUnePhrase("site")}${t("intervention.machine.facultatif_suffixe")}`;
}

/**
 * LA PHRASE DE LA CARTE « RÉCAPITULATIF » AVANT TOUT CHOIX (TP-UX5-1-
 * FORMULAIRES, maquette du 28/09, SANS les horaires d'accès, le trajet ni les
 * consignes — hors de ce lot).
 */
export function recapitulatifVide(): string {
  return `${t("intervention.creation.recapitulatif_vide_prefixe")} ${motDansUnePhrase("site")} ${t("intervention.creation.recapitulatif_vide_suffixe")}`;
}

/**
 * LA PHRASE DE LA CARTE « QUI SERA PRÉVENU » AVANT TOUT CHOIX (TP-UX5-1-
 * FORMULAIRES, maquette du 28/09) — « Le donneur d'ordre du site. ».
 */
export function prevenuVide(): string {
  return `${t("intervention.creation.prevenu_vide_prefixe")} ${motDansUnePhrase("site")}${t("intervention.creation.prevenu_vide_suffixe")}`;
}

/**
 * LES OPTIONS DU GROUPE « PRIORITÉ » DE LA CRÉATION (TP-UX5-1-FORMULAIRES) —
 * composées ICI, un fichier `.ts`, plutôt que dans l'écran `.tsx` : le
 * gardien GR5/D144 (`tests/unit/ui/priorite-une-correspondance.test.ts`)
 * exige de tout `.tsx` qui rend une clé `priorite.` qu'il appelle
 * `tonDePriorite` ou rende `<Priorite>` — une exigence pensée pour un
 * affichage, pas pour un groupe de boutons à choisir (la maquette du 28/09
 * les montre sans couleur de priorité). Composer la liste ici évite
 * d'imposer une couleur qu'aucune maquette ne demande à cet écran.
 */
export function optionsPriorite(): readonly {
  readonly valeur: string;
  readonly libelle: string;
}[] {
  return PRIORITES.map((valeur) => ({
    valeur,
    libelle: t(`priorite.${valeur}`),
  }));
}

/**
 * ── LES COLONNES DU REGISTRE, PAR ONGLET (TP-UX3-1-REGISTRE-2, QE-8 (a) du
 * 03/10/2026) ──────────────────────────────────────────────────────────────
 *
 * *Mesuré sur `main` avant ce ticket : les HUIT onglets du registre
 * montraient les MÊMES huit colonnes* — Référence, Client, Machine, Site,
 * Technicien, Date planifiée, Priorité, Statut — alors que la spécification
 * du 28/09/2026 (§5.3) en dessine un jeu DIFFÉRENT pour chacun : ce que « À
 * planifier » doit montrer (l'ancienneté, la durée à estimer) n'est pas ce
 * que « Suspendues » doit montrer (depuis quand, quel motif, quelle pièce).
 *
 * **Une seule fonction décide, par onglet, jamais huit écritures séparées**
 * (§9, 01/09) : `colonnesDuRegistre` rend le jeu de colonnes, et
 * `LigneIntervention` (`page.tsx`) lit CE MÊME jeu pour savoir quelle cellule
 * rendre, dans quel ordre — jamais une seconde liste qui pourrait diverger.
 *
 * `client_site` compose son en-tête ICI (« Client · Site ») plutôt qu'au
 * dictionnaire : le mot imposé « site » (D5, D47) ne s'écrit jamais en dur
 * dans `lib/i18n/fr.ts`, même au milieu d'un intitulé composé — voir `mot`
 * (`lib/i18n/vocabulaire.ts`).
 *
 * `a_venir` et `historique` ne sont QUE des puces (`page.tsx`), jamais des
 * onglets de la rangée (`OngletsRegistre`) — la spécification ne dessine pas
 * de jeu de colonnes pour elles : elles reprennent celui de « Toutes »,
 * faute d'une autre règle écrite.
 */
export type CleColonneRegistre =
  | "selection"
  | "prio"
  | "intervention"
  | "client_site"
  | "demande"
  | "anciennete"
  | "duree"
  | "heure"
  | "prevue"
  | "debut"
  | "statut"
  | "technicien"
  | "compteur"
  | "depuis"
  | "motif"
  | "piece_attendue"
  | "terminee"
  | "rapport"
  | "date"
  | "action";

export type ColonneRegistre = Colonne & { readonly cle: CleColonneRegistre };

/** « Client · Site » — composée, jamais écrite en dur (D5, D47). */
function libelleColonneClientSite(): string {
  return `${t("intervention.client")}${SEPARATEUR_RESUME}${mot("site")}`;
}

export function colonnesDuRegistre(
  vue: VueRegistre | "toutes",
): readonly ColonneRegistre[] {
  switch (vue) {
    case "a_planifier":
      return [
        {
          cle: "prio",
          libelle: t("interventions.colonne.prio"),
          largeur: "64px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "demande", libelle: t("interventions.colonne.demande") },
        {
          cle: "anciennete",
          libelle: t("interventions.colonne.anciennete"),
          largeur: "110px",
        },
        {
          cle: "duree",
          libelle: t("interventions.colonne.duree"),
          largeur: "110px",
        },
        {
          cle: "action",
          libelle: t("interventions.colonne.poser"),
          largeur: "110px",
        },
      ];
    case "aujourdhui":
      return [
        {
          cle: "heure",
          libelle: t("interventions.colonne.heure"),
          largeur: "80px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "technicien", libelle: t("intervention.technicien") },
        { cle: "statut", libelle: t("intervention.statut") },
        {
          cle: "action",
          libelle: t("interventions.colonne.transmettre_controler"),
          largeur: "160px",
        },
      ];
    case "en_retard":
      return [
        {
          cle: "prevue",
          libelle: t("interventions.colonne.prevue"),
          largeur: "100px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "technicien", libelle: t("intervention.technicien") },
        { cle: "statut", libelle: t("intervention.statut") },
        {
          cle: "action",
          libelle: t("interventions.colonne.deplacer"),
          largeur: "120px",
        },
      ];
    case "en_cours":
      return [
        {
          cle: "debut",
          libelle: t("interventions.colonne.debut"),
          largeur: "80px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "technicien", libelle: t("intervention.technicien") },
        {
          cle: "compteur",
          libelle: t("interventions.colonne.compteur"),
          largeur: "110px",
        },
      ];
    case "bloquees":
      return [
        {
          cle: "depuis",
          libelle: t("interventions.colonne.depuis"),
          largeur: "100px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "motif", libelle: t("interventions.colonne.motif") },
        {
          cle: "piece_attendue",
          libelle: t("interventions.colonne.piece_attendue"),
          largeur: "150px",
        },
        {
          cle: "action",
          libelle: t("interventions.colonne.poser"),
          largeur: "110px",
        },
      ];
    case "a_controler":
      return [
        {
          cle: "terminee",
          libelle: t("interventions.colonne.terminee"),
          largeur: "100px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "technicien", libelle: t("intervention.technicien") },
        {
          cle: "rapport",
          libelle: t("interventions.colonne.rapport"),
          largeur: "140px",
        },
        {
          cle: "action",
          libelle: t("interventions.colonne.controler"),
          largeur: "100px",
        },
      ];
    case "toutes":
    case "a_venir":
    case "historique":
      return [
        {
          cle: "date",
          libelle: t("interventions.colonne.date"),
          largeur: "100px",
        },
        {
          cle: "intervention",
          libelle: t("interventions.colonne.intervention"),
        },
        { cle: "client_site", libelle: libelleColonneClientSite() },
        { cle: "technicien", libelle: t("intervention.technicien") },
        { cle: "statut", libelle: t("intervention.statut") },
        {
          cle: "prio",
          libelle: t("interventions.colonne.prio"),
          largeur: "70px",
        },
      ];
  }
}

/**
 * LA SÉLECTION EST-ELLE OFFERTE SUR CET ONGLET ? (TP-UX3-1-REGISTRE-2, partie
 * B) — trois onglets seulement, nommés par le ticket : « À planifier »,
 * « Aujourd'hui », « Toutes ». JAMAIS de pose en lot (D106) : la sélection ne
 * sert donc qu'à transmettre (Aujourd'hui) et à exporter (les trois).
 */
export function selectionDisponibleSurLOnglet(
  vue: VueRegistre | "toutes",
): boolean {
  return vue === "a_planifier" || vue === "aujourdhui" || vue === "toutes";
}

/**
 * ── LES CELLULES PROPRES À CHAQUE COLONNE (TP-UX3-1-REGISTRE-2) ────────────
 */

/** « Aujourd'hui » ou « N jours », et « le JJ/MM » dessous — colonne « Ancienneté » (onglet « À planifier » seulement). */
export type AncienneteAffichee = {
  readonly texte: string;
  readonly depuisLe: string;
};

export function ancienneteRegistreAffichee(
  creeLe: Date,
  fuseau: Fuseau,
  aujourdhuiLocal: JourLocal,
): AncienneteAffichee {
  const jours = ancienneteEnJours(creeLe, fuseau, aujourdhuiLocal);
  const texte =
    jours === 0
      ? t("interventions.anciennete.aujourdhui")
      : `${jours} ${
          jours === 1
            ? t("interventions.anciennete.jour_un")
            : t("interventions.anciennete.jours")
        }`;
  const local = versLocal(creeLe, fuseau);
  return {
    texte,
    depuisLe: `${t("interventions.anciennete.le_prefixe")} ${String(
      local.jour,
    ).padStart(2, "0")}/${String(local.mois).padStart(2, "0")}`,
  };
}

/** `duree_estimee_min`, ou « à estimer » — colonne « Durée » (onglet « À planifier »). */
export type DureeRegistreAffichee = {
  readonly texte: string;
  readonly manquante: boolean;
};

export function dureeRegistreAffichee(
  dureeMin: number | null,
): DureeRegistreAffichee {
  return dureeMin === null
    ? { texte: t("interventions.duree_a_estimer"), manquante: true }
    : { texte: enDuree(dureeMin), manquante: false };
}

/**
 * « Prévue » (En retard), « Date » (Toutes) et « Terminée » (À contrôler)
 * lisent TOUTES LES TROIS `date_planifiee` — jamais trois écritures (§9,
 * 01/09). **« Terminée » n'a pas de meilleure date** : aucune colonne ne date
 * l'instant du passage en « terminée » (seul l'état courant est connu, pas
 * l'historique des transitions — voir `chronologieDeLaFiche` plus haut, qui
 * pose la même réserve pour « planification »/« déplacement ») ; c'est donc
 * le jour PRÉVU, pas l'instant réel de la fin, qui s'affiche — écart nommé en
 * D177, jamais une date inventée.
 */
export function dateRegistreAffichee(datePlanifiee: Date | null): string {
  return datePlanifiee === null
    ? t("planning.file_attente")
    : dateCivile(datePlanifiee);
}

/** La première ligne de `description`, tronquée proprement — colonne « Demande ». */
export function descriptionTronquee(
  description: string,
  longueurMax = 60,
): string {
  const premiereLigne = (description.split("\n")[0] ?? "").trim();
  return premiereLigne.length > longueurMax
    ? `${premiereLigne.slice(0, longueurMax - 1)}…`
    : premiereLigne;
}

/** « <référence> — disponible le JJ/MM », ou `null` — colonne « Pièce attendue » (onglet « Suspendues »). */
export type PieceAttendueAffichee = {
  readonly reference: string;
  readonly disponibleLe: string | null;
};

export function pieceAttendueAffichee(ligne: {
  readonly piece_attendue_ref: string | null;
  readonly date_dispo_prevue: Date | null;
}): PieceAttendueAffichee | null {
  if (ligne.piece_attendue_ref === null) {
    return null;
  }
  return {
    reference: ligne.piece_attendue_ref,
    disponibleLe:
      ligne.date_dispo_prevue === null
        ? null
        : `${t("interventions.piece_attendue.disponible_le_prefixe")} ${jourMois(ligne.date_dispo_prevue)}`,
  };
}

/**
 * Le signe d'absence des cellules sans donnée — partagé avec
 * `machinesAffichees` ; EXPORTÉ pour que `page.tsx` l'emploie aussi sur les
 * colonnes « Heure »/« Début »/« Depuis » (`heureDuCreneau`/`dateLocale`
 * rendent `null`, jamais ce signe elles-mêmes) plutôt qu'un second symbole
 * pour la même absence (§9, 01/09).
 */
export const SIGNE_ABSENCE = "—";

export function motifSuspensionAffiche(motif: string | null): string {
  return motif ?? SIGNE_ABSENCE;
}

export function compteurRegistreAffiche(tempsMesureMin: number | null): string {
  return tempsMesureMin === null ? SIGNE_ABSENCE : enDuree(tempsMesureMin);
}

/** « Signée », « Client absent » ou « Refus signature » — colonne « Rapport » (onglet « À contrôler »). */
export function texteRapportColonne(
  issueSignature: { readonly issue: IssueSignature } | null,
): string {
  if (issueSignature === null) {
    return SIGNE_ABSENCE;
  }
  switch (issueSignature.issue) {
    case "signee":
      return t("interventions.colonne.rapport_signee");
    case "client_absent":
      return t("intervention.realisation.signature_absente");
    case "refus_signature":
      return t("intervention.realisation.signature_refusee");
  }
}
