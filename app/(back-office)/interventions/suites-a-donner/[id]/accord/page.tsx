import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Carte } from "@/components/ui/carte";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("suites_a_donner.accord.titre") };

/**
 * STATUER SUR L'ACCORD ATTENDU (9K05-SUITES-A-DONNER-DEBLOQUEES).
 *
 * Deux formulaires, une seule route (`.../[id]/accord/route.ts`), discriminés
 * par le champ caché `reponse` — même union que `ReponseAccord`
 * (`lib/suite-a-donner/depot.ts`). Un dossier qui n'est plus `accord_attendu`
 * (réponse déjà enregistrée par un autre onglet, par exemple) retourne au
 * registre avec un refus honnête, jamais une page vide.
 */
export default async function PageAccord({
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
      <Page chemin="/interventions" titre={t("suites_a_donner.accord.titre")}>
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
        intervention_origine: {
          select: {
            annee: true,
            numero: true,
            suite_a_donner: true,
            client: { select: { raison_sociale: true } },
            site: { select: { libelle: true } },
          },
        },
      },
    }),
  );
  if (suite === null) {
    notFound();
  }
  if (suite.statut !== "accord_attendu") {
    redirect(
      `/interventions/suites-a-donner?motif=${encodeURIComponent("suites_a_donner.refus.pas_accord_attendu")}`,
    );
  }
  const origine = suite.intervention_origine;

  return (
    <Page
      chemin="/interventions"
      titre={t("suites_a_donner.accord.titre")}
      sousTitre={origine.suite_a_donner ?? undefined}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <Carte titre={t("suites_a_donner.accord.recu_titre")}>
        <form
          method="POST"
          action={`/api/interventions/suites-a-donner/${id}/accord`}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="reponse" value="accord_recu" />
          <p className="text-app-encre-faible text-13 font-bold">
            {t("suites_a_donner.accord.recu_aide")}
          </p>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.accord.piece_ref")}
            <input
              type="text"
              name="piece_attendue_ref"
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.accord.piece_date")}
            <input
              type="date"
              name="date_dispo_prevue"
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 self-start rounded-md px-3 py-1.5 text-13 font-bold"
          >
            {t("suites_a_donner.accord.recu_confirmer")}
          </button>
        </form>
      </Carte>

      <Carte titre={t("suites_a_donner.accord.sans_suite_titre")}>
        <form
          method="POST"
          action={`/api/interventions/suites-a-donner/${id}/accord`}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="reponse" value="sans_suite" />
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("suites_a_donner.accord.motif")}
            <textarea
              name="motif_sans_suite"
              required
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <button
            type="submit"
            className="border-app-bord text-app-encre-faible hover:bg-app-fond self-start rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("suites_a_donner.accord.sans_suite_confirmer")}
          </button>
        </form>
      </Carte>

      <Link
        href="/interventions/suites-a-donner"
        className="text-app-marque text-13 font-bold underline"
      >
        {t("suites_a_donner.replanifier.retour")}
      </Link>
    </Page>
  );
}
