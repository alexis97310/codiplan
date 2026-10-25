import { decompte } from "@/app/(back-office)/presentation";
import { type JourLocal } from "@/lib/calendar/fuseau";
import { enHeure } from "@/lib/calendar/parametrage";
import { jourSemaineIso, semaineIso } from "@/lib/calendar/semaine";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import type { MotifNonTransmissible } from "@/lib/interventions/cycle-de-vie";

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
 * L'INDICE DE DÉFILEMENT DE LA GRILLE SEMAINE (9EH-TP-UX-PL-PLANNING-1, D190,
 * gabarit `.pgrid-hint` de la maquette du 28/09) — « Défilez vers la droite :
 * la semaine continue jusqu'à samedi », jamais écrit en dur dans
 * `CadreDefilant` (générique, réutilisé par `Tableau`) ni dans `page.tsx`
 * (L0-11) : le nom du jour vient des clés `jour.N` déjà existantes.
 *
 * **`deuxSemaines` (9G4-PLANNING-JOUR-ET-MOIS, point 7)** — FACULTATIF, faux
 * par défaut : « la semaine continue » est FAUX sur la vue « 2 semaines »,
 * qui en affiche deux ; une clé propre à cette vue porte le pluriel, jamais
 * une correction de grammaire posée dans le JSX (L0-11).
 */
export function texteIndiceDefilement(
  dernierJourAffiche: JourLocal,
  deuxSemaines = false,
): string {
  const nom = nomJourIso(jourSemaineIso(dernierJourAffiche));
  const cle = deuxSemaines
    ? "planning.indice_defilement_deux_semaines"
    : "planning.indice_defilement";
  return `${t(cle)} ${nom}`;
}

/**
 * L'INDICE DE DÉFILEMENT DE LA FRISE JOUR (9G4-PLANNING-JOUR-ET-MOIS, point
 * 1) — même patron que `texteIndiceDefilement`, mais la frise défile sur les
 * HEURES de l'axe, jamais sur des jours : « jusqu'à » porte l'heure de FIN de
 * l'axe (dernier début + le pas), pas un nom de jour. `undefined` sans axe —
 * `CadreDefilant` ne montre alors aucun indice, exactement comme sans ce prop.
 */
export function texteIndiceDefilementJour(
  axe: readonly number[],
  pasMinutes: number,
): string | undefined {
  if (axe.length === 0) {
    return undefined;
  }
  const fin = axe[axe.length - 1] + pasMinutes;
  return `${t("planning.indice_defilement_jour")} ${enHeure(fin)}`;
}

/**
 * L'INDICE DE DÉFILEMENT DE LA GRILLE MOIS (9G4-PLANNING-JOUR-ET-MOIS, point
 * 5) — même patron, mais la borne est le dernier JOUR DU MOIS (un nombre),
 * jamais un nom de jour de semaine : « jusqu'au 31 », jamais « jusqu'à 31 »
 * (grammaire du français, même disposition que `jourMoisComplet` ci-dessus).
 */
export function texteIndiceDefilementMois(
  dernierJourDuMois: JourLocal,
): string {
  return `${t("planning.indice_defilement_mois")} ${dernierJourDuMois.jour}`;
}

/**
 * LE RÉSUMÉ « N TECHNICIENS · N ABSENCES » (9EH-TP-UX-PL-PLANNING-1, D190,
 * gabarit de la maquette du 28/09) — commun aux trois vues qui le portent
 * (Semaine, « 2 semaines », Jour). Les deux mots sont ceux déjà employés par
 * `resumeDesTechniciens` (`../planning/carte.ts`) — « technicien(s) »,
 * « absence(s) » —, jamais un second mot pour la même idée (§9, 01/09).
 */
