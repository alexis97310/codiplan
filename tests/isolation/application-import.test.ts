import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { annulerLeLotDeClients } from "@/lib/imports/annulation";
import { appliquerLeLotDeClients } from "@/lib/imports/application";
import { enregistrerLeControle } from "@/lib/imports/depot";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LA CHAÎNE D'IMPORT, TRAVERSÉE JUSQU'À L'ÉCRITURE (L1-08i ; I6, D15).
 *
 * **C'est l'appelant de la chaîne ENTIÈRE** : feuille → contrôle → lot en base
 * → application → fiches réellement écrites. *Une suite qui éprouve tous les
 * maillons n'éprouve pas la chaîne* (§9, 08/09), et cette chaîne-là en compte
 * désormais cinq.
 *
 * Tout passe par le chemin de PRODUCTION, sous le rôle applicatif restreint et
 * sous les politiques : aucun raccourci, aucune écriture posée en SQL.
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

/** Un code que le semis d'isolation ne porte pas — la fiche naît ici. */
const CODE_NEUF = "C-IMPORT-1";

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

/** Contrôle une feuille contre le parc RÉEL, puis enregistre le lot. */
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
      nom: "clients-epreuve.xlsx",
      type: MODELE_CLIENTS.type,
      version: MODELE_CLIENTS.version,
    },
    controle.lignes,
    clientApp(),
  );
  return lotId;
}

/** Ce que la base porte pour un code donné. */
async function ficheParCode(code: string) {
  const [fiche] = await clientOwner().$queryRawUnsafe<
    Array<{ id: string; raison_sociale: string; ridet: string | null }>
  >(
    `SELECT "id", "raison_sociale", "ridet" FROM "client"
      WHERE "societe_id" = '${SOCIETE_A}' AND "code_externe" = '${code}'`,
  );
  return fiche;
}

describe("un lot CRÉE les fiches que son rapport annonçait", () => {
  it("traverse, et la fiche existe RÉELLEMENT en base", async () => {
    const lotId = await controlerEtEnregistrer([
      [CODE_NEUF, "Garage de l'épreuve", "1234567.001"],
    ]);

    // LE TÉMOIN : elle n'existe pas AVANT. Sans lui, une fiche déjà présente
    // ferait passer l'application pour réussie sans qu'elle ait rien écrit.
    expect(await ficheParCode(CODE_NEUF)).toBeUndefined();

    const resultat = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(1);
    expect(resultat.modifications).toBe(0);

    const fiche = await ficheParCode(CODE_NEUF);
    expect(fiche?.raison_sociale).toBe("Garage de l'épreuve");
    expect(fiche?.ridet).toBe("1234567.001");
  });

  it("la LIGNE porte ce qu'elle a produit — l'entité et son identifiant", async () => {
    const fiche = await ficheParCode(CODE_NEUF);
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ entite: string; entite_id: string; valeurs_avant: unknown }>
    >(
      `SELECT "entite", "entite_id", "valeurs_avant" FROM "import_lot_ligne"
        WHERE "cle" = '${CODE_NEUF}'`,
    );
    expect(ligne?.entite).toBe("client");
    expect(ligne?.entite_id).toBe(fiche?.id);
    // *Avant l'application, il n'y a rien à restaurer* — et une CRÉATION n'a
    // rien écrasé : `valeurs_avant` reste nulle, et c'est ce que D15 attend.
    expect(ligne?.valeurs_avant).toBeNull();
  });

  it("LE CLIQUET — un lot ne s'applique qu'une fois", async () => {
    const lotId = await controlerEtEnregistrer([
      ["C-IMPORT-2", "Second garage"],
    ]);
    const premier = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(premier.applique).toBe(true);

    const second = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(second.applique).toBe(false);
    if (second.applique) return;
    expect(second.motif).toBe("lot_deja_applique");
  });
});

