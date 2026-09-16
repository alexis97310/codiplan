import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import {
  enregistrerLeControle,
  lireLeLot,
  listerLesLots,
} from "@/lib/imports/depot";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";
import { applicationDuType } from "@/lib/imports/types-dimport";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * CE QUE L'ÉCRAN D'IMPORT LIT, ET SOUS QUEL RÉGIME (L1-11 ; D100, D35, D50).
 *
 * **L'écran n'écrit aucune comparaison de société**, et c'est ce qui se mesure
 * ici : `import_lot` et `import_lot_ligne` sont de forme « interne » (D100) —
 * société **et** `app.client_id` absent —, et c'est la BASE qui prononce. Une
 * comparaison écrite au-dessus serait une seconde lecture d'un critère que la
 * politique porte déjà, et c'est celle qui vieillit sans rougir.
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif restreint.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  ...SESSION_A,
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
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
  session: typeof SESSION_A,
  nom: string,
  lignes: readonly (readonly string[])[],
): Promise<string> {
  const parc = await indexerLeParcClients(session, clientApp());
  const controle = controlerFeuille(feuille(lignes), MODELE_CLIENTS, parc);
  if (!controle.lisible) {
    throw new Error("la feuille de l'épreuve est illisible");
  }
  const { lotId } = await enregistrerLeControle(
    session,
    { nom, type: MODELE_CLIENTS.type, version: MODELE_CLIENTS.version },
    controle.lignes,
    clientApp(),
  );
  return lotId;
}

