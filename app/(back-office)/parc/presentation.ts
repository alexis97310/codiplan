import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

import { decompte } from "../presentation";

/**
 * ── LE RETOUR AU PARC REJOINT LA LISTE TELLE QU'ON L'AVAIT LAISSÉE
 * (79-LIENS-3) ────────────────────────────────────────────────────────────
 *
 * *Mesuré sur main le 25/09/2026 : « Fiche complète » (`page.tsx`) menait à
 * `/parc/<id>` nu, et le lien « Retour » de la fiche (`[id]/page.tsx`) vers
 * `/parc` nu — les filtres, la recherche et la page en cours étaient PERDUS
 * à chaque fiche ouverte.* Même défaut, même remède que 78-LIENS-2 sur le
 * registre des interventions (`app/(back-office)/interventions/
 * presentation.ts`, `retourActuelDuRegistre`/`retourVersRegistre`) — repris
 * ICI plutôt qu'importé : au 25/09/2026, ce lot n'est publié sur aucune
 * branche fusionnée dans `main` (`78-LIENS-2-garde`), et une fonction share
 * ne peut pas se lire depuis une branche qui n'existe pas encore pour
 * celle-ci. Le PARC et le REGISTRE ne lisent d'ailleurs pas la même liste de
 * paramètres — un module séparé, pas une duplication du même critère.
 *
 * « Tel qu'on l'avait laissé » se limite, comme le titre du ticket le
 * borne, aux FILTRES, à la RECHERCHE et à la PAGE — jamais à `machine`, la
 * sélection éphémère du maître-détail : ce n'est pas un filtre de recherche,
 * c'est un état d'écran qui n'a pas sa place dans un lien qui en sort.
 *
 * Rejetée EN BLOC — retour à `/parc` nu — dès que la valeur brute porte
 * `://`, `//` ou `:` (D50, redirection ouverte) : aucune des clés connues ne
 * porte ce caractère dans une valeur légitime (un UUID sans deux-points, un
 * entier, un texte de recherche libre), donc sa présence ne peut être qu'un
 * schéma d'URL détourné.
 */

/**
 * LA LISTE FERMÉE DES PARAMÈTRES QUE LE RETOUR PORTE — EXACTEMENT ceux que
 * `hrefDeLaLigne` et `hrefPage` de `page.tsx` composent déjà pour une AUTRE
 * page du même écran, jamais une seconde liste tenue à la main qui pourrait
 * diverger en silence de celle que `retourVersParc` relit plus bas (§9,
 * 01/09).
 */
export const PARAMETRES_RETOUR_PARC = [
  "q",
  "statut",
  "client",
  "site",
  "famille",
  // LA VUE (9EB-TP-UX3-2-LISTES-2) — rejoint la liste fermée : revenir d'une
  // fiche ouverte depuis « Garantie proche » doit rouvrir CETTE vue, jamais
  // retomber sur le défaut « Dans le parc ».
  "vue",
  "page",
] as const;

/** Une valeur de retour plus longue que ceci n'est pas un filtre plausible. */
const LONGUEUR_MAXIMALE_VALEUR_RETOUR = 200;

/**
 * LA REQUÊTE ACTIVE DU PARC, ENCODÉE — composée sur le lien « Fiche
 * complète » (`page.tsx`), pour que `retourVersParc` ci-dessous la rejoue
 * depuis la fiche. Prend les valeurs BRUTES de la requête en cours, jamais
 * les critères déjà analysés par `schemaRechercheParc` — la même prudence
 * que `retourActuelDuRegistre` applique déjà pour `du`/`au`.
 */
export function retourActuelDuParc(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const requete = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_PARC) {
    const valeur = params[cle];
    const premiere = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof premiere === "string" && premiere.length > 0) {
      requete.set(cle, premiere);
    }
  }
  return requete.toString();
}

/**
 * LE RETOUR — `/parc` nu quand `retour` est absent, vide, ou porte un schéma
 * d'URL détourné ; sinon la requête re-filtrée sur la même liste fermée.
 */
