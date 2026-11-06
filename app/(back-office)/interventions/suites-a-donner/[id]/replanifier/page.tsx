import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Carte } from "@/components/ui/carte";
import { RefusAcces } from "@/components/ui/refus-acces";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { type ContexteSession } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { absenceCouvrant, type AbsenceDeclaree } from "@/lib/absences/periode";
import {
  chargerCalendrierAgence,
  fuseauDeLAgence,
} from "@/lib/calendar/agence";
import {
  instantDuJour,
  lireCleJour,
  maintenant,
  versLocal,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  creneauxDisponibles,
  type OccupationDuJour,
} from "@/lib/interventions/creneaux";

import { optionsFiltreTechnicien } from "../../../presentation";

export const metadata: Metadata = {
  title: t("suites_a_donner.replanifier.titre"),
};

/** `08:30` — le libellé local d'un instant, dans le fuseau de l'agence. */
function heureLocale(
  instant: Date,
  fuseau: ReturnType<typeof fuseauDeLAgence>,
): string {
  const local = versLocal(instant, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

/** Les minutes locales depuis minuit — la valeur que le formulaire soumet (R2-19). */
function minutesLocales(
  instant: Date,
  fuseau: ReturnType<typeof fuseauDeLAgence>,
): number {
  const local = versLocal(instant, fuseau);
  return local.heures * 60 + local.minutes;
}

/**
 * LE DÉPLACEMENT DE L'INTERVENTION DE REPRISE (9J18-SUITE-A-DONNER-ECRAN,
 * FLX-6/7).
 *
 * **Réutilise `lib/interventions/creneaux.ts` SANS modification** — les
 * mêmes paramètres que construit `app/api/interventions/[id]/verdict-pose/
 * route.ts`, hormis l'exclusion `NOT: { id: ligne.id }` sur les occupations
 * du technicien : l'intervention n'existe pas encore, rien ne doit s'en
 * exclure.
 *
 * **Le technicien par défaut est celui de l'intervention d'origine**
 * (FLX-6) : `?technicien=` absent retombe sur lui. S'il est absent ce
 * jour-là, un AVERTISSEMENT le dit — l'écran ne bascule JAMAIS seul sur un
 * autre technicien (un geste qui choisit à la place de l'humain serait une
 * dérogation déguisée).
 */
export default async function PageReplanifier({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "modifier_planning")
  ) {
    return (
      <Page
        chemin="/interventions"
        titre={t("suites_a_donner.replanifier.titre")}
      >
        <RefusAcces />
      </Page>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const motif = sp.motif;

  const suite = await avecContexteApplicatif(contexte, (tx) =>
    tx.suiteADonner.findFirst({
      where: { id },
      select: {
        id: true,
        statut: true,
        intervention_reprise_id: true,
        intervention_origine: {
          select: {
            id: true,
            annee: true,
            numero: true,
            agence_id: true,
            technicien_id: true,
            duree_estimee_min: true,
            agence: {
              select: {
                fuseau_horaire: true,
                societe: { select: { fuseau_horaire: true } },
                calendrier: { select: { pas_creneau_minutes: true } },
              },
            },
          },
        },
      },
    }),
  );
  if (suite === null) {
    notFound();
  }
  if (
    suite.statut !== "a_replanifier" ||
    suite.intervention_reprise_id !== null
  ) {
    redirect(
      `/interventions/suites-a-donner?motif=${encodeURIComponent("suites_a_donner.refus.statut_invalide")}`,
    );
  }
  const origine = suite.intervention_origine;
  const fuseau = fuseauDeLAgence(origine.agence);
  const pasMinutes = origine.agence.calendrier?.pas_creneau_minutes ?? 0;

  const technicienId =
    typeof sp.technicien === "string" && sp.technicien.length > 0
      ? sp.technicien
      : (origine.technicien_id ?? "");
  const date = typeof sp.date === "string" ? sp.date : "";
  const dureeBrute = typeof sp.duree === "string" ? sp.duree : "";
  const duree =
    dureeBrute.length > 0
      ? Number(dureeBrute)
      : (origine.duree_estimee_min ?? null);

  const [{ techniciens }, resultatCreneaux] = await Promise.all([
    avecContexteApplicatif(contexte, async (tx) => ({
      techniciens: await tx.technicien.findMany({
        where: { actif: true },
        select: { utilisateur_id: true },
        orderBy: { utilisateur_id: "asc" },
      }),
    })),
    calculerCreneaux(contexte, {
      agenceId: origine.agence_id,
      technicienId,
      date,
      duree,
      pasMinutes,
      fuseau,
    }),
  ]);
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(
      tx,
      techniciens.map((t) => t.utilisateur_id),
    ),
  );
  const optionsTechniciens = optionsFiltreTechnicien(techniciens, annuaire);

  return (
    <Page
      chemin="/interventions"
      titre={t("suites_a_donner.replanifier.titre")}
      sousTitre={t("suites_a_donner.replanifier.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}
      <Carte>
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.replanifier.technicien")}
            <select
              name="technicien"
              defaultValue={technicienId}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            >
              {optionsTechniciens.map((option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.replanifier.date")}
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.replanifier.duree")}
            <input
              type="number"
              name="duree"
              min={1}
              defaultValue={duree ?? undefined}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <button
            type="submit"
            className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("suites_a_donner.replanifier.voir_creneaux")}
          </button>
        </form>
      </Carte>

      {resultatCreneaux.absent ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t("suites_a_donner.replanifier.technicien_absent")}
        </p>
      ) : null}

      {date.length > 0 && technicienId.length > 0 && duree !== null ? (
        <Carte titre={t("suites_a_donner.replanifier.creneaux_titre")}>
          {resultatCreneaux.creneaux.length === 0 ? (
            <p className="text-app-encre-faible text-13 font-bold">
              {t("suites_a_donner.replanifier.aucun_creneau")}
            </p>
          ) : (
            <form
              method="POST"
              action={`/api/interventions/suites-a-donner/${id}/replanifier`}
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="technicien_id" value={technicienId} />
              <input type="hidden" name="date_planifiee" value={date} />
              <input type="hidden" name="duree_min" value={duree} />
              <fieldset className="flex flex-wrap gap-2">
                {resultatCreneaux.creneaux.map((creneau) => (
                  <label
                    key={creneau.minutes}
                    className="border-app-bord flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-13 font-bold"
                  >
                    <input
                      type="radio"
                      name="debut_minutes"
                      value={creneau.minutes}
                      required
                    />
                    {creneau.libelle}
                  </label>
                ))}
              </fieldset>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 self-start rounded-md px-3 py-1.5 text-13 font-bold"
              >
                {t("suites_a_donner.replanifier.confirmer")}
              </button>
            </form>
          )}
        </Carte>
      ) : null}

      <Link
        href="/interventions/suites-a-donner"
        className="text-app-marque text-13 font-bold underline"
      >
        {t("suites_a_donner.replanifier.retour")}
      </Link>
    </Page>
  );
}

async function calculerCreneaux(
  contexte: ContexteSession,
  parametres: {
    readonly agenceId: string;
    readonly technicienId: string;
    readonly date: string;
    readonly duree: number | null;
    readonly pasMinutes: number;
    readonly fuseau: ReturnType<typeof fuseauDeLAgence>;
  },
): Promise<{
  readonly creneaux: readonly {
    readonly minutes: number;
    readonly libelle: string;
  }[];
  readonly absent: boolean;
}> {
  const { agenceId, technicienId, date, duree, pasMinutes, fuseau } =
    parametres;
  if (technicienId.length === 0 || date.length === 0 || duree === null) {
    return { creneaux: [], absent: false };
  }
  return avecContexteApplicatif(contexte, async (tx) => {
    const jour: JourLocal = lireCleJour(date);
    const calendrier = await chargerCalendrierAgence(tx, {
      societeId: contexte.societeId ?? "",
      agenceId,
      fenetre: { du: jour, au: jour },
    });
    if (calendrier === null) {
      return { creneaux: [], absent: false };
    }
    const viseeInstant = instantDuJour(jour);
    const absences = await tx.absence.findMany({
      where: {
        utilisateur_id: technicienId,
        du: { lte: viseeInstant },
        au: { gte: viseeInstant },
      },
      select: { id: true, utilisateur_id: true, du: true, au: true },
    });
    const absent =
      absenceCouvrant(
        absences as readonly AbsenceDeclaree[],
        technicienId,
        viseeInstant,
      ) !== null;

    const bornes = { du: viseeInstant, au: instantDuJour(jour, 1) };
    const voisines = await tx.intervention.findMany({
      where: {
        technicien_id: technicienId,
        date_planifiee: { gte: bornes.du, lt: bornes.au },
        statut: { not: "annulee" },
      },
      select: { creneau_debut: true, creneau_fin: true },
    });
    const occupations: readonly OccupationDuJour[] = voisines
      .filter(
        (v): v is { creneau_debut: Date; creneau_fin: Date } =>
          v.creneau_debut !== null && v.creneau_fin !== null,
      )
      .map((v) => ({ debut: v.creneau_debut, fin: v.creneau_fin }));

    const { instant } = maintenant(calendrier.fuseau);
    const debuts = creneauxDisponibles({
      calendrier,
      jour,
      dureeMin: duree,
      pasMinutes,
      occupations,
      absent,
      maintenant: instant,
    });
    return {
      creneaux: debuts.map((debut) => ({
        minutes: minutesLocales(debut, fuseau),
        libelle: heureLocale(debut, fuseau),
      })),
      absent,
    };
  });
}
