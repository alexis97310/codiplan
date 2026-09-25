import Link from "next/link";

import type { Annuaire } from "@/lib/auth/annuaire";
import { t } from "@/lib/i18n/fr";
import { quiTravaille } from "@/lib/interventions/personnes";
import { mot } from "@/lib/i18n/vocabulaire";
import { enHeure } from "@/lib/calendar/parametrage";
import {
  partDuSegment,
  TAUX_PLEIN,
  tauxArrondiAZeroMaisNonNul,
  tauxOccupation,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";
import type { LigneOccupation } from "@/lib/interventions/occupation";
import { CLASSES_STATUT } from "@/lib/theme/statuts";
import type { StatutIntervention } from "@prisma/client";

/**
 * LA CHARGE PAR TECHNICIEN — nombre, taux d'occupation, barre segmentée.
 *
 * **JAMAIS LE POURCENTAGE SEUL** *(demande d'exploitation du 10/09/2026)*. Le
 * taux ne s'affiche qu'accompagné de ses DEUX termes et de la FORMULE qui les
 * relie. Ce n'est pas une politesse d'affichage : un taux d'occupation qui
 * voyage seul finit comparé entre deux agences dont les calendriers n'ont rien
 * à voir — c'est D56, *un nombre dont la signification dépend d'autre chose ne
 * voyage jamais seul*.
 *
 * Un gardien statique lit ce fichier et refuse que `tauxOccupation` y
 * apparaisse sans `heures_engagees`, `heures_ouvrables` et `formule` :
 * `tests/unit/interventions/occupation-affichee.test.ts`.
 *
 * ## LE TRAJET EST AFFICHÉ À PART, ET L'ÉCRAN DIT CE QU'IL NE COMPTE PAS
 *
 * Depuis L3-05a, la charge inclut le trajet (RG-PLA-05, lecture C de D107) :
 * l'aller vers le premier lieu de la journée, le retour depuis le dernier. **Le
 * temps d'un lieu à un autre n'est pas connu, et l'écran l'ÉCRIT** plutôt que de
 * l'approcher — *soustraire deux distances à un point commun n'est pas une
 * distance*, et c'est la discipline du `NOT VALID` de D104.
 *
 * Les deux termes du numérateur sont montrés SÉPARÉMENT, et la formule les
 * additionne : *un taux dont on ne peut plus retrouver les termes n'est plus
 * vérifiable.* Et les journées dont le trajet est inconnu sont DITES — une
 * journée vers les Îles compte zéro minute de trajet, et sans la mention le taux
 * paraîtrait juste.
 *
 * **La barre, elle, reste celle des interventions** : elle est segmentée par
 * statut, et un trajet n'a pas de statut. L'y verser ferait une barre dont les
 * segments ne somment plus à leur propre largeur.
 *
 * **La barre représente les heures ENGAGÉES**, jamais les heures ouvrables :
 * ses segments somment à sa propre largeur. Le taux, lui, se lit à côté. Une
 * barre qui mélangerait les deux échelles serait illisible et fausse.
 */
export function Statistiques({
  lignes,
  annuaire,
}: {
  lignes: readonly LigneOccupation[];
  /**
   * Les noms, lus sous le contexte cloisonné par l'appelant (R2-11). Ils ne
   * sont pas lus ici : un composant qui ouvrirait sa propre lecture ferait un
   * second endroit où le cloisonnement se décide, et les deux finiraient par ne
   * plus lire la même chose (§9, 01/09).
   *
   * **Il est OBLIGATOIRE depuis le 14/09/2026.** Facultatif, il rendait le
   * repli — un fragment d'identifiant — au premier appelant qui l'oubliait, et
   * *une garantie qu'un paramètre facultatif porte n'en est pas une* (la leçon
   * de D70).
   */
  annuaire: Annuaire;
}) {
  if (lignes.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium">{t("statistiques.titre")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("statistiques.sous_titre")}
        </p>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("statistiques.trajet_lecture")}
      </p>
      <ul className="flex flex-col gap-4">
        {lignes.map((ligne) => (
          <li
            key={`${ligne.technicienId ?? "-"}|${ligne.agenceId}`}
            className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3"
          >
            <Entete ligne={ligne} annuaire={annuaire} />
            <Barre occupation={ligne.occupation} />
            <Chiffres occupation={ligne.occupation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ouTravaille(ligne: LigneOccupation): string {
  return `${mot("agence")} ${ligne.agenceLibelle}`;
}

function combienDInterventions(occupation: OccupationTechnicien): string {
  const mot =
    occupation.interventions === 1
      ? t("statistiques.nombre_un")
      : t("statistiques.nombre");
  return `${occupation.interventions} ${mot}`;
}

function infobulleDuSegment(
  statut: StatutIntervention,
  minutes: number,
): string {
  return `${t(`statut.${statut}`)}${t("ponctuation.separateur")}${enHeure(minutes)}`;
}

function heuresEngagees(occupation: OccupationTechnicien): string {
  return `${enHeure(occupation.minutesEngagees)} ${t("statistiques.heures_engagees")}`;
}

function heuresOuvrables(occupation: OccupationTechnicien): string {
  return `${enHeure(occupation.minutesOuvrables)} ${t("statistiques.heures_ouvrables")}`;
}

/**
 * LE TRAJET, à côté des heures engagées et jamais fondu dedans (L3-05a, D107).
 *
 * *Un taux dont on ne peut plus retrouver les termes n'est plus vérifiable* : la
 * formule additionne les deux, l'écran les montre séparément, et le lecteur peut
 * refaire le calcul.
 */
function heuresDeTrajet(occupation: OccupationTechnicien): string {
  return `${enHeure(occupation.trajet.minutes)} ${t("statistiques.heures_trajet")}`;
}

/**
 * Les journées dont le trajet est INCONNU — dites, jamais dissoutes.
 *
 * Même famille que `sansDuree` : sans cette mention, une journée vers un lieu
 * sans zone ou vers les Îles compterait zéro minute de trajet et le taux
 * paraîtrait juste (§9, 06/09 — un chiffre juste qui fait conclure faux).
 */
function combienDeJourneesSansTrajet(occupation: OccupationTechnicien): string {
  const nombre = occupation.trajet.journeesSansTrajet;
  const mot =
    nombre === 1
      ? t("statistiques.journees_sans_trajet_une")
      : t("statistiques.journees_sans_trajet");
  return `${nombre} ${mot}`;
}

/**
 * LE TAUX ET SA FORMULE, dans la même chaîne — c'est ici que la règle « jamais
 * le pourcentage seul » devient inséparable pour de bon : on ne peut pas
 * afficher l'un sans l'autre sans réécrire cette fonction.
 */
function tauxEtFormule(taux: number, infime: boolean): string {
  const valeur = infime
    ? t("statistiques.taux_infime")
    : `${taux}${t("statistiques.pourcent")}`;
  return `${t("statistiques.taux")} ${valeur}${t("ponctuation.separateur")}${t("statistiques.formule")}`;
}

function combienSansDuree(occupation: OccupationTechnicien): string {
  const mot =
    occupation.sansDuree === 1
      ? t("statistiques.sans_duree_un")
      : t("statistiques.sans_duree");
  return `${occupation.sansDuree} ${mot}`;
}

/**
 * LES HEURES ENGAGÉES, quand le nombre ne peut être qu'un PLANCHER (SAV-05).
 *
 * Dès que `sansDuree > 0`, `minutesEngagees` ne compte plus la charge réelle du
 * technicien : les interventions sans durée saisie y comptent pour zéro. Le
 * chiffre affiché reste juste, mais il cesse d'être TOUT ce qui est engagé —
 * d'où le « au moins » plutôt que la mention nue.
 */
function heuresEngageesAuMoins(occupation: OccupationTechnicien): string {
  return `${t("statistiques.au_moins")} ${enHeure(occupation.minutesEngagees)} ${t("statistiques.heures_engagees")}`;
}

/**
 * LA CHARGE INCOMPLÈTE — ce qui remplace le taux dès que `sansDuree > 0`
 * (53-PLANNING-3, SAV-05).
 *
 * *Un chiffre juste qui fait conclure faux* (§9, 06/09) : un technicien dont
 * les interventions n'ont pas de durée s'affichait « 0 % » et paraissait
 * libre. Le taux n'est donc plus calculé pour lui, et cette ligne le dit — le
 * nombre d'interventions sans durée vient de `combienSansDuree`, jamais d'une
 * seconde formulation du même compte.
 */
function chargeIncomplete(occupation: OccupationTechnicien): string {
  return `${t("statistiques.charge_incomplete")}${t("ponctuation.separateur")}${combienSansDuree(occupation)}`;
}

function Entete({
  ligne,
  annuaire,
}: {
  ligne: LigneOccupation;
  annuaire: Annuaire;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">
        {quiTravaille(ligne.technicienId, annuaire)}
      </span>
      <span className="text-muted-foreground text-xs">
        {ouTravaille(ligne)}
      </span>
      <span className="ml-auto">{combienDInterventions(ligne.occupation)}</span>
    </div>
  );
}

/**
 * La barre segmentée des heures, aux couleurs de statut de l'annexe D.
 *
 * Les segments vides ne sont pas rendus — un segment de largeur nulle n'ajoute
 * rien —, mais ils existent dans la donnée : la grammaire de la barre est la
 * même pour tout le monde, et c'est ce qui la rend comparable d'une ligne à
 * l'autre.
 */
function Barre({ occupation }: { occupation: OccupationTechnicien }) {
  const segments = occupation.segments.filter((s) => s.minutes > 0);
  if (segments.length === 0) {
    return null;
  }
  return (
    <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
      {segments.map((segment) => (
        <span
          key={segment.statut}
          className={CLASSES_STATUT[segment.statut]}
          style={{ width: `${partDuSegment(segment, occupation)}%` }}
          title={infobulleDuSegment(segment.statut, segment.minutes)}
        />
      ))}
    </div>
  );
}

/**
 * Les chiffres, et la formule à côté.
 *
 * L'ORDRE compte : les deux termes viennent AVANT le taux, pour que le lecteur
 * les ait vus quand il arrive au pourcentage. Et quand le dénominateur est
 * inconnu, il n'y a pas de taux du tout — pas un zéro.
 */
function Chiffres({ occupation }: { occupation: OccupationTechnicien }) {
  const taux = tauxOccupation(occupation);
  // LE TAUX NE S'AFFICHE PLUS QUAND LA CHARGE EST INCOMPLÈTE (SAV-05) : un
  // chiffre juste — « 0 % » sur des interventions sans durée — fait conclure
  // faux. Le nombre engagé lui-même devient un PLANCHER, jamais un total.
  const incomplete = occupation.sansDuree > 0;
  return (
    <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
      <span>
        {incomplete
          ? heuresEngageesAuMoins(occupation)
          : heuresEngagees(occupation)}
      </span>
      <span>{heuresDeTrajet(occupation)}</span>
      <span>{heuresOuvrables(occupation)}</span>
      {incomplete ? (
        <span className="text-foreground">{chargeIncomplete(occupation)}</span>
      ) : taux === null ? (
        <span>{t("statistiques.sans_calendrier")}</span>
      ) : (
        <span className="text-foreground">
          {tauxEtFormule(taux, tauxArrondiAZeroMaisNonNul(occupation))}
        </span>
      )}
      {/* LE DÉPASSEMENT SE DIT LÀ OÙ LE CHIFFRE S'AFFICHE, et nulle part
          ailleurs (14/09/2026). La décision — *le taux se dit, il ne se
          plafonne pas* — vivait dans le commentaire de
          `lib/interventions/statistiques.ts`, donc à l'abri du seul lecteur
          qu'elle concerne. La mention n'apparaît QUE sur le dépassement :
          permanente, elle deviendrait du bruit et cesserait d'être lue. */}
      {taux !== null && taux > TAUX_PLEIN ? (
        <span>{t("statistiques.taux_au_dela")}</span>
      ) : null}
      {incomplete ? (
        // LA CIBLE TACTILE (audit d'ergonomie du 25/09/2026, constat 40,
        // 99F-CIBLES-375) — mesurée à 16 px de haut sur un téléphone, contre
        // 44 px recommandés. `sm:` efface les classes ajoutées : l'apparence
        // bureau ne change pas.
        <Link
          href="/interventions?sans_duree_a_venir=1"
          className="inline-flex min-h-11 items-center text-[13px] underline sm:inline sm:min-h-0 sm:text-xs"
        >
          {t("statistiques.charge_incomplete_lien")}
        </Link>
      ) : null}
      {occupation.trajet.journeesSansTrajet > 0 ? (
        <span>{combienDeJourneesSansTrajet(occupation)}</span>
      ) : null}
    </div>
  );
}
