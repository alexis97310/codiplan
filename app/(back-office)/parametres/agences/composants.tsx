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
 */
export function LigneAgence({
  id,
  libelle,
  code,
  actif,
  parametrage,
  exceptions,
  colonnes,
}: {
  readonly id: string;
  readonly libelle: string;
  readonly code: string;
  readonly actif: boolean;
  readonly parametrage: Parametrage | null;
  readonly exceptions: number;
  readonly colonnes: number;
}) {
  // LE LIEN VERS LA FICHE DE MODIFICATION (AGENCE-1) — partagé par les deux
  // branches ci-dessous : un établissement sans calendrier reste modifiable,
  // c'est même par cette fiche qu'on corrige un rattachement resté vide sur
  // une ligne du semis antérieure à ce lot.
  const modifier = (
    <Cellule>
      <Link
        href={`/parametres/agences/${id}/modifier`}
        className={CLASSES_LIEN}
      >
        {t("agence.modifier")}
      </Link>
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
      <tr>
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
  const premierJour = jours[0];
  const exemple =
    premierJour === undefined ? [] : creneauxDuJour(parametrage, premierJour);

  return (
    <tr>
      {nom}
      <Cellule>
        {/* LA PORTE DE L'ÉCRAN DE DÉTAIL (R3-13).

            La barre reste close à onze entrées, confrontées à la maquette
            (D95) : *un écran se rejoint par un LIEN*, comme /sites et comme
            /clients. Le lien porte le nom du calendrier plutôt qu'un « ouvrir »
            générique — un libellé qui dit OÙ il mène se retrouve dans une page
            que l'on parcourt à la recherche d'un établissement. */}
        <Link
          href={`/parametres/agences/${parametrage.calendrierId}`}
          className={CLASSES_LIEN}
          aria-label={t("parametres.regler_horaires")}
        >
          {parametrage.libelle}
        </Link>
      </Cellule>
      <Cellule>{listeDesJours(jours)}</Cellule>
      <Cellule>{listeDesPlages(parametrage, premierJour)}</Cellule>
      <Cellule>{resumeCreneaux(exemple)}</Cellule>
      <Cellule droite>
        {exceptions === 0 ? t("parametres.exception_aucune") : exceptions}
      </Cellule>
      <Cellule>
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
            className="border-app-bord bg-app-surface w-20 rounded-md border px-2 py-1 text-[12.5px]"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("parametres.pas_enregistrer")}
          </Button>
        </form>
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

/** Le nom d'un jour ISO — au dictionnaire, jamais dans une liste écrite ici. */
function libelleJour(jour: number): string {
  const cle = `jour.${jour}`;
  return estCleTraduction(cle) ? t(cle) : String(jour);
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
