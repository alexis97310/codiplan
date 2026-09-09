import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
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

/**
 * L'ÉCRAN DE RÉGLAGE DES HORAIRES (lot 2, I7).
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("parametres.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("parametres.sous_titre")}
        </p>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-destructive text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {t(motif)}
        </p>
      ) : null}

      {reglages.map(({ agence, parametrage, exceptions }) => (
        <section
          key={agence.id}
          className="border-border flex flex-col gap-4 rounded-lg border px-4 py-4"
        >
          <h2 className="text-lg font-medium">{titreAgence(agence.libelle)}</h2>

          {parametrage === null ? (
            <p className="text-destructive text-sm">
              {t("parametres.sans_calendrier")}
            </p>
          ) : (
            <Reglage parametrage={parametrage} exceptions={exceptions} />
          )}
        </section>
      ))}
    </main>
  );
}

/**
 * Le titre d'un établissement, composé hors du JSX.
 *
 * Le code nomme la NOTION — `mot("agence")` — et jamais le mot (D5, D47,
 * L0-11) ; la composition sort du JSX parce qu'un littéral n'y est pas admis.
 */
function titreAgence(libelle: string): string {
  return `${mot("agence")} ${libelle}`;
}

function Reglage({
  parametrage,
  exceptions,
}: {
  parametrage: Parametrage;
  exceptions: number;
}) {
  const jours = joursTravailles(parametrage);
  const premierJour = jours[0];
  const exemple =
    premierJour === undefined ? [] : creneauxDuJour(parametrage, premierJour);

  return (
    <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Ligne
          libelle={t("parametres.calendrier")}
          valeur={parametrage.libelle}
        />
        <Ligne
          libelle={t("parametres.jours")}
          valeur={jours.map((j) => libelleJour(j)).join(", ")}
        />
        <Ligne
          libelle={t("parametres.horaires")}
          valeur={parametrage.plages
            .filter((p) => p.jourSemaine === premierJour)
            .map((p) => `${enHeure(p.debutMinutes)}–${enHeure(p.finMinutes)}`)
            .join(", ")}
        />
        <Ligne
          libelle={t("parametres.creneaux_exemple")}
          valeur={resumeCreneaux(exemple)}
        />
      </dl>

      <form
        action="/api/parametres/pas-creneau"
        method="post"
        className="flex flex-wrap items-end gap-3"
      >
        <input
          type="hidden"
          name="calendrier_id"
          value={parametrage.calendrierId}
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("parametres.pas")}
          <input
            name="pas"
            type="number"
            min={PAS_MINIMUM}
            max={PAS_MAXIMUM}
            defaultValue={parametrage.pasCreneauMinutes}
            className="border-input bg-background w-32 rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <Button type="submit" variant="outline">
          {t("parametres.pas_enregistrer")}
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">
          {t("parametres.exception_technicien")}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t("parametres.exception_explication")}
        </p>
        <p className="text-sm">
          {exceptions === 0
            ? t("parametres.exception_aucune")
            : String(exceptions)}
        </p>
      </div>
    </>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

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
