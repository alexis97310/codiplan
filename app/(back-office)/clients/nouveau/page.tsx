import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BarreActionCollee } from "@/components/ui/action-primaire";
import { AideChamp } from "@/components/ui/aide-champ";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { SectionFormulaire } from "@/components/ui/section-formulaire";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  libelleCodeExterne,
  libelleCodeExterneDeLaSociete,
} from "@/lib/clients";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libelleChampFacultatif } from "@/lib/i18n/obligatoire";

import { elementEnsuiteSite, libelleCreerEtAjouterSite } from "../presentation";
import { BoutonCreer } from "../../interventions/nouvelle/bouton-creer";
import { AlerteHomonymes } from "./alerte-homonymes";

export const metadata: Metadata = { title: t("clients.nouveau.titre") };

/**
 * CRÉER UNE FICHE CLIENT, AU GABARIT DU 28/09 (9EK-TP-UX5-2-CREATIONS-1,
 * TP-UX5-2 ; D125, QE-13a).
 *
 * ## POURQUOI LA CRÉATION PART DE LA LISTE
 *
 * *« On ne peut pas créer un client depuis une machine qui n'existe pas
 * encore. »* — l'arbitrage du 14/09/2026. La fiche se rejoint neuf fois sur dix
 * en partant d'un parc ou d'un lieu qu'on regardait déjà ; la création, elle,
 * n'a aucun de ces points de départ, et c'est ce qui justifie la liste comme
 * porte à part entière.
 *
 * ## CE QUE CE FORMULAIRE NE DEMANDE PAS, ET CE N'EST PAS UN OUBLI
 *
 * **L'adresse de facturation.** Le chapitre 11 la nomme sans lui fixer de
 * forme, et `schemaCreationClient` la laisse en JSON libre pour cette raison —
 * *une adresse calédonienne (boîte postale, tribu, commune) n'a pas celle d'une
 * adresse métropolitaine.* L'aplatir en quatre champs ici la figerait pour
 * toutes les sociétés, depuis un écran. C'est le motif qui l'écarte déjà du
 * gabarit d'import (`lib/imports/modeles.ts`), et il n'a pas changé.
 *
 * **L'état.** Une fiche naît active — `schemaCreationClient` le pose par
 * défaut. *Créer une fiche inactive n'a pas d'usage*, et le geste existe sur la
 * fiche.
 *
 * ## LE REFUS REVIENT ICI, PAS AILLEURS
 *
 * *Un refus qui renvoie ailleurs fait perdre la saisie*, et c'est la façon la
 * plus sûre d'apprendre à ne plus faire confiance à l'écran. Le succès, lui,
 * mène à la FICHE créée — ou, si « Créer et ajouter un site » a été choisi
 * (`ensuite=site`), à `/sites/nouveau` avec ce client prérempli
 * (`app/api/clients/creer/route.ts`).
 *
 * ## L'ALERTE DE DOUBLON NE BLOQUE RIEN (CS40)
 *
 * `AlerteHomonymes` cherche, à la sortie du champ, une fiche dont la raison
 * sociale normalisée (RG-IMP-05, D29) est identique. Des homonymes réels
 * existent — deux garages du même nom — et la création reste possible :
 * l'alerte nomme la fiche existante, elle ne referme pas le formulaire.
 */
export default async function PageNouveauClient({
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

  // D153 (03/10/2026, TP-S3) — même capacité que la route qui reçoit ce
  // formulaire (`gerer_client_site`) ; remplace la garde QT-2 (D152) qui ne
  // fermait que le technicien, laissant RM et RS ouvrir un formulaire que la
  // route refusait déjà.
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "gerer_client_site")
  ) {
    return (
      <Page chemin="/clients" titre={t("clients.nouveau.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const params = await searchParams;
  const motif = params.motif;
  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);
  // LA SAISIE GARDÉE APRÈS UN REFUS (9BR-TP-A4b-MESSAGES, CS23) — ce que
  // `versLeFormulaire` (`app/api/clients/creer/formulaire.ts`) reporte dans
  // l'URL. Un paramètre absent retombe sur le champ vide, comme avant.
  const valeur = (nom: string): string =>
    typeof params[nom] === "string" ? params[nom] : "";

  return (
    <Page
      chemin="/clients"
      titre={t("clients.nouveau.titre")}
      sousTitre={t("clients.nouveau.sous_titre_creation")}
      actions={
        <Link
          href="/clients"
          className="text-app-encre-faible text-13 font-bold"
        >
          {t("clients.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1fr)_280px]">
        <form
          method="post"
          action="/api/clients/creer"
          className="flex flex-col gap-5 pb-20 min-[901px]:pb-0"
        >
          <SectionFormulaire titre={t("clients.fiche.identite")}>
            <AlerteHomonymes valeurInitiale={valeur("raison_sociale")} />

            <label className="flex flex-col gap-1 text-13 font-bold">
              <span className="flex items-center gap-1.5">
                {libelleChampFacultatif(libelleCodeExterne(libelleSociete))}
                <AideChamp
                  nomAccessible={t("clients.code_externe.aide_nom")}
                  texte={t("clients.code_externe.aide")}
                />
              </span>
              <input
                name="code_externe"
                defaultValue={valeur("code_externe")}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Champ
                nom="ridet"
                libelle={libelleChampFacultatif(t("client.ridet"))}
                valeur={valeur("ridet")}
              />
              <Champ
                nom="categorie"
                libelle={libelleChampFacultatif(t("client.categorie"))}
                valeur={valeur("categorie")}
              />
              <Champ
                nom="conditions_reglement"
                libelle={libelleChampFacultatif(
                  t("client.conditions_reglement"),
                )}
                valeur={valeur("conditions_reglement")}
              />
              <Champ
                nom="commercial_referent"
                libelle={libelleChampFacultatif(
                  t("client.commercial_referent"),
                )}
                valeur={valeur("commercial_referent")}
              />
            </div>
          </SectionFormulaire>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/clients"
              className="text-app-encre-faible text-13 font-bold"
            >
              {t("clients.nouveau.annuler")}
            </Link>
            <div className="flex items-center gap-3">
              <BarreActionCollee>
                <BoutonCreer>{t("clients.action.creer_client")}</BoutonCreer>
              </BarreActionCollee>
              <Button
                type="submit"
                name="ensuite"
                value="site"
                variant="outline"
                className="order-first"
              >
                {libelleCreerEtAjouterSite()}
              </Button>
            </div>
          </div>
        </form>

        <aside className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4">
            <h2 className="text-14 font-bold">{t("clients.ensuite.titre")}</h2>
            <ol className="flex list-inside list-decimal flex-col gap-1.5 text-13 font-bold">
              <li>{elementEnsuiteSite()}</li>
              <li>{t("clients.ensuite.donneur_ordre")}</li>
              <li>{t("clients.ensuite.machines")}</li>
            </ol>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function Champ({
  nom,
  libelle,
  valeur,
}: Readonly<{
  nom: string;
  libelle: string;
  valeur?: string;
}>) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
    </label>
  );
}