describe("le journal des chargements ne montre que sa société", () => {
  it("chacune voit le sien, et JAMAIS celui de l'autre", async () => {
    const chezA = await controlerEtEnregistrer(SESSION_A, "chez-a.xlsx", [
      ["C-ECRAN-A", "Garage d'écran A"],
    ]);
    const chezB = await controlerEtEnregistrer(SESSION_B, "chez-b.xlsx", [
      ["C-ECRAN-B", "Garage d'écran B"],
    ]);

    // LE TÉMOIN : les deux lots existent RÉELLEMENT, lus hors politique. Sans
    // lui, « A ne voit pas celui de B » serait vrai d'un lot qui n'a jamais
    // été écrit — *deux absences sont égales* (§9, 10/09).
    const [compte] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "import_lot" WHERE "id" IN ('${chezA}', '${chezB}')`,
    );
    expect(Number(compte?.n)).toBe(2);

    const vusParA = (await listerLesLots(SESSION_A, clientApp())).map(
      (lot) => lot.id,
    );
    expect(vusParA).toContain(chezA);
    expect(vusParA).not.toContain(chezB);

    const vusParB = (await listerLesLots(SESSION_B, clientApp())).map(
      (lot) => lot.id,
    );
    expect(vusParB).toContain(chezB);
    expect(vusParB).not.toContain(chezA);
  });

  it("un lot d'une AUTRE société est « introuvable », et rien de plus", async () => {
    const chezB = await controlerEtEnregistrer(SESSION_B, "autre.xlsx", [
      ["C-ECRAN-B2", "Second garage B"],
    ]);
    // *Les distinguer ferait un oracle* (D35, D50) : « interdit » apprendrait
    // qu'il existe, « introuvable » n'apprend rien.
    expect(await lireLeLot(SESSION_A, chezB, clientApp())).toBeNull();

    // LE JUMEAU QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le
    // MÊME appel, sous la société qui le porte, rend le lot. Sans lui, une
    // lecture qui rendrait toujours `null` passerait la ligne ci-dessus.
    const luParB = await lireLeLot(SESSION_B, chezB, clientApp());
    expect(luParB?.nomFichier).toBe("autre.xlsx");
  });
});

describe("ce que le rapport rend à l'écran", () => {
  it("les décomptes viennent du LOT, et ils s'accordent aux lignes", async () => {
    const lotId = await controlerEtEnregistrer(SESSION_A, "rapport.xlsx", [
      ["C-ECRAN-A2", "Garage du rapport"],
      ["C-ECRAN-A3", "Second du rapport"],
      // Une raison sociale vide : la saisie la refuse, et la ligne part en
      // REJET avec son motif (L1-08h).
      ["C-ECRAN-A4", ""],
    ]);
    const lot = await lireLeLot(SESSION_A, lotId, clientApp());
    expect(lot).not.toBeNull();
    if (lot === null) return;

    expect(lot.decomptes.creations).toBe(2);
    expect(lot.decomptes.rejets).toBe(1);

    // *Le rapport et ses lignes ne sont pas deux lectures d'un même critère* :
    // les décomptes ont été POSÉS depuis les lignes, et l'écran les relit tels
    // quels. Ici on vérifie qu'ils s'accordent — c'est ce qu'un lecteur de
    // l'écran croit en les voyant côte à côte.
    const rejetees = lot.lignes.filter((ligne) => ligne.action === "rejet");
    expect(rejetees.length).toBe(lot.decomptes.rejets);
    expect(rejetees[0]?.rejetMotif).not.toBeNull();

    // L'AUTEUR est résolu DANS la transaction cloisonnée, et il porte un nom.
    // *Une `Map` n'a qu'une façon de ne pas répondre* — ici la somme dit
    // laquelle des trois, et « non demandée » serait un défaut de ce module.
    expect(lot.auteur.etat).toBe("nom");
  });

  it("AUCUN OCTET n'est conservé : `objet_cle` reste nulle", async () => {
    const lotId = await controlerEtEnregistrer(SESSION_A, "octets.xlsx", [
      ["C-ECRAN-A5", "Garage des octets"],
    ]);
    // Lu hors politique : *ce qui n'est écrit nulle part doit être absent de la
    // base, pas seulement absent de ce que l'écran montre.*
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ objet_cle: string | null; nom_fichier: string }>
    >(
      `SELECT "objet_cle", "nom_fichier" FROM "import_lot" WHERE "id" = '${lotId}'`,
    );
    // Le témoin : la ligne a bien été trouvée. *Une ligne absente rendrait
    // `undefined`, et `undefined?.objet_cle` vaudrait `undefined` — vert sans
    // rien regarder.*
    expect(ligne?.nom_fichier).toBe("octets.xlsx");
    expect(ligne?.objet_cle).toBeNull();
  });
});

/**
 * LE BOUTON NE S'AFFICHE PAS SUR UN LOT QU'ON NE SAIT PAS APPLIQUER (R6-01).
 *
 * L'écran calcule `sansApplication` depuis `lot.typeImport` et
 * `applicationDuType` — **la même fonction que la route appelle**. *Deux
 * lectures d'un même critère divergeraient en silence* (§9, 01/09), et ici la
 * divergence se verrait de la pire façon : un bouton proposé que la route
 * refuse, ou l'inverse. Ce scénario rejoue ce calcul sur un lot RÉEL, lu par le
 * chemin de production.
 */
describe("l'écran ne propose pas d'appliquer ce qu'on ne sait pas écrire", () => {
  it("un lot de CONTACTS n'a pas de bouton, et le lot reste `controle`", async () => {
    const lotId = await controlerEtEnregistrer(SESSION_A, "contacts.xlsx", []);
    // Le type est posé à la main : le gabarit des contacts existe, et la route
    // de contrôle sait le choisir — mais ce scénario mesure l'ÉCRAN, pas le
    // téléversement, et il lui faut un lot du bon type sans détour.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "import_lot" SET "type_import" = 'contacts' WHERE "id" = '${lotId}'`,
    );

    const lot = await lireLeLot(SESSION_A, lotId, clientApp());
    expect(lot?.typeImport).toBe("contacts");
    // **C'est le calcul exact de l'écran**, sur la valeur exacte qu'il lit.
    expect(applicationDuType(lot?.typeImport as string)).toBeNull();
    expect(lot?.statut).toBe("controle");
  });

  it("un lot de SITES, lui, en a un — le témoin qui rend le scénario lisible", async () => {
    // §9, 11/09 : *à côté de chaque cas qui doit rougir, un cas qui doit rester
    // vert POUR SA PROPRE RAISON.* Sans lui, un `applicationDuType` qui
    // rendrait `null` pour TOUT type passerait le scénario ci-dessus.
    const lotId = await controlerEtEnregistrer(SESSION_A, "sites.xlsx", []);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "import_lot" SET "type_import" = 'sites' WHERE "id" = '${lotId}'`,
    );
    const lot = await lireLeLot(SESSION_A, lotId, clientApp());
    expect(applicationDuType(lot?.typeImport as string)).not.toBeNull();
  });
});
