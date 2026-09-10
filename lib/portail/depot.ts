import { avecContexteApplicatif } from "@/lib/db/client";
import { avecIdentite } from "@/lib/db/rls";
import { prisma as clientParDefaut } from "@/lib/db/client";
import { type ContexteSession } from "@/lib/auth/contexte";

import { type PrismaClient } from "@prisma/client";

/**
 * LE PORTAIL CLIENT — CONSULTATION SEULE (ticket L2-12, D92).
 *
 * ## Ce que ce module fait, et ce qu'il NE FAIT PAS
 *
 * Il LIT. Il n'écrit rien, et il n'ouvre aucun chemin d'écriture : *le bouton
 * « demander une intervention » n'est pas tranché, il n'est donc ni construit,
 * ni préparé — aucune table ne l'attend.* Une table posée « pour plus tard »
 * est une décision prise par personne (§9, 24/08).
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ NI DE CLIENT N'EST ÉCRITE ICI
 *
 * On lit SOUS le contexte, et la politique décide — c'est la règle que `client`,
 * `site`, `machine` et `intervention` suivent déjà. Une comparaison écrite
 * au-dessus serait une **seconde lecture du même critère**, qui diverge en
 * silence (§9, 01/09) et, dans le sens permissif, ouvre.
 *
 * Ce que la forme « parc » garantit, et que ce module ne redit pas :
 *   — la SOCIÉTÉ, par `societe_id = app.societe_id` ;
 *   — le CLIENT, par `app.client_id`, désigné par l'appelant et **validé par la
 *     base** dans la même transaction (D70) ;
 *   — le PÉRIMÈTRE DE SITES, par `app.perimetre_sites` — le seul des trois qui
 *     sépare deux sites d'un même client.
 *
 * ## L'EMPLACEMENT DES DOCUMENTS ET DE L'ÉTAT VGP EST PRÉVU, JAMAIS INVENTÉ
 *
 * Les lots 8 (documents, D87) et 9 (registre VGP, D88) ne sont pas construits.
 * Ce module ne fabrique donc **aucune** valeur pour eux : il ne rend ni un
 * compte de documents qui vaudrait zéro, ni un état VGP qui vaudrait « à jour ».
 * *Un zéro inventé se lit comme une mesure* (§9, 06/09), et « sans information »
 * n'est ni « à jour » ni « en retard » (D88). L'écran réserve la place et écrit
 * qu'elle est vide ; le jour où les tables existent, elle se remplit.
 */

/** Un rattachement du compte : la société, le client, et de quoi le nommer. */
export type Rattachement = {
  readonly societeId: string;
  readonly clientId: string;
};

/**
 * Les rattachements du compte connecté — la DIXIÈME forme de politique en acte.
 *
 * Lue sous la forme « identité », donc **sans société active** : c'est tout
 * l'objet de D92. Un compte portail n'a aucune ligne dans `utilisateur_societe`
 * (D10), et sans cette lecture il n'atteignait aucun écran.
 *
 * Ce qu'elle rend : les rattachements de CE compte, et rien d'autre. Ni leur
 * nom — `client` reste de forme « parc » —, ni ceux d'autrui.
 */
export async function rattachementsDuCompte(
  utilisateurId: string,
  client: PrismaClient = clientParDefaut,
): Promise<Rattachement[]> {
  const lignes = await avecIdentite(client, utilisateurId, (tx) =>
    tx.utilisateurClient.findMany({
      where: { utilisateur_id: utilisateurId, actif: true },
      select: { societe_id: true, client_id: true },
      orderBy: [{ societe_id: "asc" }, { client_id: "asc" }],
    }),
  );
  return lignes.map((ligne) => ({
    societeId: ligne.societe_id,
    clientId: ligne.client_id,
  }));
}

/** Un site tel que le portail le montre. */
export type SiteDuPortail = {
  readonly id: string;
  readonly libelle: string;
  readonly commune: string | null;
  readonly zoneGeo: string | null;
};

/** Une machine telle que le portail la montre. */
export type MachineDuPortail = {
  readonly id: string;
  readonly numeroSerie: string;
  readonly referenceInterne: string | null;
  readonly localisation: string | null;
  readonly statut: string;
  readonly siteId: string;
  readonly dateMiseEnService: Date | null;
};

/** Ce que le portail affiche d'un client : ses sites, et son parc. */
export type ParcDuClient = {
  readonly raisonSociale: string | null;
  readonly sites: readonly SiteDuPortail[];
  readonly machines: readonly MachineDuPortail[];
};

/**
 * Le parc visible d'un compte portail, sous SON contexte.
 *
 * Le contexte porte déjà `clientId` : c'est la désignation de D70, validée par
 * `app_poser_perimetre_client`, qui LÈVE si le client n'est pas parmi les
 * habilitations du compte. **Une désignation refusée ne rend pas une liste
 * vide : elle interrompt.** Un contexte vide rouvrirait la branche « utilisateur
 * interne » de la forme « parc ».
 */
export async function parcDuClient(
  contexte: ContexteSession,
): Promise<ParcDuClient> {
  return avecContexteApplicatif(contexte, async (tx) => {
    // Le NOM du client se lit comme le reste : sous la politique. Il n'est pas
    // recopié depuis le rattachement — un libellé recopié devient faux au
    // premier renommage, sans rougir (la divergence silencieuse de D67).
    const [fiche, sites, machines] = await Promise.all([
      tx.client.findFirst({ select: { raison_sociale: true } }),
      tx.site.findMany({
        where: { actif: true },
        select: { id: true, libelle: true, commune: true, zone_geo: true },
        orderBy: { libelle: "asc" },
      }),
      tx.machine.findMany({
        select: {
          id: true,
          numero_serie: true,
          reference_interne: true,
          localisation: true,
          statut: true,
          site_id: true,
          date_mise_en_service: true,
        },
        orderBy: { numero_serie: "asc" },
      }),
    ]);

    return {
      raisonSociale: fiche?.raison_sociale ?? null,
      sites: sites.map((site) => ({
        id: site.id,
        libelle: site.libelle,
        commune: site.commune,
        zoneGeo: site.zone_geo,
      })),
      machines: machines.map((machine) => ({
        id: machine.id,
        numeroSerie: machine.numero_serie,
        referenceInterne: machine.reference_interne,
        localisation: machine.localisation,
        statut: machine.statut,
        siteId: machine.site_id,
        dateMiseEnService: machine.date_mise_en_service,
      })),
    };
  });
}
