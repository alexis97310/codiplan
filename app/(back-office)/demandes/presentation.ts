import type { TonBadge } from "@/components/ui/badge";
import {
  cleJour,
  jourDe,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import type { EtatAccuse } from "@/lib/demandes/accuse";
import { type LigneDemande } from "@/lib/demandes/depot";
import type { StatutDemande } from "@/lib/demandes/saisie";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { ancienneteEnJours } from "@/lib/interventions/affichage";

import { decompte } from "../presentation";

/**
 * CE QUE LA FILE ET LA FICHE AFFICHENT — pur, sans lecture de base (DEMANDES-1).
 *
 * Même discipline que `../interventions/presentation.tsx` : ce fichier ne
 * décide d'aucune règle de `lib/demandes/`, il compose ce que la lecture a
 * déjà rendu.
 */

/**
 * LA PLUS ANCIENNE EN TÊTE — l'ordre de CET écran, choisi et écrit.
 *
 * `demandesOuvertes` (lib/demandes/depot.ts) ordonne par urgence PUIS par
 * dépôt : c'est le bon ordre pour un tableau de bord, qui veut voir le pire
 * cas d'abord. Une FILE D'ATTENTE répond à une autre question — « qui attend
 * depuis le plus longtemps ? » — et c'est celle que RG-STD-01 (le standard des
 * 30 minutes) pose : une demande urgente déposée il y a cinq minutes ne doit
 * pas faire passer devant elle une demande ordinaire qui attend depuis deux
 * jours. `Tableau` ne trie jamais lui-même (voir son en-tête) : c'est donc ici,
 * et nulle part ailleurs, que l'ordre de la file se décide — un second tri, sur
 * les mêmes lignes, jamais une seconde lecture du critère que
 * `demandesOuvertes` applique déjà pour SON usage à elle.
 */
export function parLaPlusAncienne(
  demandes: readonly LigneDemande[],
): readonly LigneDemande[] {
  return [...demandes].sort(
    (a, b) => a.depose_le.getTime() - b.depose_le.getTime(),
  );
}

/**
 * LE PIED DE LA FILE — « N demande(s) · <ordre> » (TP-DEM, IN-40, D164),
 * repris mot pour mot de la maquette du 28/09 (`:3147`) : le total ET l'ordre
 * de CET onglet, jamais recalculés par `Pagination` qui ne fait que les
 * poser (voir son en-tête).
 */
export function piedDeLaFile(
  total: number,
  ordre: "ancienne" | "recente",
): string {
  const compte = decompte(total, t("demande.total_un"), t("demande.total"));
  const suffixe =
    ordre === "ancienne"
      ? t("demandes.ordre_ancienne")
      : t("demandes.ordre_recente");
  return `${compte} · ${suffixe}`;
}

/**
 * LE TITRE DE LA FICHE — « <client> · <site> » (QE-9 (a) du 03/10/2026, D176 ;
 * revient sur GR17-M5, audit GR du 26/09, constat M5), ou « <client> » seul
 * si le site n'a pas pu être lu, ou « Demande » seul si le client non plus.
 *
 * *Mesuré sur main avant D176 : la fiche composait « Demande — <raison
 * sociale> »* — la maquette du 28/09 (`:3158`) nomme le COUPLE client · site,
 * jamais le client seul : une fiche ouverte depuis la file en montre une
 * dizaine du même client en une page, et c'est le SITE qui les distingue.
 * `demande.titre` (le pluriel) reste inchangé : il sert encore la liste et le
 * `<title>` de l'onglet (§9, 01/09 — deux écrans, une seule clé de LISTE,
 * jamais recomposée ici).
 */
export function titreFiche(
  client: { readonly raison_sociale: string } | null,
  site: { readonly libelle: string } | null,
): string {
  if (client === null) {
    return t("demande.fiche.titre");
  }
  if (site === null) {
    return client.raison_sociale;
  }
  return `${client.raison_sociale}${t("ponctuation.point_median")}${site.libelle}`;
}

/**
 * LE SURTITRE DE LA FICHE — « Demande · DEM-2026-00029 », ou « Demande ·
 * Numéro provisoire » tant que le serveur ne l'a pas attribué (I10 ; la
 * clé `demande.sans_numero` existait déjà, posée avant D176 comme sous-titre).
 */
export function surtitreFiche(numero: number | null): string {
  const identifiant =
    numero === null
      ? t("demande.sans_numero")
      : `DEM-${String(numero).padStart(5, "0")}`;
  return `${t("demande.fiche.titre")}${t("ponctuation.point_median")}${identifiant}`;
}

/**
 * LE SOUS-TITRE DE LA FICHE — « Reçue le JJ/MM à HH:MM · <source> » (QE-9,
 * maquette du 28/09, `:3159`), dans le fuseau de la SOCIÉTÉ (L0-08) — jamais
 * celui du serveur, ni celui de l'agence (c'est `etatAccuse` qui a besoin de
 * celui-là, pas cet affichage).
 */
export function sousTitreReception(
  deposeLe: Date,
  fuseau: Fuseau,
  source: string,
): string {
  const local = versLocal(deposeLe, fuseau);
  const deux = (n: number): string => String(n).padStart(2, "0");
  const date = `${deux(local.jour)}/${deux(local.mois)}`;
  const heure = `${deux(local.heures)}:${deux(local.minutes)}`;
  return `${t("demande.recue.prefixe")} ${date}${t("ponctuation.a")}${heure}${t("ponctuation.point_median")}${source}`;
}

/**
 * LA RÉCEPTION D'UNE DEMANDE, SUR DEUX NIVEAUX — la colonne « Reçue » de la
 * LISTE (QE-9, maquette du 28/09, `recue()` :3146) : « Aujourd'hui HH:MM » ou
 * « JJ/MM HH:MM » en première ligne, « il y a N jour(s) » en seconde tant que
 * ce n'est pas aujourd'hui — jamais pour une demande déposée aujourd'hui,
 * dont la première ligne le dit déjà.
 *
 * `aujourdhuiLocal` est un PARAMÈTRE, lu une seule fois par l'écran qui
 * affiche TOUTE la file — jamais recalculé ligne à ligne (même discipline que
 * `ancienneteEnJours`, dont celle-ci se sert).
 */
export function receptionPremiereLigne(
  deposeLe: Date,
  fuseau: Fuseau,
  aujourdhuiLocal: JourLocal,
): string {
  const local = versLocal(deposeLe, fuseau);
  const deux = (n: number): string => String(n).padStart(2, "0");
  const heure = `${deux(local.heures)}:${deux(local.minutes)}`;
  const jourDepot = jourDe(local);
  if (cleJour(jourDepot) === cleJour(aujourdhuiLocal)) {
    return `${t("demande.recue.aujourdhui")} ${heure}`;
  }
  return `${deux(jourDepot.jour)}/${deux(jourDepot.mois)} ${heure}`;
}

/** `null` pour une demande déposée aujourd'hui : rien à ajouter à la première ligne. */
export function receptionSecondeLigne(
  deposeLe: Date,
  fuseau: Fuseau,
  aujourdhuiLocal: JourLocal,
): string | null {
  const jours = ancienneteEnJours(deposeLe, fuseau, aujourdhuiLocal);
  if (jours === 0) {
    return null;
  }
  return `${t("demande.recue.il_y_a")} ${decompte(
    jours,
    t("demande.recue.jour_un"),
    t("demande.recue.jours"),
  )}`;
}

/**
 * « Sans machine : sur le site » — le mot imposé ne s'écrit qu'ici, jamais
 * dans le dictionnaire (D5, D47, L0-11), même discipline que
 * `../interventions/presentation.ts` (`agenceDeduiteDuSite`, etc.).
 */
export function sansMachineSurLeSite(): string {
  return `${t("demande.transformer.sans_machine_prefixe")} ${motDansUnePhrase("site")}`;
}

/** Le ton de la pastille de statut — une lecture d'apparence, jamais une règle. */
export function tonDuStatutDemande(statut: StatutDemande): TonBadge {
  if (statut === "nouvelle") {
    return "bleu";
  }
  if (statut === "qualifiee") {
    return "orange";
  }
  if (statut === "transformee") {
    return "vert";
  }
  return "gris";
}

/**
 * Un instant, dans le fuseau de la SOCIÉTÉ — jamais celui du serveur (L0-08).
 *
 * Même forme que `../imports/presentation.ts` : chaque écran garde sa propre
 * petite fonction plutôt que d'en importer une d'un autre domaine (§6).
 */
export function instantLisible(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const deux = (n: number): string => String(n).padStart(2, "0");
  return `${deux(local.jour)}/${deux(local.mois)}/${local.annee} ${deux(local.heures)}:${deux(local.minutes)}`;
}

/** La clé du dictionnaire pour un état d'accusé de réception (`lib/demandes/accuse.ts`). */
export function cleEtatAccuse(etat: EtatAccuse): CleTraduction {
  if (etat.etat === "repondu") {
    return etat.dansLeStandard
      ? "demande.accuse.repondu_dans_le_standard"
      : "demande.accuse.repondu_hors_standard";
  }
  return etat.depasse
    ? "demande.accuse.sans_reponse_depasse"
    : "demande.accuse.sans_reponse";
}
