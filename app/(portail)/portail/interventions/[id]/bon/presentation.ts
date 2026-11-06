import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import type { IssueSignature } from "@/lib/interventions/saisie";

/**
 * CE QUE LE BON DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11,
 * 9J08A-REPRISE-9J08) — même rangement que `../../presentation.ts` : chaque
 * écran porte la sienne (§6).
 */

/**
 * « 05/11/2026 » — le jour civil d'un instant, dans le fuseau de l'AGENCE
 * (jamais celui de l'appareil). Même formule que `dateLocale`
 * (`app/(back-office)/interventions/presentation.ts`), non partagée : une
 * fonction de dix lignes, sans règle de gestion, qu'une seconde écriture ne
 * fait pas diverger (§9, 01/09 vise une RÈGLE recopiée, pas un format de
 * date).
 *
 * Le bon du portail n'affiche cette date que pour une intervention CLÔTURÉE
 * (`bonInterventionDuParc`) : l'appelant ne lui passe donc jamais un instant
 * absent.
 */
export function dateLocaleDuBonPortail(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}

/**
 * « Signé par NOM (QUALITÉ) le DATE » — même phrase que le bon back-office
 * (`ligneSignature`, `app/(back-office)/interventions/[id]/bon/page.tsx`),
 * reprise ici plutôt qu'importée : elle vit dans une page, pas dans un
 * module partagé, et ce ticket ne touche jamais au bon back-office (§9,
 * 01/09 vise une RÈGLE recopiée, pas une phrase d'affichage).
 */
export function ligneSignatureDuBonPortail(
  nom: string | null,
  qualite: string | null,
  date: string,
): string {
  if (nom === null) {
    return `${t("intervention.bon.signature_le")} ${date}`;
  }
  const suffixeQualite = qualite === null ? "" : ` (${qualite})`;
  return `${t("intervention.bon.signe_par")} ${nom}${suffixeQualite} ${t("intervention.bon.le")} ${date}`;
}

/** « Aucune machine n'est rattachée à cette intervention : elle porte sur l'ensemble du site. » */
export function aucuneMachineDuBonPortail(): string {
  return `${t("intervention.bon.aucune_machine")} ${motDansUnePhrase("site")}.`;
}

/** « Client absent — Motif : … » ou « Refus de signer — Motif : … » (9DE-TP-CY1, D-S5). */
export function ligneSignatureAbsenteOuRefuseeDuBonPortail(
  issue: Exclude<IssueSignature, "signee">,
  motif: string | null,
): string {
  const entete =
    issue === "client_absent"
      ? t("intervention.realisation.signature_absente")
      : t("intervention.realisation.signature_refusee");
  return `${entete}${t("ponctuation.separateur")}${t("intervention.realisation.motif_libelle")} ${motif}`;
}
