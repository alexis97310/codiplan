import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireMachine } from "@/components/parc/formulaire-machine";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("machine.nouvelle.titre") };

/**
 * CRÉER UNE FICHE MACHINE (AT-07 bis — R6-03, blocage n°1 du domaine).
 *
 * *Le parc ne se remplissait que par le semis et l'import* — aucune route
 * n'appelait `creerMachineDans` depuis un écran. `FormulaireMachine` porte la
 * saisie et la règle D-06 ; cette page ne porte plus rien de plus que le
 * mode, l'action et les valeurs par défaut du formulaire.
 *
 * ## LES TROIS SÉLECTEURS CHERCHENT SUR LE SERVEUR (SELECTEURS-1, 24/09/2026)
 *
 * Cette page chargeait AVANT ce lot le référentiel ENTIER des modèles, des
 * clients et des sites — les deux derniers par `tousLesResultats`, qui
 * enchaînait les pages de `rechercherClients`/`rechercherSites` jusqu'à
 * épuisement (lot SELECT-1, 21/09/2026, lui-même réparant un plafond de 200
 * fiches qui rendait 376 clients sur 576 hors de portée de cet écran). *Juste
 * mais lourd* : le premier rendu attendait trois lectures complètes du
 * référentiel avant d'afficher trois `<select>` de plusieurs centaines de
 * lignes, impossibles à parcourir à l'œil au-delà de quelques centaines.
 *
 * `FormulaireMachine` cherche maintenant client, site et modèle par
 * `SelecteurRecherche` (`components/ui/selecteur-recherche.tsx`), qui
 * interroge `/api/recherche/*` — 20 résultats à la fois, cloisonnés comme
 * toute lecture. Cette page n'a donc plus aucun référentiel à lire d'avance.
 */
export default async function PageNouvelleMachine({
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
  const motifInitial: CleTraduction | undefined =
    typeof motif === "string" && estCleTraduction(motif) ? motif : undefined;

  return (
    <Page
      chemin="/parc"
      titre={t("machine.nouvelle.titre")}
      sousTitre={t("machine.nouvelle.sous_titre")}
      actions={
        <Link href="/parc" className="text-app-encre-faible text-[12.5px]">
          {t("machine.nouvelle.retour")}
        </Link>
      }
    >
      <FormulaireMachine
        mode="creation"
        action="/api/machines/creer"
        motifSucces="machine.creee"
        motifInitial={motifInitial}
        valeurs={{
          numeroSerie: "",
          referenceInterne: "",
          localisation: "",
          factureOrigine: "",
          dateMiseEnService: "",
          dateVente: "",
          garantieFin: "",
          criticite: "normale",
        }}
      />
    </Page>
  );
}
