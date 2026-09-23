import type { Metadata } from "next";

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
import { tousLesResultats } from "@/components/parc/pagination";
import { obtenirSession } from "@/lib/auth/session";
import { rechercherClients } from "@/lib/clients/depot";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_CLIENTS } from "@/lib/clients/saisie";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { listerLesFamilles, listerLesModeles } from "@/lib/materiel/depot";
import { rechercherSites } from "@/lib/sites/depot";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_SITES } from "@/lib/sites/saisie";

export const metadata: Metadata = { title: t("machine.nouvelle.titre") };

/**
 * CRÉER UNE FICHE MACHINE (AT-07 bis — R6-03, blocage n°1 du domaine).
 *
 * *Le parc ne se remplissait que par le semis et l'import* — aucune route
 * n'appelait `creerMachineDans` depuis un écran. `FormulaireMachine` porte la
 * saisie et la règle D-06 ; cette page porte les TROIS listes dont il a
 * besoin — modèles (groupés par famille), clients, sites — et rien de plus :
 * la décision reste dans `lib/machines/depot.ts` (`creerMachine`).
 *
 * **LES DEUX SÉLECTEURS MONTRENT LE RÉFÉRENTIEL ENTIER, JAMAIS UNE PAGE**
 * (lot SELECT-1, 21/09/2026).
 *
 * *Faux jusqu'ici : ce commentaire justifiait un plafond de 200 fiches par
 * « la volumétrie du chapitre 11.3, 200 à 500 clients actifs à trois ans ».
 * Mesuré contre la base — locale, le proxy de ce bac à sable bloquant la base
 * hébergée (§9, la mesure prime la supposition) : une société en porte déjà
 * 576, bien au-delà des 500 supposés, et 200 d'entre eux disparaissaient du
 * sélecteur sans le moindre message — créer une machine pour l'un des 376
 * clients restants était tout simplement IMPOSSIBLE. RG-PAR-07 ne dit nulle
 * part qu'un client peut être hors de portée de la fiche machine ; le plafond
 * était un défaut, pas une règle de gestion.*
 *
 * `rechercherClients` et `rechercherSites` restent bornés à
 * `LIMITE_RECHERCHE_MAXIMALE` **par requête** — le garde-fou contre une seule
 * requête qui ramènerait tout le référentiel d'un coup depuis Nouméa reste
 * entier, c'est la raison de sa présence à L1-01/L1-02. `tousLesResultats`
 * (ci-dessous) enchaîne les pages jusqu'à épuisement : un sélecteur n'est pas
 * une liste de recherche paginée à l'écran comme `/clients` ou `/sites`
 * (AT-07) — il n'a pas de page suivante à proposer, il doit montrer CE QUI
 * EXISTE, quel qu'en soit le nombre.
 *
 * `tousLesResultats` — la boucle qui enchaîne les pages — vit dans
 * `components/parc/pagination.ts`, ni ici ni dans
 * `components/parc/formulaire-machine.tsx` (PARC-TER, 21/09/2026). Cette page
 * ne peut pas la porter : Next.js refuse toute exportation d'un fichier
 * `page.tsx` étrangère à son contrat de route (mesuré au build :
 * « "tousLesResultats" is not a valid Page export field »). Le formulaire ne
 * le pouvait pas davantage : il commence par `"use client"`, et toute
 * exportation d'un module client devient une référence client pour qui
 * l'importe — un composant serveur qui l'APPELLE, plutôt que de la rendre en
 * JSX, échoue au rendu (mesuré : 500, la même panne que celle que ce ticket
 * corrige, une deuxième fois sur le même écran). `components/parc/pagination.ts`
 * n'est NI l'un ni l'autre : une fonction serveur ordinaire, sans frontière à
 * franchir.
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
    tousLesResultats(
      (page) =>
        rechercherClients(contexte, {
          texte: null,
          etat: "actifs",
          limite: LIMITE_CLIENTS,
          page,
        }),
      LIMITE_CLIENTS,
    ),
    tousLesResultats(
      (page) =>
        rechercherSites(contexte, {
          client_id: null,
          zone_geo: null,
          texte: null,
          actifs_seulement: true,
          limite: LIMITE_SITES,
          page,
        }),
      LIMITE_SITES,
    ),
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