function resumeTechniciensEtAbsences(
  techniciens: number,
  absences: number,
): string {
  const techniciensTexte = decompte(
    techniciens,
    t("planning.resume_technicien_un"),
    t("planning.resume_techniciens"),
  );
  const absencesTexte = decompte(
    absences,
    t("planning.resume_agenda_bloque_un"),
    t("planning.resume_agendas_bloques"),
  );
  return `${techniciensTexte} · ${absencesTexte}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE SEMAINE (TR-54, audit du 28/09/2026 ;
 * reformaté au gabarit de la maquette du 28/09 par 9EH-TP-UX-PL-PLANNING-1,
 * D190) — « Semaine 40 · 28/09 → 03/10 · 5 techniciens · 3 absences ».
 *
 * **L'année ne s'écrit JAMAIS sur la première borne, et sur la seconde
 * seulement si la période n'est pas dans l'année en cours** (celle
 * d'`aujourdhui`, dans le fuseau de la société) — ce n'est plus, depuis ce
 * lot, une comparaison entre les deux bornes : une semaine qui change
 * d'année (28/12 → 02/01) porte alors l'année sur sa seconde borne par ce
 * seul test, sans qu'il faille les comparer entre elles.
 */
export function libelleSemaine(
  jours: readonly JourLocal[],
  anneeEnCours: number,
  techniciens: number,
  absences: number,
): string {
  const { semaine } = semaineIso(jours[0]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  const borneDerniere =
    dernier.annee === anneeEnCours
      ? jourMoisComplet(dernier)
      : `${jourMoisComplet(dernier)}/${dernier.annee}`;
  return `${t("planning.semaine")} ${semaine} · ${jourMoisComplet(premier)} → ${borneDerniere} · ${resumeTechniciensEtAbsences(techniciens, absences)}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE « 2 SEMAINES » (9CI-PG-G12-DEUX-SEMAINES-MOIS,
 * D145 ; reformaté par 9EH-TP-UX-PL-PLANNING-1, D190) — « Semaines 40 et 41 ·
 * 05/10 → 17/10 · 5 techniciens · 3 absences », même forme que
 * `libelleSemaine`, avec les DEUX numéros de semaine ISO. `jours[6]` est le
 * second lundi (`joursDeLaVue("deux_semaines", ...)`, douze jours, six par
 * semaine) : chacun des deux numéros est lu sur SON propre lundi, jamais
 * déduit du premier par une simple addition — un passage d'année ISO (D125,
 * `semaineIso`) ne s'incrémente pas toujours de un.
 */
