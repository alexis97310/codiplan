import { estCleTraduction, t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * LA BANNIÈRE « CALENDRIERS D'AGENCE RESPECTÉS » (D125, D128, LOT A2) — sortie
 * de `page.tsx` (AGENCE-ACTIVE, AA-5) : Next.js n'admet, d'un fichier `page`,
 * que les exports qu'il connaît (`default`, `metadata`, …) — un export
 * nommé de plus fait échouer `pnpm typecheck` sur les types générés
 * (`.next/types/app/.../page.ts`). `texteCalendriers` devait pourtant être
 * exportée pour être éprouvée sans navigateur ; ce module, jusque-là absent
 * de `planning/`, est le sitôt-nécessaire.
 */

/** Le titre de la bannière — le mot « agence » vient de `motDansUnePhrase` (§3). */
export function titreCalendriers(): string {
  return `${t("planning.calendriers_titre_prefixe")}${motDansUnePhrase("agence")} ${t("planning.calendriers_titre_suffixe")}`;
}

/**
 * LE TEXTE ENTIER DE LA BANNIÈRE, composé hors du JSX : un littéral n'y est
 * pas admis (L0-11), et le point qui sépare la liste des agences de la garde
 * fixe en est un.
 */
export function texteCalendriers(
  agences: readonly {
    readonly libelle: string;
    readonly joursOuverts: readonly number[];
    readonly calendrierConnu: boolean;
    /**
     * FILTRE ICI, JAMAIS EN AMONT (AGENCE-ACTIVE, AA-5) : une agence inactive
     * n'est plus consultée dans son ouverture — elle continue de porter les
     * interventions qui lui restent posées, mais la bannière ne la NOMME
     * plus. `pourGrille` (l'appelant, `page.tsx`) reste l'index de
     * consultation complet ; c'est cette seule fonction de présentation qui
     * décide qui figure ici.
     */
    readonly actif: boolean;
  }[],
): string {
  return `${agences
    .filter((agence) => agence.actif)
    .map(resumeCalendrierAgence)
    .join(" · ")}. ${t("planning.calendriers_aide")}`;
}

/**
 * LA CLAUSE D'UNE AGENCE DANS LA BANNIÈRE « Calendriers d'agence respectés »
 * (LOT A2). Elle ne recopie AUCUN jour écrit en dur (I7) : la liste vient de
 * `joursOuverts`, déjà dérivée de `joursTravailles` par l'appelant.
 *
 * DEUX ÉTATS DISTINCTS, DEUX MESSAGES — `retirerPlage` (lib/calendar/depot.ts)
 * accepte de retirer la dernière plage d'un calendrier : « ce jour n'a plus de
 * plage » y est un état valide, « fermé », pas une erreur. `calendrierConnu`
 * peut donc être vrai avec `joursOuverts` vide — un calendrier RATTACHÉ mais
 * fermé tous les jours — et ce n'est pas la même chose qu'aucun calendrier
 * rattaché : dire « aucun calendrier » dans ce cas donnerait un faux
 * diagnostic à qui règle le planning (revue d'exploitation, 19/09/2026).
 */
function resumeCalendrierAgence(agence: {
  readonly libelle: string;
  readonly joursOuverts: readonly number[];
  readonly calendrierConnu: boolean;
}): string {
  if (!agence.calendrierConnu) {
    return `${agence.libelle} : ${t("parametres.sans_calendrier")}`;
  }
  if (agence.joursOuverts.length === 0) {
    return `${agence.libelle} : ${t("planning.calendrier_ferme_tous_les_jours")}`;
  }
  const jours = [...agence.joursOuverts].sort((a, b) => a - b);
  const contigu = jours.every((j, i) => i === 0 || j === jours[i - 1] + 1);
  const texte =
    contigu && jours.length > 1
      ? `${nomJourIso(jours[0])} ${t("planning.au")} ${nomJourIso(jours[jours.length - 1])}`
      : jours.map(nomJourIso).join(", ");
  return `${agence.libelle} : ${texte}`;
}

/** Le nom d'un jour ISO (1 = lundi … 7 = dimanche), ou rien s'il est hors plage. */
function nomJourIso(jour: number): string {
  const cle = `jour.${jour}`;
  return estCleTraduction(cle) ? t(cle) : String(jour);
}
