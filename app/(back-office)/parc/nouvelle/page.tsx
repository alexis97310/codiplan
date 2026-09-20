import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import {
  FormulaireMachine,
  type OptionClient,
  type OptionModele,
  type OptionSite,
} from "@/components/parc/formulaire-machine";
import { obtenirSession } from "@/lib/auth/session";
import { rechercherClients } from "@/lib/clients/depot";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_CLIENTS } from "@/lib/clients/saisie";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { listerLesFamilles, listerLesModeles } from "@/lib/materiel/depot";
import { rechercherSites } from "@/lib/sites/depot";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_SITES } from "@/lib/sites/saisie";

/**
 * CRÉER UNE FICHE MACHINE (AT-07 bis — R6-03, blocage n°1 du domaine).
 *
 * *Le parc ne se remplissait que par le semis et l'import* — aucune route
 * n'appelait `creerMachineDans` depuis un écran. `FormulaireMachine` porte la
 * saisie et la règle D-06 ; cette page porte les TROIS listes dont il a
 * besoin — modèles (groupés par famille), clients, sites — et rien de plus :
 * la décision reste dans `lib/machines/depot.ts` (`creerMachine`).
 *
 * **Les trois listes sont PLAFONNÉES, jamais paginées** — même raisonnement
 * que `resumerLeParcFiltre` : un sélecteur n'est pas une liste de recherche,
 * et la volumétrie du chapitre 11.3 (200 à 500 clients actifs à trois ans)
 * tient sous les plafonds existants.
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
  const contexte = session.contexte;

  const [familles, modelesBruts, clientsBruts, sitesBruts] = await Promise.all([
    listerLesFamilles(contexte),
    listerLesModeles(contexte),
    rechercherClients(contexte, {
      texte: null,
      etat: "actifs",
      limite: LIMITE_CLIENTS,
      page: 1,
    }),
    rechercherSites(contexte, {
      client_id: null,
      zone_geo: null,
      texte: null,
      actifs_seulement: true,
      limite: LIMITE_SITES,
      page: 1,
    }),
  ]);

  const libelleFamille = new Map(
    familles.map((famille) => [famille.id, famille.libelle]),
  );
  const modeles: OptionModele[] = modelesBruts
    .filter((modele) => modele.actif)
    .map((modele) => ({
      id: modele.id,
      marque: modele.marque,
      reference: modele.reference,
      familleLibelle:
        libelleFamille.get(modele.famille_id) ?? t("parc.a_completer"),
    }));
  const clients: OptionClient[] = clientsBruts.map((cl) => ({
    id: cl.id,
    raisonSociale: cl.raison_sociale,
  }));
  const sites: OptionSite[] = sitesBruts.map((site) => ({
    id: site.id,
    libelle: site.libelle,
    clientId: site.client_id,
  }));

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
        modeles={modeles}
        clients={clients}
        sites={sites}
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
