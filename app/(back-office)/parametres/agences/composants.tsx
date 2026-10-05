import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cellule } from "@/components/ui/tableau";
import {
  creneauxDuJour,
  enHeure,
  joursTravailles,
  PAS_MAXIMUM,
  PAS_MINIMUM,
  type Parametrage,
} from "@/lib/calendar/parametrage";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libelleAgenceAvecCode } from "@/lib/agences/presentation";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { trierAlphanumeriquement } from "@/lib/tri/collation";
import { cn } from "@/lib/utils";

/** Le minimum qu'une ligne de réglage porte pour être triée (voir `trierReglagesAgences`). */
export type ReglageAgenceTriable = {
  readonly agence: { readonly libelle: string; readonly actif: boolean };
};

/**
 * TRI LISTES-1 PUIS INACTIVES EN FIN (AGENCE-2, TP-A6-TRIS-MISE-EN-PAGE,
 * 30/09/2026, PA-27) — extraite pour être éprouvée SANS base
 * (`tests/unit/agences/tri-reglages.test.ts`), même raison que `LigneAgence`
 * ci-dessous (D-13).
 *
 * `Array.prototype.sort` est STABLE (ES2019) : le second tri (inactif en
 * dernier) ne rejuge pas l'ordre alphanumérique déjà posé par le premier à
 * l'intérieur de chaque groupe.
 */
export function trierReglagesAgences<T extends ReglageAgenceTriable>(
  reglages: readonly T[],
): readonly T[] {
  return [...trierAlphanumeriquement(reglages, (r) => r.agence.libelle)].sort(
    (a, b) => Number(!a.agence.actif) - Number(!b.agence.actif),
  );
}

/**
 * LA LIGNE D'UN ÉTABLISSEMENT (AGENCE-2, puis AGENCE-CODE-1) — extraite de
 * `page.tsx` (D-13, même raison que `estExpiree` dans
 * `parametres/equipe/presentation.ts`) : un `page.tsx` de l'App Router
 * n'accepte que les exports que Next.js reconnaît, et ce composant a besoin
 * d'être importable par un test de rendu sans base ni navigateur.
 *
 * ## AGENCE-CODE-1 — le libellé seul ne distingue pas deux établissements
 *
 * `code` est la clé unique par société (`@@unique([societe_id, code])`), le
 * libellé ne l'est délibérément pas — deux établissements peuvent porter le
 * même nom d'usage. Mesuré le 22/09/2026 en production : deux agences
 * « DUCOS » y coexistent, identiques à l'écran. Le nom affiche donc
 * désormais `libelleAgenceAvecCode(libelle, code)` plutôt que le seul
 * libellé — la MÊME composition que les menus de rattachement
 * (`components/agences/options.tsx`), pour que ce soit un seul critère lu à
 * deux endroits, jamais deux lectures qui divergent en silence.
 *
 * ## TP-A6-TRIS-MISE-EN-PAGE (30/09/2026, PA-27) — la ligne inactive se VOIT,
 * et ne se règle plus
 *
 * La ligne d'une agence désactivée porte désormais un fond gris
 * (`bg-app-surface-creuse`, un jeton déjà posé — aucun gris inventé), et
 * n'offre plus les DEUX réglages qui n'ont plus de sens sur un établissement
 * fermé : le formulaire du pas et le lien vers l'écran des plages. Le reste —
 * jours, plages résumées, créneaux — reste lisible : c'est un
 * REPÈRE, ce n'est pas une donnée qui disparaît (même raison que la ligne
 * non cachée elle-même, voir plus haut). « Modifier » reste, sur les deux
 * états : c'est la seule fiche qui réactive.
 */
