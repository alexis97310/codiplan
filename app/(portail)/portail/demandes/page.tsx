import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";
import {
  demandesOuvertesDuPortail,
  demandesTraiteesDuPortail,
  type LigneDemandePortail,
} from "@/lib/portail/demandes";
import { historiquesDemandesDuClient } from "@/lib/portail/historique-etats";

import {
  confirmationDuDepot,
  machinePreselectionneeValide,
  sousTitreDesDemandes,
  tempsParEtatDeLaDemande,
} from "./presentation";
import { ListeDemandes } from "./vue";

export const metadata: Metadata = { title: t("portail.demandes.titre") };

/**
 * LE DÉPÔT D'UNE DEMANDE DEPUIS LE PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * ## LA LECTURE DU CONTEXTE — IDENTIQUE AUX AUTRES ÉCRANS DU PORTAIL (D70,
 * D92), JAMAIS UNE SECONDE DÉSIGNATION
 *
 * Même chemin que `/portail` et `/portail/contacts` : rôle du portail exigé,
 * puis le PREMIER rattachement de ce compte sur la société active.
 *
 * ## LA LISTE : TOUT CE QUE CE CLIENT A DÉPOSÉ, LA PLUS RÉCENTE D'ABORD
 *
 * `demandesOuvertes` et `demandesTraitees` lisent déjà SOUS le contexte
 * cloisonné (forme « parc ») — c'est ce qui fait que le même appel sert
 * l'ADV et le portail, sans comparaison de client ni de site écrite ici.
 * Leurs DEUX ordres (urgence, puis dépôt le plus ancien ; dépôt le plus
 * récent) répondent à la question d'une file de travail interne — celle
 * d'un client qui relit SES demandes est différente : la plus récente
 * d'abord, sur l'ensemble, un second tri sur les mêmes lignes plutôt qu'une
 * troisième lecture du critère de périmètre.
 *
 * ## AUCUNE ENTRÉE DE MENU N'EST AJOUTÉE
 *
 * Même état que `/portail/contacts` (9J03-PORTAIL-CONTACTS) : cet écran
 * n'est atteignable que par son URL directe — gap nommé en passation.
 */
export default async function PageDemandesPortail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  if (!estRolePortail(session.contexte.role)) {
    return (
      <Page
        chemin="/portail/demandes"
        entrees={ENTREES_PORTAIL}
        titre={t("portail.demandes.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const surCetteSociete = rattachements.filter(
    (r) => r.societeId === session.contexte.societeId,
  );
  const premier = surCetteSociete[0];
  if (premier === undefined) {
    redirect("/arrivee");
  }

  const contexte = { ...session.contexte, clientId: premier.clientId };
  const [ouvertes, traitees, parc, societe] = await Promise.all([
    demandesOuvertesDuPortail(contexte),
    demandesTraiteesDuPortail(contexte, { page: 1 }),
    parcDuClient(contexte),
    avecContexteApplicatif(contexte, (tx) =>
      tx.societe.findFirst({
        where: { id: contexte.societeId as string },
        select: { fuseau_horaire: true },
      }),
    ),
  ]);
  const fuseau = lireFuseau(societe?.fuseau_horaire);

  // LA PLUS RÉCENTE D'ABORD — voir l'en-tête de ce fichier pour le motif de
  // ce second tri, délibérément distinct de celui des deux lectures.
  const demandes: readonly LigneDemandePortail[] = [
    ...ouvertes,
    ...traitees,
  ].sort((a, b) => b.depose_le.getTime() - a.depose_le.getTime());

  // LE TEMPS PAR ÉTAT DE CHAQUE DEMANDE (9J08B-PORTAIL-TEMPS-PAR-ETAT) — UN
  // SEUL aller pour toutes les demandes de la liste (`historiquesDemandesDu
  // Client`), « maintenant » posé UNE fois ici.
  const historiques = await historiquesDemandesDuClient(
    contexte,
    demandes.map((d) => d.id),
  );
  const maintenantInstant = maintenant(fuseau).instant;
  const tempsParEtatParDemande = new Map(
    demandes.map((demande) => [
      demande.id,
      tempsParEtatDeLaDemande(
        historiques.get(demande.id) ?? [],
        demande.statut,
        maintenantInstant,
        fuseau,
      ),
    ]),
  );

  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;
  const numero = entierDuParametre(paramsResolus.numero);
  const annee = entierDuParametre(paramsResolus.annee);

  const machinePreselectionnee = machinePreselectionneeValide(
    paramsResolus.machine_id,
    parc.machines,
  );

  return (
    <Page
      chemin="/portail/demandes"
      entrees={ENTREES_PORTAIL}
      titre={t("portail.demandes.titre")}
      sousTitre={sousTitreDesDemandes()}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>
          {motif === "portail.demandes.cree"
            ? confirmationDuDepot(numero, annee)
            : t(motif)}
        </BandeauMotif>
      ) : null}
      <ListeDemandes
        demandes={demandes}
        sites={parc.sites}
        machines={parc.machines}
        fuseau={fuseau}
        idNouvelleDemande={uuidv7()}
        tempsParEtatParDemande={tempsParEtatParDemande}
        machinePreselectionnee={machinePreselectionnee}
      />
    </Page>
  );
}

/** Un paramètre d'URL numérique, ou `null` — jamais `NaN` passé en aval. */
function entierDuParametre(
  valeur: string | string[] | undefined,
): number | null {
  if (typeof valeur !== "string" || !/^\d+$/.test(valeur)) {
    return null;
  }
  return Number(valeur);
}
