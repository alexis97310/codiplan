import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

import { referenceAffichee } from "../planning/presentation";

import { identifiants } from "../../api/absences/actions";

/**
 * L'ÉCRAN DES ABSENCES (R3-14, RG-PLA-06).
 *
 * ## Pourquoi il existe
 *
 * `occupationTechnicien` retranche les absences **validées** du dénominateur du
 * taux d'occupation, précisément pour distinguer *« il était absent »* de *« il
 * n'a rien fait »*. **Aucune absence ne pouvant être déclarée, cette branche
 * n'était jamais prise** : les taux affichés étaient justes *pour un monde où
 * personne n'est jamais absent*, et ils ne disaient pas qu'ils l'étaient.
 *
 * ## Il ne propose AUCUN créneau
 *
 * *Un moteur qui propose sur un effectif d'un ne propose rien* (D106). Ce que
 * cet écran rend, ce sont les interventions **rendues à la file** et les agences
 * où le service est **rompu** — nommées, jamais comptées : *« 3 interventions
 * déplanifiées » ne dit pas lesquelles*, et c'est exactement ce que le
 * planificateur doit voir pour les reposer.
 *
 * ## Il n'affiche AUCUNE NATURE, et il ne peut pas en afficher
 *
 * Décision **provisoire** de R3-14, en attente de ratification : une absence dit
 * *quand*, et rien d'autre. `arret` est un arrêt de travail — *une donnée de
 * santé, sur un salarié nommé* —, et le dénominateur n'en a aucun besoin. La
 * lecture ne rend plus la colonne, la saisie ne l'accepte plus, et un
 * déclencheur refuse qu'un autre chemin l'écrive.
 *
 * ## Ce qu'il DIT et qu'il ne peut pas empêcher
 *
 * Rien n'est matérialisé : le taux d'occupation relit les absences à chaque
 * rendu. Déclarer aujourd'hui une absence sur la semaine passée change donc un
 * taux **déjà lu**, et il ne dira pas qu'il a changé. *Le travail est de le
 * DIRE là où la déclaration se fait* — la forme de D76, appliquée non plus à une
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
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("absences.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("absences.sous_titre")}
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
          {t("absences.sans_nature")}
        </p>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("absences.retroactif")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={COLONNES()} minimum="760px">
          {vue.absences.length === 0 ? (
            <LignePleine colonnes={4}>{t("absences.aucune")}</LignePleine>
          ) : null}
          {vue.absences.map((absence) => (
            <tr key={absence.id}>
              <Cellule fort>
                {quiTravaille(absence.utilisateur_id, vue.annuaire)}
              </Cellule>
              <Cellule>{periode(absence.du, absence.au)}</Cellule>
              <Cellule>{libelleStatut(absence.statut)}</Cellule>
              <Cellule>
                {absence.statut === "demandee" ? (
                  <div className="flex flex-wrap gap-2">
                    <FormulaireDecision
                      absenceId={absence.id}
                      decision={VALIDEE}
                      libelle={t("absences.valider")}
                    />
                    <FormulaireDecision
                      absenceId={absence.id}
                      decision={REFUSEE}
                      libelle={t("absences.refuser")}
                    />
                  </div>
                ) : (
                  t("absences.tranchee")
                )}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("absences.qui_decide")}
      </p>
    </main>
  );
}

const VALIDEE = "validee";
const REFUSEE = "refusee";

function COLONNES() {
  return [
    { cle: "personne", libelle: t("absences.personne"), largeur: "220px" },
    { cle: "periode", libelle: t("absences.periode") },
    { cle: "statut", libelle: t("absences.statut") },
    { cle: "decision", libelle: t("absences.decision"), largeur: "220px" },
  ];
}

function FormulaireDecision({
  absenceId,
  decision,
  libelle,
}: {
  readonly absenceId: string;
  readonly decision: string;
  readonly libelle: string;
}) {
  return (
    <form action="/api/absences/decider" method="post">
      <input type="hidden" name="absence_id" value={absenceId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant="outline" size="sm">
        {libelle}
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

/** Le libellé d'un statut d'absence — au dictionnaire, jamais écrit ici. */
function libelleStatut(statut: string): string {
  const cle = `absences.statut.${statut}`;
  return estCleTraduction(cle) ? t(cle) : statut;
}
