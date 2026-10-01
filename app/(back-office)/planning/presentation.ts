import { type JourLocal } from "@/lib/calendar/fuseau";
import { semaineIso } from "@/lib/calendar/semaine";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

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

/** Jour et mois complets à deux chiffres — « 03/10 », jamais « 3/10 ». */
function jourMoisComplet(jour: JourLocal): string {
  return `${String(jour.jour).padStart(2, "0")}/${String(jour.mois).padStart(2, "0")}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE SEMAINE (TR-54, audit du 28/09/2026) —
 * mesuré fautif sur `main` : « Semaine 40 — du 28 au 3/10/2026 », le premier
 * jour sans son mois, le dernier non complété à deux chiffres.
 *
 * **L'année ne s'écrit qu'une fois, sauf quand la semaine en change** —
 * l'écrire aux deux bornes en toute circonstance alourdirait la lecture
 * courante sans rien ajouter à ce qu'elle dit déjà.
 */
export function libelleSemaine(jours: readonly JourLocal[]): string {
  const { semaine } = semaineIso(jours[0]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  const bornePremiere =
    premier.annee === dernier.annee
      ? jourMoisComplet(premier)
      : `${jourMoisComplet(premier)}/${premier.annee}`;
  const borneDerniere = `${jourMoisComplet(dernier)}/${dernier.annee}`;
  return `${t("planning.semaine")} ${semaine} — ${t("planning.du")} ${bornePremiere} ${t("planning.au")} ${borneDerniere}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE « 2 SEMAINES » (9CI-PG-G12-DEUX-SEMAINES-MOIS,
 * D145) — « Semaines 40 et 41 — du 05/10 au 17/10 », même forme que
 * `libelleSemaine`, avec les DEUX numéros de semaine ISO. `jours[6]` est le
 * second lundi (`joursDeLaVue("deux_semaines", ...)`, douze jours, six par
 * semaine) : chacun des deux numéros est lu sur SON propre lundi, jamais
 * déduit du premier par une simple addition — un passage d'année ISO (D125,
 * `semaineIso`) ne s'incrémente pas toujours de un.
 */
export function libelleDeuxSemaines(jours: readonly JourLocal[]): string {
  const { semaine: premiereSemaine } = semaineIso(jours[0]);
  const { semaine: secondeSemaine } = semaineIso(jours[6]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  const bornePremiere =
    premier.annee === dernier.annee
      ? jourMoisComplet(premier)
      : `${jourMoisComplet(premier)}/${premier.annee}`;
  const borneDerniere = `${jourMoisComplet(dernier)}/${dernier.annee}`;
  return `${t("planning.semaines")} ${premiereSemaine} ${t("planning.et")} ${secondeSemaine} — ${t("planning.du")} ${bornePremiere} ${t("planning.au")} ${borneDerniere}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE « MOIS » (9CI-PG-G12-DEUX-SEMAINES-MOIS,
 * PG-D3-MOIS-CHARGE, D145) — « Octobre 2026 », avec les clés `mois.N`
 * existantes (`lib/i18n/fr.ts`, déjà employées par le titre du calendrier
 * d'absences, D125) : jamais une troisième liste de noms de mois écrite ici.
 * `jour` n'a pas besoin d'être le 1er du mois : seuls `annee` et `mois`
 * comptent, comme `joursDeLaVue("mois", ...)`.
 */
export function libelleMois(jour: JourLocal): string {
  const cle = `mois.${jour.mois}`;
  const nom = estCleTraduction(cle) ? t(cle) : String(jour.mois);
  return `${nom} ${jour.annee}`;
}

/**
 * OÙ — et la ligne en porte désormais PLUSIEURS, puisque la maille est la
 * personne. Aucune n'est choisie : elles sont toutes nommées, séparées par une
 * virgule. *Choisir la principale ferait basculer le libellé d'une semaine à
 * l'autre, exactement ce que `occupation.ts` refuse pour le dénominateur.*
 *
 * ## LES SPÉCIALITÉS N'Y SONT PAS, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * La maquette écrit **« agence · spécialités »** sous le nom du technicien.
 * **Aucune table ne porte de spécialité** : `grep -n "competence\|specialite"`
 * sur `prisma/schema.prisma` et sur `lib/` rend **zéro ligne** (mesuré le
 * 12/09/2026). Le cahier des charges les distingue d'ailleurs des
 * **habilitations**, qui existent, elles — `technicien_habilitation` (L1-04) —
 * et qui ne sont pas la même notion : *une habilitation est un droit daté qui
 * expire, une spécialité est un savoir-faire.* Afficher les unes à la place des
 * autres montrerait un droit périmé comme une compétence.
 *
 * *Une sous-ligne qui porterait un séparateur suivi de rien dirait que la
 * donnée manque* là où il n'y a rien à afficher — le motif de blocage de R2-13,
 * appliqué avant de commettre la faute.
 */
export function ouTravaille(libelles: readonly string[]): string {
  if (libelles.length === 0) return "";
  return `${mot("agence")} ${libelles.join(", ")}`;
}
