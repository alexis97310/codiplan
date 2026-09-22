import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
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
 *
 * ## AGENCE-2 — L'ÉTAT SE VOIT, ET LE LIEN DIT OÙ IL MÈNE
 *
 * **Mesuré le 22/09/2026 sur la base de production** : une agence désactivée
 * par la fiche d'AGENCE-1 s'affichait ici à l'identique d'une agence active —
 * `grep -nE "actif|inactif"` sur ce fichier ne rendait AUCUNE ligne, alors
 * que le dépôt rend le champ et que la fiche l'expose. *Un écran qui ignore
 * une donnée qu'il a sous la main empêche de vérifier le geste qu'on vient
 * de faire.*
 *
 * La forme est celle que le produit emploie déjà pour dire cet état dans un
 * tableau : la pastille de `/parametres/equipe` — `<Badge ton="vert">` Actif,
 * `<Badge ton="gris">` Inactif —, la même que `/clients` pose à côté du nom.
 * Elle est posée dans la cellule du NOM, pas en bout de ligne : c'est là
 * qu'on lit au premier coup d'œil, et l'état accompagne ce qu'il qualifie.
 * **La ligne inactive n'est PAS cachée** : il faut pouvoir la retrouver pour
 * la réactiver, et c'est cette fiche-là qui le permet.
 *
 * Le lien vers la fiche disait « Enregistrer » — il reprenait
 * `agence.action.modifier`, le bouton d'enregistrement de la fiche — et Alexis
 * a conclu qu'il n'y avait pas de lien. Il dit désormais « Modifier »
 * (`agence.modifier`), le mot de `/parametres/equipe`.
 *
 * **L'en-tête « Actions », lui, était déclaré depuis AGENCE-1 — et INVISIBLE
 * tout de même.** Mesuré à la prise de vue de ce lot, fenêtre de 1280 px :
 * la colonne latérale prend 272 px, la page 20 px de gouttière de chaque
 * côté, le tableau dispose de 966 px — et son minimum était de 1040. Le
 * conteneur défile latéralement, sans que rien ne le dise : la dernière
 * colonne, en-tête ET lien, est simplement hors du cadre. *Le DOM la porte,
 * l'œil ne l'atteint pas* — c'est la ligne exacte qu'Alexis a lue. Le
 * minimum est ramené à 960 px : c'est celui de la table des modèles de
 * `/parametres/materiel`, et la maquette (`.plan table{min-width:920px}`)
 * ne demande pas davantage. Cela ne suffisait pas — mesuré : la colonne
 * restait à 94,5 % dans le cadre, parce que le formulaire du pas, champ et
 * bouton côte à côte, fixe une largeur incompressible ; il passe donc en
 * `flex-wrap` (voir la ligne). À 1700 px — la fenêtre de R2-05 — rien ne
 * change ; à 1280, les huit colonnes tiennent dans le cadre, et le scénario
 * `tests/e2e/agences-etat-visible.spec.ts` l'exige à cette largeur.
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
        select: { id: true, libelle: true, calendrier_id: true, actif: true },
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
    { cle: "actions", libelle: t("agence.colonne_actions"), largeur: "90px" },
  ];

  return (
    <Page
      chemin="/parametres/agences"
      titre={t("parametres.titre")}
      sousTitre={t("parametres.sous_titre")}
      actions={
        <LienPrimaire href="/parametres/agences/nouvelle">
          {t("agence.creer")}
        </LienPrimaire>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau colonnes={colonnes} minimum="960px">
          {reglages.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("parametres.aucune_agence")}
            </LignePleine>
          ) : null}
          {reglages.map(({ agence, parametrage, exceptions }) => (
            <LigneAgence
              key={agence.id}
              id={agence.id}
              libelle={agence.libelle}
              actif={agence.actif}
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
    </Page>
  );
}

function LigneAgence({
  id,
  libelle,
  actif,
  parametrage,
  exceptions,
  colonnes,
}: {
  readonly id: string;
  readonly libelle: string;
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

  // LE NOM ET SON ÉTAT (AGENCE-2) — partagés par les deux branches eux aussi :
  // une agence sans calendrier peut être désactivée comme une autre.
  const nom = (
    <Cellule fort>
      <div className="flex flex-wrap items-center gap-2">
        <span>{libelle}</span>
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
