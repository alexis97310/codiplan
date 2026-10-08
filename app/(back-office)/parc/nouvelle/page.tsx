import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { tonDuMotifDeFiche } from "@/components/ui/bandeau-motif";
import { Message } from "@/components/ui/message";
import { FormulaireMachine } from "@/components/parc/formulaire-machine";
import { obtenirSession } from "@/lib/auth/session";
import { lireClient } from "@/lib/clients/depot";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { listerLesFamilles } from "@/lib/materiel/depot";
import { lireSite } from "@/lib/sites/depot";

import { sousTitreNouvelleMachine } from "../presentation";

export const metadata: Metadata = { title: t("machine.nouvelle.titre") };

/**
 * CRÉER UNE FICHE MACHINE (AT-07 bis — R6-03, blocage n°1 du domaine ;
 * reconstruite au gabarit du 28/09, 9EK-TP-UX5-2-CREATIONS-2, D184).
 *
 * *Le parc ne se remplissait que par le semis et l'import* — aucune route
 * n'appelait `creerMachineDans` depuis un écran. `FormulaireMachine` porte la
 * saisie et la règle D-06 ; cette page ne porte plus rien de plus que le
 * mode, l'action, les familles ACTIVES et les valeurs par défaut du
 * formulaire.
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
 * toute lecture. Cette page n'a donc plus aucun référentiel à lire d'avance
 * — SAUF les familles (D184), lues ici pour raccourcir la liste des modèles,
 * et réduites à `{id, libelle}` avant d'atteindre le composant client.
 *
 * ## LE MOTIF DE SUCCÈS NE SE PASSE JAMAIS AU FORMULAIRE (D184)
 *
 * `machine.creee` (après « Créer et en ajouter une autre ») est une clé de
 * RÉUSSITE (`tonDuMotifDeFiche`, `components/ui/bandeau-motif.tsx`) : la
 * passer comme `motifInitial` l'afficherait dans le bandeau ROUGE de
 * `FormulaireMachine`, qui ne connaît que le refus. Cette page la rend elle-
 * même, en vert, et ne transmet au formulaire qu'un motif de REFUS.
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

  const params = await searchParams;
  const motif = params.motif;
  const motifBrut = typeof motif === "string" ? motif : undefined;
  const motifEstValide = motifBrut !== undefined && estCleTraduction(motifBrut);
  const motifEstSucces =
    motifEstValide && tonDuMotifDeFiche(motifBrut) === "succes";
  const motifInitial: CleTraduction | undefined =
    motifEstValide && !motifEstSucces
      ? (motifBrut as CleTraduction)
      : undefined;

  // PRÉREMPLISSAGE PAR L'URL (FICHE-360-1, `/parc/nouvelle?client=&site=`,
  // même forme que LIENS-1 sur `/interventions/nouvelle`) — résolu SOUS LE
  // CONTEXTE cloisonné (SELECTEURS-1 : `SelecteurRecherche` cherche sur le
  // serveur, il n'y a plus de référentiel local à comparer) : un identifiant
  // hors périmètre ou inexistant rend `null`, jamais un message ni une
  // valeur d'une autre société. Le site n'est retenu que s'il appartient au
  // client résolu.
  const clientParam =
    typeof params.client === "string" ? params.client : undefined;
  const siteParam = typeof params.site === "string" ? params.site : undefined;
  const clientInitial =
    clientParam === undefined
      ? null
      : await lireClient(session.contexte, clientParam);
  const siteInitialFiche =
    siteParam === undefined || clientInitial === null
      ? null
      : await lireSite(session.contexte, siteParam);
  const siteInitial =
    siteInitialFiche !== null &&
    siteInitialFiche.client_id === clientInitial?.id
      ? siteInitialFiche
      : null;

  // LES FAMILLES ACTIVES (D184) — raccourcissent la liste des modèles ;
  // réduites à `{id, libelle}`, jamais `LigneFamille` (frontière serveur →
  // client, `tests/unit/gardiens/frontiere-serveur-client.test.ts`).
  const familles = (await listerLesFamilles(session.contexte))
    .filter((famille) => famille.actif)
    .map((famille) => ({ id: famille.id, libelle: famille.libelle }));

  return (
    <Page
      chemin="/parc"
      titre={t("machine.nouvelle.titre")}
      sousTitre={sousTitreNouvelleMachine()}
      actions={
        <Link href="/parc" className="text-app-encre-faible text-13 font-bold">
          {t("machine.nouvelle.retour")}
        </Link>
      }
    >
      {!motifEstSucces || motifBrut === undefined ? null : (
        <Message ton="succes" titre={t(motifBrut as CleTraduction)} />
      )}
      <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1fr)_280px]">
        <FormulaireMachine
          mode="creation"
          action="/api/machines/creer"
          motifSucces="machine.creee"
          motifInitial={motifInitial}
          familles={familles}
          clientInitial={
            clientInitial === null
              ? undefined
              : { id: clientInitial.id, libelle: clientInitial.raison_sociale }
          }
          siteInitial={
            siteInitial === null
              ? undefined
              : { id: siteInitial.id, libelle: siteInitial.libelle }
          }
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
        <aside className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border p-4">
            <h2 className="text-14 font-bold">
              {t("machine.nouvelle.etiquette_titre")}
            </h2>
            <p className="text-app-encre-faible text-13 font-bold">
              {t("machine.nouvelle.etiquette_texte")}
            </p>
          </section>
        </aside>
      </div>
    </Page>
  );
}
