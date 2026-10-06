import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { EtatVide } from "@/components/ui/etat-vide";
import { RefusAcces } from "@/components/ui/refus-acces";
import { OngletsRegistre } from "@/components/interventions/onglets-registre";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { compterParVue } from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

import { hrefOnglet } from "../presentation";

export const metadata: Metadata = {
  title: t("interventions.a_facturer.titre"),
};

/**
 * L'EMPLACEMENT « À FACTURER » (TP-UX3-1-REGISTRE-1, QE-8 ; §5.3 de la
 * spécification du 28/09/2026) — un ONGLET de plus dans la rangée du
 * registre, jamais une vue de `criteresVue` (`lib/interventions/depot.ts`) :
 * il n'y a RIEN à lister ici aujourd'hui.
 *
 * ## Ce que cette page n'est pas
 *
 * **Elle ne lit AUCUNE intervention.** La liste de ce qui est à facturer,
 * ses décomptes et son export arrivent avec FACTURE-1 (QT-19, après TP-ARG) —
 * `statut_facturation` existe déjà en base (posée par déclencheur), mais
 * aucune lecture de cette colonne n'a de sens avant que FACTURE-1 décide des
 * règles de préparation. Inventer une liste ou un compte ici serait une
 * valeur devinée (§8 du CLAUDE.md).
 *
 * ## Le même garde-fou que le registre lui-même
 *
 * `preparer_facturation` — direction, responsable matériel, ADV — comme
 * `preparer_facturation` dans `lib/auth/habilitations.ts`. `admin_societe`
 * et `responsable_sav` n'y ont pas accès, exactement comme ils ne voient pas
 * cet onglet dans la rangée (`peutFacturer` de `OngletsRegistre`).
 */
export default async function PageInterventionsAFacturer() {
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
    !peutPleinement(contexte.role, "consulter_planning") ||
    !peut(contexte.role, "preparer_facturation")
  ) {
    return (
      <Page chemin="/interventions" titre={t("interventions.a_facturer.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  // LES COMPTEURS DES AUTRES ONGLETS (TP-UX3-1-REGISTRE-1) — la MÊME rangée
  // qu'`/interventions`, sur la recherche VIDE : cette page ne filtre rien,
  // elle n'a donc rien d'autre à passer à `compterParVue`.
  const comptesVue = await compterParVue(
    contexte,
    schemaRechercheInterventions.parse({}),
  );

  return (
    <Page chemin="/interventions" titre={t("interventions.a_facturer.titre")}>
      <OngletsRegistre
        vueActive="a_facturer"
        comptes={comptesVue}
        peutFacturer
        hrefOnglet={(vue) => hrefOnglet({}, vue)}
        hrefAFacturer="/interventions/a-facturer"
      />
      <EtatVide>{t("interventions.a_facturer.vide")}</EtatVide>
    </Page>
  );
}
