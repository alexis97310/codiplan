import type { TonBadge } from "@/components/ui/badge";
import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import type { EtatAccuse } from "@/lib/demandes/accuse";
import { type LigneDemande } from "@/lib/demandes/depot";
import type { StatutDemande } from "@/lib/demandes/saisie";
import { t, type CleTraduction } from "@/lib/i18n/fr";

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
 * LE TITRE DE LA FICHE — « Demande — <raison sociale> », ou « Demande » seul
 * quand le client n'a pas pu être lu (GR17-M5, audit GR du 26/09, constat
 * M5).
 *
 * *Mesuré sur main : la fiche portait le PLURIEL de la liste (`demande.titre`,
 * « Demandes ») — juste au singulier ne suffirait pas non plus, une fiche
 * parmi des centaines gagne à nommer SON client.* `demande.titre` reste
 * inchangé : il sert encore la liste et le `<title>` de l'onglet (§9, 01/09 —
 * deux écrans, une seule clé de LISTE, jamais recomposée ici).
 */
export function titreFiche(
  client: { readonly raison_sociale: string } | null,
): string {
  if (client === null) {
    return t("demande.fiche.titre");
  }
  return `${t("demande.fiche.titre")}${t("ponctuation.separateur")}${client.raison_sociale}`;
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
