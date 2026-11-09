import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Carte } from "@/components/ui/carte";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { OngletsRegistre } from "@/components/interventions/onglets-registre";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { compterParVue } from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import {
  accordAttenduEnRetard,
  devisEnRetard,
} from "@/lib/suite-a-donner/depot";
import {
  suitesADonnerDuRegistre,
  type InterventionAQualifier,
  type LigneSuiteADonner,
} from "@/lib/suite-a-donner/lecture";
import { CLASSES_TON } from "@/lib/theme/statuts";

import { hrefOnglet, referenceAffichee } from "../presentation";

export const metadata: Metadata = { title: t("suites_a_donner.titre") };

/**
 * L'ONGLET « SUITES À DONNER » (9J18-SUITE-A-DONNER-ECRAN, FLX-10).
 *
 * **Un EMPLACEMENT, jamais une vue de `criteresVue`** — même famille que
 * « À facturer » (`../a-facturer/page.tsx`) : ce que cette page montre
 * n'est pas une `Intervention` filtrée, c'est une lecture composée par
 * `suitesADonnerDuRegistre` (`lib/suite-a-donner/lecture.ts`), sur DEUX
 * tables, jamais une seconde politique RLS écrite ici — la forme
 * « filiation » posée par 9J17 décide déjà (I1).
 *
 * **La LECTURE est ouverte à qui voit déjà le registre** (`consulter_planning`,
 * complet, même porte que `/interventions`) ; **qualifier et replanifier
 * restent gardés par `modifier_planning`** — à l'intérieur de cette page et
 * de ses routes, jamais par un onglet absent (même principe que les boutons
 * « Poser »/« Déplacer… » du registre lui-même).
 */
export default async function PageSuitesADonner({
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
  const contexte = session.contexte;

  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "consulter_planning")
  ) {
    return (
      <Page chemin="/interventions" titre={t("suites_a_donner.titre")}>
        <RefusAcces />
      </Page>
    );
  }
  const peutEcrire = peutPleinement(contexte.role, "modifier_planning");

  const params = await searchParams;
  const motif = params.motif;

  // Les relances FLX-2/FLX-3 : des LECTURES calculées À LA VISITE de cet
  // écran, jamais une tâche planifiée (docblock de `lib/suite-a-donner/depot.ts`).
  // Idempotentes — ouvrir dix fois ce registre ne pose qu'une notification
  // par dossier en retard.
  await Promise.all([devisEnRetard(contexte), accordAttenduEnRetard(contexte)]);

  const [{ aQualifier, suites }, comptesVue] = await Promise.all([
    suitesADonnerDuRegistre(contexte),
    compterParVue(contexte, schemaRechercheInterventions.parse({})),
  ]);

  const colonnes = [
    { cle: "intervention", libelle: t("suites_a_donner.colonne.intervention") },
    { cle: "motif", libelle: t("suites_a_donner.colonne.motif") },
    { cle: "statut", libelle: t("suites_a_donner.colonne.statut") },
    { cle: "reprise", libelle: t("suites_a_donner.colonne.reprise") },
    { cle: "action", libelle: t("suites_a_donner.colonne.action") },
  ];
  const total = aQualifier.length + suites.length;

  return (
    <Page chemin="/interventions" titre={t("suites_a_donner.titre")}>
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className={`rounded-md border px-3.5 py-2.5 text-13 font-bold ${
            motif.includes(".refus.") ? CLASSES_TON.refus : CLASSES_TON.succes
          }`}
        >
          {t(motif)}
        </p>
      ) : null}
      <OngletsRegistre
        vueActive="suites_a_donner"
        comptes={comptesVue}
        peutFacturer={false}
        hrefOnglet={(vue) => hrefOnglet({}, vue)}
        hrefAFacturer="/interventions/a-facturer"
        hrefSuitesADonner="/interventions/suites-a-donner"
        compteSuitesADonner={total}
      />
      <p className="text-app-encre-faible text-13 font-bold">
        {t("suites_a_donner.sous_titre")}
      </p>
      <Carte>
        <Tableau
          colonnes={colonnes}
          minimum="760px"
          libelle={t("suites_a_donner.titre")}
        >
          {total === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("suites_a_donner.vide")}
            </LignePleine>
          ) : null}
          {aQualifier.map((intervention) => (
            <LigneAQualifier
              key={intervention.id}
              intervention={intervention}
              peutEcrire={peutEcrire}
            />
          ))}
          {suites.map((suite) => (
            <LigneSuite key={suite.id} suite={suite} peutEcrire={peutEcrire} />
          ))}
        </Tableau>
      </Carte>
    </Page>
  );
}

