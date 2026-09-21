import { absenceCouvrant, type AbsenceDeclaree } from "@/lib/absences/periode";
import type { Annuaire } from "@/lib/auth/annuaire";
import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

/**
 * LES PERSONNES QUE LE PLANNING NOMME — l'UNION, jamais une seule moitié.
 *
 * ## Le défaut que ce module empêche de revenir (14/09/2026)
 *
 * Depuis le 12/09, la vue jour tire ses colonnes du **référentiel** des
 * techniciens actifs — *un technicien dont la journée est entièrement libre
 * n'avait aucune colonne, sur un écran dont l'objet déclaré est de MONTRER LES
 * TROUS.* La résolution des noms, elle, était restée branchée sur les seules
 * **interventions**.
 *
 * Les deux moitiés étaient justes séparément, et leur rencontre était fausse :
 * *l'écran a gagné la colonne du technicien libre et lui a retiré son nom au
 * même moment.* Personne ne pouvait le voir dans une assertion — chaque moitié
 * répondait correctement à sa propre question (§9, 09/09 : *une propriété de la
 * RENCONTRE de deux calculs, qu'aucun des deux ne connaît*). C'est une image
 * qui l'a montré : deux colonnes portant le même libellé de repli.
 *
 * **La population à nommer est donc celle des COLONNES, pas celle des lignes**,
 * et elle s'écrit ici une fois pour les deux vues.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne lit ni base, ni horloge, ni politique. Il dit **QUI**, comme
 * `affichage.ts` dit **QUELLES lignes** ; la lecture et son droit appartiennent
 * à `lib/auth/annuaire.ts`.
 */

/** Le minimum qu'une ligne de planning porte pour désigner quelqu'un. */
export type Affectee = {
  readonly technicien_id: string | null;
};

/** Le minimum qu'une personne du référentiel porte pour avoir une colonne. */
export type Rattachee = {
  readonly id: string;
};

/**
 * L'UNION des identités que l'écran devra nommer.
 *
 * Les deux sources sont nécessaires et aucune ne couvre l'autre :
 *
 * - le **référentiel** donne la colonne de qui n'a rien ce jour-là — c'est
 *   exactement la personne que la vue jour existe pour montrer ;
 * - les **interventions** donnent la personne posée sans être au référentiel,
 *   qu'un `actif = false` en a sortie sans effacer son passé. *Perdre une ligne
 *   pour la faire rentrer dans un référentiel serait remplacer une disparition
 *   par une autre* — `construireJournee` tient déjà ce raisonnement pour les
 *   colonnes ; il vaut mot pour mot pour les noms.
 *
 * La file non affectée — `technicien_id` nul — n'y entre pas : elle n'a
 * personne à nommer, et `quiTravaille` lui rend son libellé propre.
 */
export function personnesANommer(
  lignes: readonly Affectee[],
  techniciens: readonly Rattachee[],
): readonly string[] {
  const identifiants = new Set<string>();
  for (const technicien of techniciens) identifiants.add(technicien.id);
  for (const ligne of lignes) {
    if (ligne.technicien_id !== null) identifiants.add(ligne.technicien_id);
  }
  return [...identifiants];
}

/**
 * QUI TRAVAILLE — le libellé d'une colonne ou d'une ligne du planning.
 *
 * ## Les trois cas sont DITS, et le repli n'est plus un identifiant
 *
 * L'ancien repli était `Technicien <8 premiers caractères>`. Il avait deux
 * défauts, et le second n'avait été vu par personne :
 *
 * 1. **Il ressemblait à une donnée** là où il fallait lire un échec, et il
 *    confondait le refus légitime du cloisonnement avec l'oubli de l'écran.
 * 2. **Il ne distinguait personne.** Un `id` est un UUID v7 (I10) : ses 48 bits
 *    de poids fort portent l'horodatage, si bien que les 8 premiers caractères
 *    sont **les mêmes pour toutes les identités créées dans la même minute** —
 *    tout un semis, donc. *Mesuré le 14/09/2026 : deux `uuidv7()` consécutifs
 *    rendent `01a09db1` et `01a09db1`*, et l'écran montrait bel et bien deux
 *    colonnes intitulées « Technicien 01a09565 ». Un discriminant qui ne
 *    discrimine pas est pire qu'une absence : il fait croire à une identité.
 *
 * `non_demandee` reste **possible** — le type ne peut pas l'interdire — mais il
 * ne peut plus être **silencieux** : il se lit à l'écran comme une anomalie, et
 * `tests/unit/interventions/personnes-du-planning.test.ts` le refuse sur la
 * population réelle des colonnes.
 */