describe("un lot MODIFIE ce que la clé désigne, et garde ce qu'il écrase", () => {
  it("la fiche change, et `valeurs_avant` porte l'état d'AVANT — D15", async () => {
    // Le même code qu'à la création : le parc le connaît désormais, donc le
    // rapport dit MODIFICATION. C'est la boucle complète du rapprochement.
    const lotId = await controlerEtEnregistrer([
      [CODE_NEUF, "Garage de l'épreuve — renommé"],
    ]);

    const resultat = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.modifications).toBe(1);
    expect(resultat.creations).toBe(0);

    const fiche = await ficheParCode(CODE_NEUF);
    expect(fiche?.raison_sociale).toBe("Garage de l'épreuve — renommé");

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ valeurs_avant: { raison_sociale: string } | null }>
    >(
      `SELECT "valeurs_avant" FROM "import_lot_ligne"
        WHERE "import_lot_id" = '${lotId}' AND "cle" = '${CODE_NEUF}'`,
    );
    // CE QUE D15 EXIGE POUR RESTAURER : l'état d'avant, lu AVANT d'écrire.
    expect(ligne?.valeurs_avant?.raison_sociale).toBe("Garage de l'épreuve");
  });
});

describe("ce que l'application REFUSE", () => {
  it("un lot d'une AUTRE société est introuvable — et le refus ne dit rien de plus", async () => {
    // *Les distinguer ferait un oracle* : « introuvable » couvre le lot qui
    // n'existe pas ET celui que la politique cache (D35, D50).
    const resultat = await appliquerLeLotDeClients(
      SESSION,
      "aaaaaaaa-0000-7000-8000-0000000f0000",
      clientApp(),
    );
    expect(resultat.applique).toBe(false);
    if (resultat.applique) return;
    expect(resultat.motif).toBe("lot_introuvable");
  });

  it("une ligne REJETÉE par le rapport n'écrit rien", async () => {
    // Le rapport a montré un rejet ; l'application ne le rattrape pas et ne le
    // contourne pas. *Elle n'applique que ce que le rapport a montré.*
    const lotId = await controlerEtEnregistrer([["C-IMPORT-3", "   "]]);
    const resultat = await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.applique).toBe(true);
    if (!resultat.applique) return;
    expect(resultat.creations).toBe(0);
    expect(await ficheParCode("C-IMPORT-3")).toBeUndefined();
  });
});