export function libelleDeuxSemaines(
  jours: readonly JourLocal[],
  anneeEnCours: number,
  techniciens: number,
  absences: number,
): string {
  const { semaine: premiereSemaine } = semaineIso(jours[0]);
  const { semaine: secondeSemaine } = semaineIso(jours[6]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  const borneDerniere =
    dernier.annee === anneeEnCours
      ? jourMoisComplet(dernier)
      : `${jourMoisComplet(dernier)}/${dernier.annee}`;
  return `${t("planning.semaines")} ${premiereSemaine} ${t("planning.et")} ${secondeSemaine} · ${jourMoisComplet(premier)} → ${borneDerniere} · ${resumeTechniciensEtAbsences(techniciens, absences)}`;
}

/**
 * LE SOUS-TITRE DU PLANNING, VUE JOUR (9EH-TP-UX-PL-PLANNING-1, D190,
 * maquette du 28/09, constat 2) — « Lundi 28/09/2027 · 5 techniciens ·
 * aucune absence ce jour » (ou « · N absences » dès la première). ZÉRO est
 * un TEXTE FIXE, jamais `decompte(0, …)` — la maquette l'écrit en toutes
 * lettres (« aucune absence ce jour »), pas « 0 absences ». `libelleJourTexte`
 * est composé par l'appelant (`libelleJour`, `page.tsx`) : cette fonction ne
 * refait pas le calcul de la date, elle n'ajoute que le résumé.
 */
export function sousTitreJour(
  libelleJourTexte: string,
  techniciens: number,
  absences: number,
): string {
  const techniciensTexte = decompte(
    techniciens,
    t("planning.resume_technicien_un"),
    t("planning.resume_techniciens"),
  );
  const absencesTexte =
    absences === 0
      ? t("planning.jour_aucune_absence")
      : decompte(
          absences,
          t("planning.resume_agenda_bloque_un"),
          t("planning.resume_agendas_bloques"),
        );
  return `${libelleJourTexte} · ${techniciensTexte} · ${absencesTexte}`;
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
 * LES PUCES-LIENS DU BANDEAU (9EH-TP-UX-PL-PLANNING-1, D190, gabarit de la
 * maquette du 28/09) — « N en retard », « N sans durée » (toutes vues), et
 * « N absence(s) cette semaine » (Semaine et Jour seulement, voir
 * `page.tsx`). Les deux premières n'ont qu'une forme, singulier compris
 * (« 1 en retard », jamais « 1 en retards ») — `decompte` ne leur sert à
 * rien, contrairement à la troisième.
 */
export function puceEnRetard(nombre: number): string {
  return `${nombre} ${t("planning.bandeau_en_retard")}`;
}

export function puceSansDuree(nombre: number): string {
  return `${nombre} ${t("planning.bandeau_sans_duree")}`;
}

export function puceAbsencesSemaine(nombre: number): string {
  const absences = decompte(
    nombre,
    t("planning.resume_agenda_bloque_un"),
    t("planning.resume_agendas_bloques"),
  );
  return `${absences} ${t("planning.bandeau_cette_semaine")}`;
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

// ── TRANSMETTRE EN GROUPE (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) ──────
//
// Le compte (n) se compose ICI, jamais dans `lib/i18n/fr.ts` (L0-11 : ce
// fichier ne porte que les phrases invariantes) ni en JSX (un nombre collé à
// une parenthèse littérale y serait une chaîne en dur).

/** Le libellé du bouton « Transmettre demain (n) ». */
export function libelleTransmettreDemain(nombre: number): string {
  return `${t("planning.transmettre_demain")} (${nombre})`;
}

/** Le libellé du bouton « Transmettre toutes les planifiées prêtes (n) ». */
export function libelleTransmettreToutesLesPlanifieesPretes(
  nombre: number,
): string {
  return `${t("planning.transmettre_toutes_les_planifiees_pretes")} (${nombre})`;
}

/**
 * LE TEXTE DE CONFIRMATION DE « TRANSMETTRE TOUTES LES PLANIFIÉES PRÊTES » —
 * nomme le nombre de prêtes ET celui de laissées (02/10/2026, point 1).
 */
export function texteConfirmationTransmettreToutes(
  nombrePretes: number,
  nombreLaissees: number,
): string {
  const milieu =
    nombrePretes === 1
      ? t("planning.transmission.confirmer_toutes_milieu_singulier")
      : t("planning.transmission.confirmer_toutes_milieu");
  const base = `${t("planning.transmission.confirmer_toutes_prefixe")} ${nombrePretes} ${milieu}`;
  if (nombreLaissees === 0) {
    return base;
  }
  const suffixe =
    nombreLaissees === 1
      ? t("planning.transmission.confirmer_toutes_laissees_suffixe_singulier")
      : t("planning.transmission.confirmer_toutes_laissees_suffixe");
  return `${base} ${nombreLaissees} ${suffixe}`;
}

/** Le libellé d'un motif fermé de ligne laissée (`MotifNonTransmissible`). */
export function libelleMotifNonTransmissible(
  motif: MotifNonTransmissible,
): string {
  return t(`planning.transmission.motif.${motif}`);
}

/** Le titre du dialogue « Transmettre demain » — composé ici, jamais en JSX (L0-11). */
export function titreDialogueTransmettreDemain(jourLibelle: string): string {
  return `${t("planning.transmettre_demain.titre")}${t("ponctuation.separateur")}${jourLibelle}`;
}

/** Une ligne laissée, en un seul texte : « Client — Site (motifs) ». */
export function texteLigneLaissee(ligne: {
  readonly client: string;
  readonly site: string;
  readonly motifsLibelles: readonly string[];
}): string {
  return `${ligne.client}${t("ponctuation.separateur")}${ligne.site} (${ligne.motifsLibelles.join(", ")})`;
}

/** Une case à cocher de « Transmettre demain » : « Référence · heure · Client — Site ». */
export function texteCaseIntervention(intervention: {
  readonly reference: string;
  readonly heure: string | null;
  readonly client: string;
  readonly site: string;
}): string {
  const heure = intervention.heure ?? "—";
  return `${intervention.reference}${t("ponctuation.point_median")}${heure}${t("ponctuation.point_median")}${intervention.client}${t("ponctuation.separateur")}${intervention.site}`;
}

/** Une ligne refusée par `transmettreEnGroupe`, en un seul texte. */
export function texteRefusTransmission(cle: CleTraduction): string {
  return `${t("ponctuation.separateur")}${t(cle)}`;
}

/**
 * LE DRAPEAU FERMÉ `?courriel=non_configure`, LU ICI — jamais dans `page.tsx`
 * (9DB-RETOUCHES-10). Cette valeur n'est montrée à personne : elle ne fait
 * que SÉLECTIONNER une phrase déjà dans le dictionnaire. L'écrire dans
 * `page.tsx` ferait rougir le gardien L0-11 (`sans-chaine-visible-en-dur`),
 * qui remonte le flux de données jusqu'à toute chaîne qui alimente un enfant
 * JSX — y compris une valeur qui ne sert qu'à comparer, jamais à afficher.
 */
export function courrielTransmissionNonConfigure(
  valeur: string | readonly string[] | undefined,
): boolean {
  return valeur === "non_configure";
}

/**
 * LE COMPTE-RENDU D'UNE TRANSMISSION GROUPÉE, APRÈS COUP — composé depuis des
 * NOMBRES portés par l'URL (`?transmis=`, `?techniciens=`,
 * `?echecsCourriel=`) et un drapeau fermé (`?courriel=non_configure`), jamais
 * depuis du texte : un nombre ou un drapeau forgé rend au plus un compte
 * faux, jamais un texte injecté (même discipline que
 * `clesAvertissementCourriel`, en plus strict encore puisqu'ici ce ne sont
 * même pas des clés).
 *
 * **`techniciens` ne compte QUE les envois PARTIS** (9DB-RETOUCHES-10,
 * constat de production du 03/10/2026) — compter les récapitulatifs TENTÉS
 * rendait, sur un seul technicien en échec, « 1 technicien prévenu » ET « 1
 * technicien n'a pas reçu son courriel » à la fois, pour la même personne.
 *
 * **Le canal non configuré remplace la phrase d'échec, jamais ne s'y
 * ajoute** : quand `courrielNonConfigure` est vrai, tous les envois ont
 * échoué pour la MÊME cause — dire « N techniciens n'ont pas reçu leur
 * courriel » laisserait croire à un accident d'envoi, alors que rien n'a pu
 * partir (`configurationCourriel`, `lib/courriel/configuration.ts`).
 */
export function texteCompteRenduTransmission(parametres: {
  readonly transmis: number;
  readonly techniciens: number;
  readonly echecsCourriel: number;
  readonly courrielNonConfigure: boolean;
}): string {
  const { transmis, techniciens, echecsCourriel, courrielNonConfigure } =
    parametres;
  const phrases = [
    `${transmis} ${
      transmis === 1
        ? t("planning.transmission.transmises_singulier")
        : t("planning.transmission.transmises_pluriel")
    }`,
  ];
  if (techniciens > 0) {
    phrases.push(
      `${techniciens} ${
        techniciens === 1
          ? t("planning.transmission.technicien_prevenu_singulier")
          : t("planning.transmission.techniciens_prevenus_pluriel")
      }`,
    );
  }
  if (courrielNonConfigure) {
    phrases.push(t("planning.transmission.courriel_non_configure"));
  } else if (echecsCourriel > 0) {
    phrases.push(
      `${echecsCourriel} ${
        echecsCourriel === 1
          ? t("planning.transmission.echec_courriel_singulier")
          : t("planning.transmission.echec_courriel_pluriel")
      }`,
    );
  }
  return phrases.join(" ");
}