export function retourVersParc(
  retour: string | readonly string[] | undefined,
): string {
  const brut = Array.isArray(retour) ? retour[0] : retour;
  if (typeof brut !== "string" || brut.length === 0) {
    return "/parc";
  }
  if (brut.includes("://") || brut.includes("//") || brut.includes(":")) {
    return "/parc";
  }
  const recus = new URLSearchParams(brut);
  const conserves = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_PARC) {
    const valeur = recus.get(cle);
    if (valeur !== null && valeur.length <= LONGUEUR_MAXIMALE_VALEUR_RETOUR) {
      conserves.set(cle, valeur);
    }
  }
  const requete = conserves.toString();
  return requete.length === 0 ? "/parc" : `/parc?${requete}`;
}

/**
 * ── L'APERÇU DU MAÎTRE-DÉTAIL, AU GABARIT DU 28/09 (9EB-TP-UX3-2-LISTES-2)
 * ──────────────────────────────────────────────────────────────────────────
 */

const MILLISECONDES_PAR_JOUR_PRESENTATION = 24 * 60 * 60 * 1000;

/**
 * LA FIN DE GARANTIE AFFICHÉE — « jj/mm/aaaa (dans N jour(s)) », ou
 * « terminée » seule une fois la borne passée (maquette, `machinePreview()` :
 * `m.garantie >= TODAY ? dRel(m.garantie) : "terminée"`). `null` quand
 * `garantie_fin` est nul — l'appelant y substitue alors le signe d'absence
 * (D126 : « une absence reste absente »), jamais cette fonction.
 *
 * **`aujourdHui` et `garantieFin` sont tous deux des `@db.Date` posées à
 * minuit UTC** (même convention que `resumerLeParc`) : la soustraction brute
 * des millisecondes rend donc un compte de jours civils exact, sans qu'aucun
 * fuseau n'ait à être relu ici — l'appelant a déjà résolu le jour civil de la
 * société avant d'appeler cette fonction.
 */
export function finDeGarantieAffichee(
  garantieFin: Date,
  aujourdHui: Date,
): string {
  const jours = Math.round(
    (garantieFin.getTime() - aujourdHui.getTime()) /
      MILLISECONDES_PAR_JOUR_PRESENTATION,
  );
  if (jours < 0) {
    return t("parc.garantie_terminee");
  }
  return `${dateCivile(garantieFin)} (${t("parc.garantie_dans_prefixe")} ${decompte(
    jours,
    t("parc.garantie_jour_un"),
    t("parc.garantie_jours"),
  )})`;
}

/** Le détail de la tuile « Machines suivies » — hors N sorties du parc. */
export function detailTuileMachinesSuivies(sorties: number): string {
  return sorties === 0
    ? t("parc.tuile_machines_suivies_detail_zero")
    : `${t("parc.tuile_machines_suivies_detail_hors")} ${decompte(
        sorties,
        t("parc.sortie_du_parc_un"),
        t("parc.sorties_du_parc"),
      )}`;
}

/** Le détail de la tuile « En panne » — dont N avec une intervention ouverte. */
export function detailTuileEnPanne(avecInterventionOuverte: number): string {
  return avecInterventionOuverte === 0
    ? t("parc.tuile_en_panne_detail_zero")
    : `${t("parc.tuile_en_panne_detail_dont")} ${avecInterventionOuverte} ${t(
        "parc.tuile_en_panne_detail_suffixe",
      )}`;
}

/** Le détail de la tuile « Garanties qui finissent » — fin de garantie sous N jours. */
export function detailTuileGarantie(
  compte: number,
  joursGarantie: number,
): string {
  const prefixe =
    compte === 0
      ? t("parc.tuile_garanties_detail_zero_prefixe")
      : t("parc.tuile_garanties_detail_prefixe");
  return `${prefixe} ${joursGarantie} ${t("parc.tuile_garanties_detail_jours")}`;
}

/**
 * LE LIEN D'EXPORT (MO-9, D169) — mêmes paramètres d'adresse que `/parc`
 * lui-même, `page` et `machine` exclus : l'export n'en pagine aucun et ne
 * connaît pas la sélection éphémère du maître-détail (même raisonnement que
 * `PARAMETRES_RETOUR_PARC`, qui l'exclut déjà).
 */
export function hrefExportParc(
  parametres: Readonly<Record<string, string | undefined | null>>,
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (
      valeur !== undefined &&
      valeur !== null &&
      valeur.length > 0 &&
      valeur !== "tous"
    ) {
      recherche.set(cle, valeur);
    }
  }
  const chaine = recherche.toString();
  return `/api/parc/exporter${chaine.length > 0 ? `?${chaine}` : ""}`;
}