export function quiTravaille(
  technicienId: string | null,
  annuaire: Annuaire,
): string {
  if (technicienId === null) {
    return t("statistiques.non_affectees");
  }
  const designation = annuaire(technicienId);
  switch (designation.etat) {
    case "nom":
      return designation.nom;
    case "refusee":
      return t("planning.nom_non_communique");
    case "non_demandee":
      return t("planning.nom_non_demande");
  }
}

/** Le nom seul, pour ce qui TRIE plutôt que ce qui affiche. */
export function nomSeul(
  technicienId: string,
  annuaire: Annuaire,
): string | null {
  const designation = annuaire(technicienId);
  return designation.etat === "nom" ? designation.nom : null;
}

/** Une option du sélecteur « Affecter » — et ce qu'elle DIT avant le choix. */
export type OptionDAffectation = {
  readonly valeur: string;
  readonly libelle: string;
  /** L'agenda de cette personne est bloqué à la date de l'intervention (RG-PLA-06). */
  readonly bloque: boolean;
};

/**
 * LES OPTIONS DU SÉLECTEUR « AFFECTER » — et le blocage se lit DANS l'option
 * (PLANNING-1, RG-PLA-06, 22/09/2026).
 *
 * ## Le défaut mesuré
 *
 * RG-PLA-06 refuse l'affectation d'un technicien dont l'agenda est bloqué —
 * `verdictALaPose`, puis le déclencheur —, mais seulement APRÈS la tentative :
 * la fiche proposait la liste nue, le planificateur choisissait, se faisait
 * refuser, recommençait. *L'absence est une donnée connue d'avance* : elle se
 * dit ici, dans le libellé, avant le choix.
 *
 * ## Ce qu'elle dit, et ce qu'elle ne fait pas
 *
 * Le critère est celui du refus — `absenceCouvrant`, `lib/absences/periode.ts`
 * — et lui seul (§9, 01/09). **L'option reste sélectionnable** : la règle ne
 * change pas, c'est toujours le dépôt qui refuse ; la retirer de la liste
 * ferait disparaître une personne au lieu de dire pourquoi elle ne convient
 * pas, et un refus qui explique est un renseignement (§9, 20/08).
 *
 * **Le suffixe porte la DATE** — « agenda bloqué le 24/09/2026 », par
 * `dateCivile`, la forme de `date_planifiee` (`@db.Date`, minuit UTC) — parce
 * que la fiche ne l'affiche nulle part ailleurs : « à cette date » y
 * flotterait sans référent.
 *
 * **Une intervention SANS date ne peut rien affirmer** : aucun suffixe, jamais
 * « disponible » — la réserve absolue de `planning.technicien_sans_intervention`
 * (§9, 07/09). Le tri est par NOM, sans le suffixe : « D. Guérin — agenda
 * bloqué… » se range comme « D. Guérin ».
 */
export function optionsDAffectation(
  techniciens: readonly { readonly utilisateur_id: string }[],
  annuaire: Annuaire,
  absences: readonly AbsenceDeclaree[],
  dateIntervention: Date | null,
): readonly OptionDAffectation[] {
  return techniciens
    .map((technicien) => {
      const nom = quiTravaille(technicien.utilisateur_id, annuaire);
      const bloque =
        dateIntervention !== null &&
        absenceCouvrant(
          absences,
          technicien.utilisateur_id,
          dateIntervention,
        ) !== null;
      return { valeur: technicien.utilisateur_id, nom, bloque };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map(({ valeur, nom, bloque }) => ({
      valeur,
      libelle:
        bloque && dateIntervention !== null
          ? `${nom} — ${t("intervention.technicien_agenda_bloque_le")} ${dateCivile(dateIntervention)}`
          : nom,
      bloque,
    }));
}