function LigneAQualifier({
  intervention,
  peutEcrire,
}: Readonly<{
  intervention: InterventionAQualifier;
  peutEcrire: boolean;
}>) {
  return (
    <tr>
      <Cellule>
        <Link
          href={`/interventions/${intervention.id}`}
          className="text-app-marque font-bold underline"
        >
          {referenceAffichee(intervention)}
        </Link>
        <div className="text-app-encre-faible text-12 font-bold">
          {intervention.client.raison_sociale}
          {t("ponctuation.point_median")}
          {intervention.site.libelle}
        </div>
      </Cellule>
      <Cellule>{intervention.suite_a_donner}</Cellule>
      <Cellule>
        <span className="border-app-bord text-app-encre-faible rounded-full border px-1.5 text-12 font-bold">
          {t("suites_a_donner.statut.a_qualifier")}
        </span>
      </Cellule>
      <Cellule>{t("suites_a_donner.aucune_reprise")}</Cellule>
      <Cellule>
        {peutEcrire ? (
          <form
            method="POST"
            action="/api/interventions/suites-a-donner/qualifier"
          >
            <input
              type="hidden"
              name="intervention_id"
              value={intervention.id}
            />
            <button
              type="submit"
              className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-2.5 py-1 text-12 font-bold"
            >
              {t("suites_a_donner.action.qualifier")}
            </button>
          </form>
        ) : null}
      </Cellule>
    </tr>
  );
}

function LigneSuite({
  suite,
  peutEcrire,
}: Readonly<{ suite: LigneSuiteADonner; peutEcrire: boolean }>) {
  const origine = suite.intervention_origine;
  return (
    <tr>
      <Cellule>
        <Link
          href={`/interventions/${origine.id}`}
          className="text-app-marque font-bold underline"
        >
          {referenceAffichee(origine)}
        </Link>
        <div className="text-app-encre-faible text-12 font-bold">
          {origine.client.raison_sociale}
          {t("ponctuation.point_median")}
          {origine.site.libelle}
        </div>
      </Cellule>
      <Cellule>
        {suite.statut === "sans_suite"
          ? suite.motif_sans_suite
          : origine.suite_a_donner}
      </Cellule>
      <Cellule>
        <span className="border-app-bord text-app-encre-faible rounded-full border px-1.5 text-12 font-bold">
          {t(`suites_a_donner.statut.${suite.statut}`)}
        </span>
      </Cellule>
      <Cellule>
        {suite.intervention_reprise === null ? (
          t("suites_a_donner.aucune_reprise")
        ) : (
          <Link
            href={`/interventions/${suite.intervention_reprise.id}`}
            className="text-app-marque font-bold underline"
          >
            {referenceAffichee(suite.intervention_reprise)}
          </Link>
        )}
      </Cellule>
      <Cellule>{peutEcrire ? <ActionSuite suite={suite} /> : null}</Cellule>
    </tr>
  );
}

/**
 * LE GESTE SUIVANT, SELON LE STATUT (9K05-SUITES-A-DONNER-DEBLOQUEES) — un
 * dossier `a_replanifier` DÉJÀ lié à sa reprise n'a plus de geste (il ne
 * reste que le lien vers elle, déjà montré par la colonne « Reprise »).
 */
function ActionSuite({
  suite,
}: Readonly<{ suite: LigneSuiteADonner }>): React.ReactNode {
  switch (suite.statut) {
    case "qualifiee":
      return (
        <form
          method="POST"
          action={`/api/interventions/suites-a-donner/${suite.id}/devis-envoye`}
        >
          <button
            type="submit"
            className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-2.5 py-1 text-12 font-bold"
          >
            {t("suites_a_donner.action.devis_envoye")}
          </button>
        </form>
      );
    case "accord_attendu":
      return (
        <Link
          href={`/interventions/suites-a-donner/${suite.id}/accord`}
          className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-2.5 py-1 text-12 font-bold"
        >
          {t("suites_a_donner.action.accord")}
        </Link>
      );
    case "accord_recu":
      return (
        <form
          method="POST"
          action={`/api/interventions/suites-a-donner/${suite.id}/piece-recue`}
        >
          <button
            type="submit"
            className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-2.5 py-1 text-12 font-bold"
          >
            {t("suites_a_donner.action.piece_recue")}
          </button>
        </form>
      );
    case "a_replanifier":
      return suite.intervention_reprise === null ? (
        <Link
          href={`/interventions/suites-a-donner/${suite.id}/replanifier`}
          className="border-app-bord text-app-encre-faible hover:bg-app-fond rounded-md border px-2.5 py-1 text-12 font-bold"
        >
          {t("suites_a_donner.action.replanifier")}
        </Link>
      ) : null;
    default:
      return null;
  }
}
