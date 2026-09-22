import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { appliquerLeLotDeClients } from "@/lib/imports/application";
import { enregistrerLeControle } from "@/lib/imports/depot";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LA DURÉE DE L'APPLICATION EST UN FAIT MESURÉ, JAMAIS UN CALCUL ENTRE DEUX
 * DATES POSÉES PAR DES GESTES DIFFÉRENTS (MESURE-1, 23/09/2026).
 *
 * Deux épreuves, l'une en miroir de l'autre :
 *   1. un lot APPLIQUÉ porte une durée mesurée, strictement positive, et
 *      DISTINCTE de `applique_le - controle_le` — le piège nommé par le
 *      ticket : cet écart contient le temps qu'un humain a passé à lire le
 *      rapport, jamais la durée de la transaction ;
 *   2. un lot resté `controle` ne porte AUCUNE durée, jamais zéro — zéro se
 *      lirait comme « instantané », c'est-à-dire un mensonge.
 *
 * Tout passe par le chemin de production, sous le rôle applicatif restreint.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function feuille(lignes: readonly (readonly string[])[]): FeuilleLue {
  return {
    nom: "Clients",
    lignes: [
      [{ texte: marqueurDu(MODELE_CLIENTS) }],
      MODELE_CLIENTS.colonnes.map((colonne) => ({ texte: colonne.nom })),
      ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
    ],
  };
}

async function controlerEtEnregistrer(
  lignes: readonly (readonly string[])[],
): Promise<string> {
  const parc = await indexerLeParcClients(SESSION, clientApp());
  const controle = controlerFeuille(feuille(lignes), MODELE_CLIENTS, parc);
  if (!controle.lisible) {
    throw new Error("la feuille de l'épreuve est illisible");
  }
  const { lotId } = await enregistrerLeControle(
    SESSION,
    {
      nom: "duree-application.xlsx",
      type: MODELE_CLIENTS.type,
      version: MODELE_CLIENTS.version,
    },
    controle.lignes,
    clientApp(),
  );
  return lotId;
}

/** Ce que la base porte pour un lot, lu hors politique (témoin). */
async function lotEnBase(lotId: string) {
  const [lot] = await clientOwner().$queryRawUnsafe<
    Array<{
      statut: string;
      controle_le: Date;
      applique_le: Date | null;
      duree_application_ms: number | null;
    }>
  >(
    `SELECT "statut", "controle_le", "applique_le", "duree_application_ms"
       FROM "import_lot" WHERE "id" = '${lotId}'`,
  );
  return lot;
}

describe("un lot APPLIQUÉ porte une durée MESURÉE, jamais un calcul entre deux dates", () => {
  it("la durée est strictement positive, et distincte de `applique_le - controle_le`", async () => {
    const lotId = await controlerEtEnregistrer([
      ["C-DUREE-1", "Garage de la durée"],
    ]);

    // LE PIÈGE À FABRIQUER : contrôle très en amont de l'application, pour
    // que `applique_le - controle_le` — le temps qu'un humain aurait passé à
    // lire le rapport — ne puisse en aucun cas coïncider avec la durée d'une
    // transaction (quelques millisecondes). Sans cet écart artificiel, un
    // code fautif qui écrirait `applique_le - controle_le` à la place d'une
    // vraie mesure pourrait, par accident, rester sous le même ordre de
    // grandeur et ne jamais rougir.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "import_lot" SET "controle_le" = now() - interval '5 hours'
         WHERE "id" = '${lotId}'`,
    );

    const resultat = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);

    const lot = await lotEnBase(lotId);
    expect(lot?.statut).toBe("applique");
    expect(lot?.duree_application_ms).not.toBeNull();
    // JAMAIS ZÉRO — une transaction réelle ne dure jamais zéro milliseconde.
    expect(lot?.duree_application_ms).toBeGreaterThan(0);

    const ecartControleApplique =
      (lot!.applique_le as Date).getTime() - lot!.controle_le.getTime();
    // Cinq heures d'écart artificiel, en millisecondes — bien au-delà de ce
    // qu'une transaction d'une seule fiche peut jamais mesurer. Si la durée
    // écrite valait cet écart, elle vaudrait des heures ; elle vaut des
    // millisecondes.
    expect(ecartControleApplique).toBeGreaterThan(4 * 60 * 60 * 1000);
    expect(lot!.duree_application_ms as number).toBeLessThan(
      ecartControleApplique,
    );
  });
});

describe("un lot resté `controle` ne porte AUCUNE durée, jamais zéro", () => {
  it("la durée reste NULLE avant toute application", async () => {
    const lotId = await controlerEtEnregistrer([
      ["C-DUREE-2", "Garage jamais appliqué"],
    ]);

    const lot = await lotEnBase(lotId);
    expect(lot?.statut).toBe("controle");
    // **NULL, jamais 0** — une valeur numérique à zéro dirait qu'une mesure a
    // eu lieu et qu'elle a trouvé une transaction instantanée, ce qui est
    // faux : aucune transaction n'a eu lieu.
    expect(lot?.duree_application_ms).toBeNull();
  });
});