export function LigneAgence({
  id,
  libelle,
  code,
  actif,
  parametrage,
  colonnes,
  peutEcrire,
}: {
  readonly id: string;
  readonly libelle: string;
  readonly code: string;
  readonly actif: boolean;
  readonly parametrage: Parametrage | null;
  readonly colonnes: number;
  /**
   * D153 (03/10/2026, TP-S3) — `administrer_agences`, aucun ○ : la LECTURE de
   * ce tableau reste ouverte à tout rôle non technicien, seule l'ÉCRITURE
   * (« Modifier », le pas des créneaux) suit cette capacité.
   */
  readonly peutEcrire: boolean;
}) {
  // LE LIEN VERS LA FICHE DE MODIFICATION (AGENCE-1) — partagé par les deux
  // branches ci-dessous : un établissement sans calendrier reste modifiable,
  // c'est même par cette fiche qu'on corrige un rattachement resté vide sur
  // une ligne du semis antérieure à ce lot.
  const modifier = (
    <Cellule>
      {peutEcrire ? (
        <Link href={`/parametres/agences/${id}`} className={CLASSES_LIEN}>
          {t("agence.modifier")}
        </Link>
      ) : null}
    </Cellule>
  );

  // LE NOM, SON CODE ET SON ÉTAT (AGENCE-2, AGENCE-CODE-1) — partagés par les
  // deux branches eux aussi : une agence sans calendrier peut être désactivée
  // comme une autre, et porte un code comme une autre.
  const nom = (
    <Cellule fort>
      <div className="flex flex-wrap items-center gap-2">
        <span>{libelleAgenceAvecCode(libelle, code)}</span>
        {actif ? (
          <Badge ton="vert">{t("agence.actif")}</Badge>
        ) : (
          <Badge ton="gris">{t("agence.inactif")}</Badge>
        )}
      </div>
    </Cellule>
  );

  if (parametrage === null) {
    // « Sans calendrier » n'est pas une ligne vide : c'est un état qui se DIT,
    // et qui interdit toute pose (I7). La ligne le nomme plutôt que d'afficher
    // des tirets qu'on lirait comme « pas encore renseigné ».
    return (
      <tr className={cn(!actif && "bg-app-surface-creuse")}>
        {nom}
        <td
          colSpan={colonnes - 2}
          className="border-app-bord text-app-rouge-encre border-b px-4 py-[11px]"
        >
          {t("parametres.sans_calendrier")}
        </td>
        {modifier}
      </tr>
    );
  }

  const jours = joursTravailles(parametrage);
  const groupes = grouperJoursParHoraire(parametrage, jours);

  return (
    <tr className={cn(!actif && "bg-app-surface-creuse")}>
      {nom}
      <Cellule>
        {/* LA PORTE DE L'ÉCRAN DE DÉTAIL (R3-13).

            La barre reste close à onze entrées, confrontées à la maquette
            (D95) : *un écran se rejoint par un LIEN*, comme /sites et comme
            /clients. Le lien porte le nom du calendrier plutôt qu'un « ouvrir »
            générique — un libellé qui dit OÙ il mène se retrouve dans une page
            que l'on parcourt à la recherche d'un établissement.

            AGENCE-2 / TP-A6 : une agence INACTIVE ne l'offre plus — régler les
            plages d'un établissement fermé n'a pas de sens, et le nom reste
            lisible sans mener nulle part. */}
        {actif ? (
          <Link
            href={`/parametres/agences/calendrier/${parametrage.calendrierId}`}
            className={CLASSES_LIEN}
            aria-label={t("parametres.regler_horaires")}
          >
            {parametrage.libelle}
          </Link>
        ) : (
          parametrage.libelle
        )}
      </Cellule>
      <Cellule>{listeDesJours(jours)}</Cellule>
      <Cellule>
        {groupes.map((groupe) => (
          <div key={groupe.premierJour}>
            {ligneDuGroupe(parametrage, groupe)}
          </div>
        ))}
      </Cellule>
      <Cellule>
        {groupes.map((groupe) => (
          <div key={groupe.premierJour}>
            {resumeCreneaux(creneauxDuJour(parametrage, groupe.premierJour))}
          </div>
        ))}
      </Cellule>
      <Cellule>
        {/* TP-A6 : le pas ne se règle plus sur une agence INACTIVE — même
            raison que le lien des horaires ci-dessus. D153 (TP-S3) : il ne
            se règle pas non plus sans `administrer_agences` — la valeur
            reste lisible, en texte, plutôt que dans un formulaire que la
            route refuserait. */}
        {!actif ? null : peutEcrire ? (
          <form
            action="/api/parametres/pas-creneau"
            method="post"
            // `flex-wrap` (AGENCE-2) : à 1280 px, ce formulaire est ce qui fixe
            // la largeur incompressible de la ligne — champ, écart et bouton
            // côte à côte —, et c'est lui qui poussait la colonne des actions
            // hors du cadre. Le bouton passe sous le champ quand la place
            // manque, et reste à côté à 1700 px, la fenêtre de R2-05.
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="hidden"
              name="calendrier_id"
              value={parametrage.calendrierId}
            />
            <label
              className="sr-only"
              htmlFor={`pas-${parametrage.calendrierId}`}
            >
              {t("parametres.pas")}
            </label>
            <input
              id={`pas-${parametrage.calendrierId}`}
              name="pas"
              type="number"
              min={PAS_MINIMUM}
              max={PAS_MAXIMUM}
              defaultValue={parametrage.pasCreneauMinutes}
              className="border-app-bord bg-app-surface w-20 rounded-md border px-2 py-1 text-13 font-bold"
            />
            <Button type="submit" variant="outline" size="sm">
              {t("parametres.pas_enregistrer")}
            </Button>
          </form>
        ) : (
          <span>{parametrage.pasCreneauMinutes}</span>
        )}
      </Cellule>
      {modifier}
    </tr>
  );
}

