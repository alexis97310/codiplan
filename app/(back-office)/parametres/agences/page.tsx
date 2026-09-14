import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import {
  creneauxDuJour,
  enHeure,
  joursTravailles,
  lireParametrage,
  PAS_MAXIMUM,
  PAS_MINIMUM,
  type Parametrage,
} from "@/lib/calendar/parametrage";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * L'ÉCRAN DE RÉGLAGE DES HORAIRES (lot 2, I7 ; repris en tableau par R2-05).
 *
 * *« Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. Aucun
 * calendrier global codé en dur. »* Cet écran est ce qui rend la seconde phrase
 * vraie : sans lui, le pas des créneaux serait une constante dans un composant,
 * c'est-à-dire un réglage que personne ne peut changer.
 *
 * **Rien n'est écrit en dur ici, pas même l'exemple.** Les créneaux affichés
 * sont ceux que le planning proposerait réellement, calculés par la même
 * fonction — un exemple recopié serait une seconde lecture d'un même critère,
 * et il cesserait d'être vrai au premier réglage.
 *
 * ## R2-05 — UN TABLEAU DENSE, ET NON UNE CARTE PAR ENREGISTREMENT
 *
 * **Mesuré le 11/09/2026, fenêtre 1700 × 1000, trois établissements : contenu
 * de 896 px, document de 1428 px, DEUX établissements sur trois entièrement
 * visibles.** Soit près de 380 px de hauteur pour huit champs. *Un écran de
 * réglage qu'on ne peut pas embrasser d'un regard oblige à mémoriser la ligne
 * précédente pour comparer deux réglages — c'est-à-dire à faire de tête ce que
 * l'écran est là pour montrer.*
 *
 * La maquette range ce genre de contenu en tableau — « Calendriers d'ouverture
 * par site », en-têtes en capitales fines, lignes denses — et D95 lui donne foi
 * sur la disposition. La forme du tableau est partagée avec `/parametres/
 * forfaits` (R2-06) : *deux implémentations d'un même critère divergent en
 * silence.*
 *
 * **Le formulaire de réglage du pas reste DANS la ligne.** Sortir le réglage
 * dans un écran de détail ferait perdre la comparaison qui vient d'être gagnée :
 * on règle un pas en regardant celui des autres établissements.
 *
 * **ET CET ARGUMENT NE VAUT PAS POUR LES PLAGES (R3-13).** Un pas est un
 * nombre, qu'on compare d'un établissement à l'autre ; une semaine d'ouverture
 * est sept jours et autant de plages, et l'entrer dans une cellule détruirait
 * exactement la densité que R2-05 venait de gagner. Les plages se règlent donc
 * sur un écran de détail, atteint par le lien que porte le nom du calendrier —
 * *la barre ne bouge pas, un écran se rejoint par un lien.*
 *
 * **Un écart avec la maquette, écrit avec sa raison :** elle intitule ce
 * tableau « par site », et ses lignes sont Ducos, Koné et Dolbeau — qui sont des
 * ÉTABLISSEMENTS. Le vocabulaire imposé prime (D5, D47) : le titre de colonne
 * vient de `mot("agence")`. *La maquette fait foi sur la disposition et sur les
 * couleurs, jamais sur le vocabulaire.*
 */
export default async function PageParametresAgences({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const motif = (await searchParams).motif;

  const reglages = await avecContexteApplicatif(
    session.contexte,
    async (tx) => {
      const agences = await tx.agence.findMany({
        select: { id: true, libelle: true, calendrier_id: true },
        orderBy: { libelle: "asc" },
      });
      const exceptions = await tx.technicienCalendrier.findMany({
        select: { utilisateur_id: true, calendrier_id: true },
      });
      return Promise.all(
        agences.map(async (agence) => ({
          agence,
          parametrage:
            agence.calendrier_id === null
              ? null
              : await lireParametrage(tx, agence.calendrier_id),
          exceptions: exceptions.filter(
            (e) => e.calendrier_id === agence.calendrier_id,
          ).length,
        })),
      );
    },
  );

  const colonnes = [
    { cle: "agence", libelle: mot("agence"), largeur: "180px" },
    { cle: "calendrier", libelle: t("parametres.calendrier") },
    { cle: "jours", libelle: t("parametres.jours") },
    { cle: "horaires", libelle: t("parametres.horaires") },
    { cle: "creneaux", libelle: t("parametres.colonne_creneaux") },
    {
      cle: "exceptions",
      libelle: t("parametres.colonne_exceptions"),
      droite: true,
    },
    { cle: "pas", libelle: t("parametres.colonne_pas"), largeur: "230px" },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("parametres.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("parametres.sous_titre")}
        </p>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="1040px">
          {reglages.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("parametres.aucune_agence")}
            </LignePleine>
          ) : null}
          {reglages.map(({ agence, parametrage, exceptions }) => (
            <LigneAgence
              key={agence.id}
              libelle={agence.libelle}
              parametrage={parametrage}
              exceptions={exceptions}
              colonnes={colonnes.length}
            />
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("parametres.exception_explication")}
      </p>
    </main>
  );
}

function LigneAgence({
  libelle,
  parametrage,
  exceptions,
  colonnes,
}: {
  readonly libelle: string;
  readonly parametrage: Parametrage | null;
  readonly exceptions: number;
  readonly colonnes: number;
}) {
  if (parametrage === null) {
    // « Sans calendrier » n'est pas une ligne vide : c'est un état qui se DIT,
    // et qui interdit toute pose (I7). La ligne le nomme plutôt que d'afficher
    // des tirets qu'on lirait comme « pas encore renseigné ».
    return (
      <tr>
        <Cellule fort>{libelle}</Cellule>
        <td
          colSpan={colonnes - 1}
          className="border-app-bord text-app-rouge-encre border-b px-4 py-[11px]"
        >
          {t("parametres.sans_calendrier")}
        </td>
      </tr>
    );
  }

  const jours = joursTravailles(parametrage);
  const premierJour = jours[0];
  const exemple =
    premierJour === undefined ? [] : creneauxDuJour(parametrage, premierJour);

  return (
    <tr>
      <Cellule fort>{libelle}</Cellule>
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
          className="flex items-center gap-2"
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
