import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { enHeure } from "@/lib/calendar/parametrage";
import {
  partDuSegment,
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
 * **La barre représente les heures ENGAGÉES**, jamais les heures ouvrables :
 * ses segments somment à sa propre largeur. Le taux, lui, se lit à côté. Une
 * barre qui mélangerait les deux échelles serait illisible et fausse.
 */
export function Statistiques({
  lignes,
  nomDe,
}: {
  lignes: readonly LigneOccupation[];
  /**
   * Le nom d'une personne, lu sous le contexte cloisonné par l'appelant
   * (R2-11). Il n'est pas lu ici : un composant qui ouvrirait sa propre lecture
   * ferait un second endroit où le cloisonnement se décide, et les deux
   * finiraient par ne plus lire la même chose (§9, 01/09).
   */
  nomDe?: (id: string) => string | null;
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
      <ul className="flex flex-col gap-4">
        {lignes.map((ligne) => (
          <li
            key={`${ligne.technicienId ?? "-"}|${ligne.agenceId}`}
            className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3"
          >
            <Entete ligne={ligne} nomDe={nomDe} />
            <Barre occupation={ligne.occupation} />
            <Chiffres occupation={ligne.occupation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Les compositions sortent du JSX, comme `lieuDeLaLigne` du planning : un
 * littéral n'y est pas admis (L0-11), et pour la même raison — ce qui se lit à
 * l'écran vient du dictionnaire, pas de la balise.
 */
function quiTravaille(
  ligne: LigneOccupation,
  nomDe?: (id: string) => string | null,
): string {
  if (ligne.technicienId === null) {
    return t("statistiques.non_affectees");
  }
  // LE NOM, DEPUIS R2-11 — et l'identifiant abrégé en repli. Une identité que
  // la politique refuse ne rend pas de nom : l'écran affiche alors ce qu'il
  // sait, jamais un nom qu'il n'a pas le droit de connaître.
  return (
    nomDe?.(ligne.technicienId) ??
    `${t("statistiques.technicien")} ${ligne.technicienId.slice(0, 8)}`
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

function Entete({
  ligne,
  nomDe,
}: {
  ligne: LigneOccupation;
  nomDe?: (id: string) => string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">{quiTravaille(ligne, nomDe)}</span>
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
  return (
    <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
      <span>{heuresEngagees(occupation)}</span>
      <span>{heuresOuvrables(occupation)}</span>
      {taux === null ? (
        <span>{t("statistiques.sans_calendrier")}</span>
      ) : (
        <span className="text-foreground">
          {tauxEtFormule(taux, tauxArrondiAZeroMaisNonNul(occupation))}
        </span>
      )}
      {occupation.sansDuree > 0 ? (
        <span>{combienSansDuree(occupation)}</span>
      ) : null}
    </div>
  );
}