describe("L'ANNULATION est PARTIELLE et SÛRE (L1-08j ; I6, RG-IMP-02, D15)", () => {
  const CODE_ANNULE = "C-ANNUL-1";

  it("une CRÉATION se défait, et la fiche disparaît réellement", async () => {
    const lotId = await controlerEtEnregistrer([
      [CODE_ANNULE, "Garage éphémère"],
    ]);
    await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    // LE TÉMOIN : elle existe AVANT. Sans lui, une annulation qui ne ferait
    // rien passerait pour réussie.
    expect(await ficheParCode(CODE_ANNULE)).toBeTruthy();

    const resultat = await annulerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes).toEqual([{ rang: 3, defaite: true }]);
    expect(await ficheParCode(CODE_ANNULE)).toBeUndefined();
  });

  it("une MODIFICATION se restaure à ce qu'elle était — D15", async () => {
    const lotId = await controlerEtEnregistrer([
      [CODE_NEUF, "Garage de l'épreuve — encore renommé"],
    ]);
    await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    expect((await ficheParCode(CODE_NEUF))?.raison_sociale).toBe(
      "Garage de l'épreuve — encore renommé",
    );

    const resultat = await annulerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.annule).toBe(true);
    // L'état d'AVANT, rendu. C'est `valeurs_avant` qui le portait, et c'est la
    // seule raison pour laquelle cette colonne existe.
    expect((await ficheParCode(CODE_NEUF))?.raison_sociale).toBe(
      "Garage de l'épreuve — renommé",
    );
  });

  it("une fiche MODIFIÉE DEPUIS est refusée AVEC SON MOTIF, et rien n'est défait", async () => {
    const code = "C-ANNUL-2";
    const lotId = await controlerEtEnregistrer([[code, "Garage intact"]]);
    await appliquerLeLotDeClients(SESSION, lotId, clientApp());

    // Quelqu'un passe après l'import. *Défaire son travail serait pire que ne
    // rien défaire.*
    await clientOwner().$executeRawUnsafe(
      `UPDATE "client" SET "raison_sociale" = 'Renommé à la main'
        WHERE "societe_id" = '${SOCIETE_A}' AND "code_externe" = '${code}'`,
    );

    const resultat = await annulerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes[0]?.defaite).toBe(false);
    expect(resultat.lignes[0]?.motif).toBe("modifiee_depuis");
    // …et la fiche est INTACTE : un refus ne défait rien à moitié.
    expect((await ficheParCode(code))?.raison_sociale).toBe(
      "Renommé à la main",
    );

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "societe_id" = '${SOCIETE_A}' AND "code_externe" = '${code}'`,
    );
  });

  it("une fiche RÉFÉRENCÉE DEPUIS est refusée — et la base le dit, pas une lecture", async () => {
    const code = "C-ANNUL-3";
    const lotId = await controlerEtEnregistrer([[code, "Garage référencé"]]);
    await appliquerLeLotDeClients(SESSION, lotId, clientApp());
    const fiche = await ficheParCode(code);

    // Un site naît après l'import. *Entre un SELECT et un DELETE, un site peut
    // naître* : c'est `ON DELETE RESTRICT` qui garantit « personne ne me
    // référence », jamais une lecture préalable.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
         VALUES ('aaaaaaaa-0000-7000-8000-00000000d0ff', '${SOCIETE_A}', '${fiche?.id}', '${AGENCE_A}', 'Site postérieur')`,
    );

    const resultat = await annulerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;
    expect(resultat.lignes[0]?.motif).toBe("referencee_depuis");
    // **JAMAIS DE SUPPRESSION EN CASCADE** (I6) : le site est toujours là, et
    // le client aussi.
    expect(await ficheParCode(code)).toBeTruthy();

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site" WHERE "id" = 'aaaaaaaa-0000-7000-8000-00000000d0ff'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "id" = '${fiche?.id}'`,
    );
  });

  it("un lot NON APPLIQUÉ ne s'annule pas", async () => {
    const lotId = await controlerEtEnregistrer([["C-ANNUL-4", "Jamais posé"]]);
    const resultat = await annulerLeLotDeClients(SESSION, lotId, clientApp());
    expect(resultat.annule).toBe(false);
    if (resultat.annule) return;
    expect(resultat.motif).toBe("lot_non_applique");
  });

  it("UN LOT ANTÉRIEUR s'annule sur ses lignes intactes — D54, et c'est tout le point", async () => {
    // *La fenêtre de 24 h et « seul le dernier lot est annulable » ont été
    // supprimées : le critère ligne à ligne traite MIEUX le cas des imports qui
    // se recouvrent.* Ici deux lots se suivent, et le PREMIER s'annule sur ce
    // que le second n'a pas touché.
    const intact = "C-ANNUL-5";
    const recouvert = "C-ANNUL-6";

    const premier = await controlerEtEnregistrer([
      [intact, "Resté tranquille"],
      [recouvert, "Version un"],
    ]);
    await appliquerLeLotDeClients(SESSION, premier, clientApp());

    const second = await controlerEtEnregistrer([[recouvert, "Version deux"]]);
    await appliquerLeLotDeClients(SESSION, second, clientApp());

    const resultat = await annulerLeLotDeClients(SESSION, premier, clientApp());
    expect(resultat.annule).toBe(true);
    if (!resultat.annule) return;

    const parRang = new Map(resultat.lignes.map((l) => [l.rang, l]));
    // La ligne que personne n'a touchée est défaite…
    expect(parRang.get(3)?.defaite).toBe(true);
    expect(await ficheParCode(intact)).toBeUndefined();
    // …et celle que le second lot a écrasée est refusée AVEC SON MOTIF.
    expect(parRang.get(4)?.defaite).toBe(false);
    expect(parRang.get(4)?.motif).toBe("modifiee_depuis");
    expect((await ficheParCode(recouvert))?.raison_sociale).toBe(
      "Version deux",
    );

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "societe_id" = '${SOCIETE_A}' AND "code_externe" = '${recouvert}'`,
    );
  });
});
