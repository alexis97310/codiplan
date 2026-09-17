import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import {
  lireLesAbsences,
  nommerLesAgences,
  nommerLesInterventions,
} from "@/lib/absences/ecran";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { quiTravaille } from "@/lib/interventions/personnes";

import { referenceAffichee } from "../interventions/presentation";

import { identifiants } from "../../api/absences/actions";

/**
 * L'ÉCRAN DES BLOCAGES D'AGENDA (R3-14, RG-PLA-06).
 *
 * ## Pourquoi il existe
 *
 * `occupationTechnicien` retranche les périodes bloquées du dénominateur du
 * taux d'occupation, précisément pour distinguer *« il était indisponible »* de
 * *« il n'a rien fait »*. **Aucun blocage ne pouvant être posé, cette branche
 * n'était jamais prise** : les taux affichés étaient justes *pour un monde où
 * personne n'est jamais absent*, et ils ne disaient pas qu'ils l'étaient.
 *
 * ## CE QU'IL N'EST PAS — et c'est la décision du 14/09/2026
 *
 * **Ce n'est pas un écran de gestion des congés.** Une personne, une date de
 * début, une date de fin, et rien d'autre : ni nature, ni motif, ni champ
 * libre, ni file de demandes à trancher. *CODIPLAN n'est pas un outil de
 * gestion des ressources humaines*, et un écran qui ferait choisir entre
 * « congé » et « arrêt maladie » écrirait une donnée de santé sur une personne
 * nommée.
 *
 * **Le blocage est donc IMMÉDIAT**, et la conséquence est écrite plutôt que
 * tue : il n'y a plus rien à valider, donc plus de moment où quelqu'un relit
 * avant que le planning bouge. Poser rend à la file ; lever ne rend rien.
 *
 * ## Il ne propose AUCUN créneau
 *
 * *Un moteur qui propose sur un effectif d'un ne propose rien* (D106). Ce que
 * cet écran rend, ce sont les interventions **rendues à la file** et les agences
 * où le service est **rompu** — nommées, jamais comptées : *« 3 interventions
 * déplanifiées » ne dit pas lesquelles*, et c'est exactement ce que le
 * planificateur doit voir pour les reposer.
 *
 * ## Ce qu'il DIT et qu'il ne peut pas empêcher
 *
 * Rien n'est matérialisé : le taux d'occupation relit les blocages à chaque
 * rendu. Poser aujourd'hui un blocage sur la semaine passée change donc un
 * taux **déjà lu**, et il ne dira pas qu'il a changé. *Le travail est de le
 * DIRE là où la saisie se fait* — la forme de D76, appliquée non plus à une
 * valeur mais à sa fraîcheur.
 */
export default async function PageAbsences({
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

  const parametres = await searchParams;
  const motif = parametres.motif;
  const rendues = identifiants(lu(parametres.rendues));
  const rompues = identifiants(lu(parametres.rompues));

  const vue = await avecContexteApplicatif(session.contexte, async (tx) => {
    // L'HEURE SE LIT AVEC UN FUSEAU, jamais nue (L0-08) : sous UTC+11 le jour
    // se décale d'un cran, et la fenêtre affichée s'ouvrirait la veille.
    const societe = await tx.societe.findFirst({
      select: { fuseau_horaire: true },
    });
    const fenetre = fenetreAffichee(societe?.fuseau_horaire ?? FUSEAU_DE_REPLI);
    const lecture = await lireLesAbsences(tx, fenetre);
    return {
      ...lecture,
      interventionsRendues: await nommerLesInterventions(tx, rendues),
      agencesRompues: await nommerLesAgences(tx, rompues),
    };
  });

  return (
    <Page
      chemin="/absences"
      titre={t("absences.titre")}
      sousTitre={t("absences.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {vue.interventionsRendues.length > 0 ? (
        <section
          role="status"
          className="border-app-bord bg-app-surface flex flex-col gap-1.5 rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          <p className="font-bold">{t("absences.rendues_titre")}</p>
          <p>{listeDesInterventions(vue.interventionsRendues)}</p>
        </section>
      ) : null}

      {vue.agencesRompues.length > 0 ? (
        <section
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex flex-col gap-1.5 rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          <p className="font-bold">{t("absences.rupture_titre")}</p>
          <p>{listeDesAgences(vue.agencesRompues)}</p>
          <p>{t("absences.rupture_explication")}</p>
        </section>
      ) : null}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("absences.declarer")}</h2>
        <form
          action="/api/absences/declarer"
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="absence-personne"
              className="text-app-encre-faible text-[11px]"
            >
              {t("absences.personne")}
            </label>
            <select
              id="absence-personne"
              name="utilisateur_id"
              className="border-app-bord bg-app-surface min-w-52 rounded-md border px-2 py-1 text-[12.5px]"
            >
              {vue.declarables.map((personne) => (
                <option
                  key={personne.utilisateurId}
                  value={personne.utilisateurId}
                >
                  {quiTravaille(personne.utilisateurId, vue.annuaire)}
                </option>
              ))}
            </select>
          </div>
          <ChampJour id="absence-du" nom="du" libelle={t("absences.du")} />
          <ChampJour id="absence-au" nom="au" libelle={t("absences.au")} />
          <Button type="submit" variant="outline" size="sm">
            {t("absences.declarer_action")}
          </Button>
        </form>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("absences.immediat")}
        </p>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("absences.retroactif")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={COLONNES()} minimum="760px">
          {vue.absences.length === 0 ? (
            <LignePleine colonnes={3}>{t("absences.aucune")}</LignePleine>
          ) : null}
          {vue.absences.map((absence) => (
            <tr key={absence.id}>
              <Cellule fort>
                {quiTravaille(absence.utilisateur_id, vue.annuaire)}
              </Cellule>
              <Cellule>{periode(absence.du, absence.au)}</Cellule>
              <Cellule>
                <FormulaireLevee absenceId={absence.id} />
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("absences.levee_explication")}
      </p>
    </Page>
  );
}

function COLONNES() {
  return [
    { cle: "personne", libelle: t("absences.personne"), largeur: "220px" },
    { cle: "periode", libelle: t("absences.periode") },
    { cle: "levee", libelle: t("absences.levee"), largeur: "160px" },
  ];
}

/**
 * LEVER UN BLOCAGE — la seule action possible sur une ligne existante.
 *
 * *Il n'y a rien à « trancher »* : la ligne bloque dès qu'elle existe. Ce
 * formulaire la supprime, et ce qu'il ne fait pas est dit à côté du tableau —
 * lever ne rend pas leurs créneaux aux interventions déjà rendues à la file.
 */
function FormulaireLevee({ absenceId }: { readonly absenceId: string }) {
  return (
    <form action="/api/absences/lever" method="post">
      <input type="hidden" name="absence_id" value={absenceId} />
      <Button type="submit" variant="outline" size="sm">
        {t("absences.lever")}
      </Button>
    </form>
  );
}

function ChampJour({
  id,
  nom,
  libelle,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="date"
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px]"
      />
    </div>
  );
}