/**
 * Les énumérations sont composées HORS du JSX — un littéral n'y est pas admis,
 * fût-il le séparateur d'une liste (L0-11). C'est le gardien qui l'a dit, pas la
 * relecture.
 */
function listeDesJours(jours: readonly number[]): string {
  return jours.map((j) => libelleJour(j)).join(SEPARATEUR);
}

function listeDesPlages(
  parametrage: Parametrage,
  jourSemaine: number | undefined,
): string {
  return parametrage.plages
    .filter((p) => p.jourSemaine === jourSemaine)
    .map((p) => `${enHeure(p.debutMinutes)}–${enHeure(p.finMinutes)}`)
    .join(SEPARATEUR);
}

const SEPARATEUR = ", ";
const SEPARATEUR_LIBELLE = " : ";
const FLECHE_GROUPE = "–";

/** Le nom d'un jour ISO — au dictionnaire, jamais dans une liste écrite ici. */
function libelleJour(jour: number): string {
  const cle = `jour.${jour}`;
  return estCleTraduction(cle) ? t(cle) : String(jour);
}

/** La forme courte du nom d'un jour ISO — « Lun », « Mar »… */
function libelleJourCourt(jour: number): string {
  const cle = `jour.court.${jour}`;
  return estCleTraduction(cle) ? t(cle) : String(jour);
}

/**
 * UN GROUPE DE JOURS CONSÉCUTIFS PARTAGEANT LES MÊMES PLAGES (PA-31, QT-21,
 * D167, 05/10/2026, TP-NAV1).
 *
 * `premierJour` sert à la fois de clé React et de jour représentatif du
 * groupe : ses plages et ses créneaux sont, par construction, ceux de
 * n'importe quel autre jour du même groupe.
 */
export type GroupeHoraire = {
  readonly premierJour: number;
  readonly jours: readonly number[];
};

/** La signature d'un jour — ses plages, dans l'ordre où elles sont posées. */
function signatureDuJour(parametrage: Parametrage, jour: number): string {
  return parametrage.plages
    .filter((p) => p.jourSemaine === jour)
    .map((p) => `${p.debutMinutes}-${p.finMinutes}`)
    .join(SEPARATEUR);
}

/**
 * REGROUPE LES JOURS TRAVAILLÉS CONSÉCUTIFS QUI PORTENT LES MÊMES PLAGES
 * (PA-31) — le défaut mesuré à l'audit du 28/09/2026 : la colonne ne montrait
 * que les plages du PREMIER jour travaillé, si bien qu'un samedi à horaires
 * différents (lundi-samedi, QG-7) n'apparaissait jamais. « lun.–ven. » et
 * « sam. » deviennent alors deux groupes plutôt qu'un seul jour qui se fait
 * passer pour la semaine entière.
 */
export function grouperJoursParHoraire(
  parametrage: Parametrage,
  jours: readonly number[],
): readonly GroupeHoraire[] {
  const groupes: number[][] = [];
  for (const jour of jours) {
    const groupeCourant = groupes.at(-1);
    const dernierJour = groupeCourant?.at(-1);
    if (
      groupeCourant !== undefined &&
      dernierJour !== undefined &&
      signatureDuJour(parametrage, dernierJour) ===
        signatureDuJour(parametrage, jour)
    ) {
      groupeCourant.push(jour);
    } else {
      groupes.push([jour]);
    }
  }
  return groupes.map((groupe) => ({
    premierJour: groupe[0],
    jours: groupe,
  }));
}

/** « Lun.–Ven. » pour un groupe de plusieurs jours, « Sam. » pour un seul. */
function libelleGroupeJours(jours: readonly number[]): string {
  const premier = libelleJourCourt(jours[0]);
  if (jours.length === 1) {
    return premier;
  }
  const dernier = libelleJourCourt(jours[jours.length - 1]);
  return `${premier}${FLECHE_GROUPE}${dernier}`;
}

/** La ligne « Lun.–Ven. : 07:00–17:00 » affichée pour un groupe. */
function ligneDuGroupe(
  parametrage: Parametrage,
  groupe: GroupeHoraire,
): string {
  return `${libelleGroupeJours(groupe.jours)}${SEPARATEUR_LIBELLE}${listeDesPlages(parametrage, groupe.premierJour)}`;
}

/**
 * Le résumé de la grille : le premier créneau, le dernier, et le compte.
 *
 * Les afficher tous ferait une colonne illisible ; n'afficher que le compte ne
 * dirait pas si la grille commence à la bonne heure. Les deux bouts et le
 * nombre suffisent à repérer un réglage faux d'un coup d'œil.
 */
function resumeCreneaux(creneaux: readonly number[]): string {
  if (creneaux.length === 0) {
    return "—";
  }
  const premier = enHeure(creneaux[0] ?? 0);
  const dernier = enHeure(creneaux[creneaux.length - 1] ?? 0);
  return `${premier} → ${dernier} (${creneaux.length})`;
}