/**
 * LA FENÊTRE AFFICHÉE — le passé proche et le trimestre qui vient.
 *
 * Ce ne sont pas des durées métier : aucune règle ne dit qu'une absence se
 * regarde sur 90 jours. C'est la borne d'un écran, et elle est nommée pour ne
 * pas se lire comme un délai du §8.
 */
const JOURS_DE_PASSE = 30;
const JOURS_A_VENIR = 90;
const MS_PAR_JOUR = 86_400_000;

/**
 * Le fuseau quand la société n'en déclare pas.
 *
 * *« Inconnu » n'est pas « Nouméa »* : écrire ici le fuseau calédonien ferait
 * du territoire d'un client le défaut du produit. UTC ne décale rien et ne
 * prétend rien.
 */
const FUSEAU_DE_REPLI = "UTC";

function fenetreAffichee(fuseau: string): { du: Date; au: Date } {
  const instant = maintenant(fuseau).instant.getTime();
  return {
    du: new Date(instant - JOURS_DE_PASSE * MS_PAR_JOUR),
    au: new Date(instant + JOURS_A_VENIR * MS_PAR_JOUR),
  };
}

/** Un paramètre d'URL, en chaîne — une liste répétée n'en est pas une. */
function lu(valeur: string | string[] | undefined): string | undefined {
  return typeof valeur === "string" ? valeur : undefined;
}

/**
 * Les compositions sont faites HORS du JSX — un littéral n'y est pas admis,
 * fût-il le séparateur d'une liste (L0-11).
 */
const SEPARATEUR = ", ";
const TIRET = " → ";
const BARRE = "/";

/**
 * Une journée civile, écrite à la main plutôt que par la locale.
 *
 * **`toLocaleDateString` lit le fuseau de l'APPAREIL** et le gardien de L0-08 le
 * refuse, à raison : sous UTC+11 la même journée se rendrait la veille sur une
 * machine restée à Paris. `du` et `au` sont des colonnes `date` — des journées
 * civiles, sans heure et sans fuseau —, et les lire en UTC est la seule façon de
 * les rendre telles qu'elles ont été écrites.
 */
function jourEcrit(journee: Date): string {
  const jour = String(journee.getUTCDate()).padStart(2, "0");
  const mois = String(journee.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}${BARRE}${mois}${BARRE}${journee.getUTCFullYear()}`;
}

function periode(du: Date, au: Date): string {
  return `${jourEcrit(du)}${TIRET}${jourEcrit(au)}`;
}

function listeDesInterventions(
  interventions: readonly {
    readonly id: string;
    readonly numero: number | null;
  }[],
): string {
  // *Tant que le numéro est nul, l'interface affiche `Local-<6 caractères>`*
  // (I10). La forme est celle du planning, LUE et non recopiée : deux écrans
  // qui nomment la même intervention de deux façons obligent à deviner qu'il
  // s'agit de la même (§9, 01/09).
  return interventions.map(referenceAffichee).join(SEPARATEUR);
}

function listeDesAgences(
  agences: readonly { readonly id: string; readonly libelle: string }[],
): string {
  return agences.map((a) => a.libelle).join(SEPARATEUR);
}
