import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  changerActiviteForfait,
  creerForfait,
  modifierForfait,
} from "@/lib/tarification/depot-forfaits";
import { schemaForfait } from "@/lib/tarification/forfaits";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * LE CHEMIN D'ÉCRITURE DU CATALOGUE DE FORFAITS (R2-20).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurait
 *
 * L1-06 a livré la règle, la base et l'écran de LECTURE. **Rien ne créait un
 * forfait** — le catalogue naissait vide par décision, et il le restait.
 *
 * **Et la chose la plus importante qu'il mesure est une ÉCRITURE QUI N'ÉCRIT
 * RIEN** : « aucune condition » se stocke `NULL`, la contrainte refuse `{}`, et
 * Prisma refuse `null` sur une liste scalaire. *La seule écriture qui produise
 * `NULL` est celle qui OMET la colonne* — c'est mesuré ici, en relisant la
 * ligne, et non supposé.
 *
 * *Le ticket annonçait qu'il faudrait « du SQL explicite ». La mesure dit le
 * contraire, et c'est ce qui a permis de ne pas enfreindre le §2.*
 */

const contexte = (societeId: string, role: Role) => ({
  utilisateurId: UTILISATEUR_PAR_ROLE[role],
  societeId,
  role,
  // `admin_societe` est le rôle qui paramètre la société (matrice §5.2), et
  // RG-DRO-05 lui impose un second facteur : le contexte le porte VALIDE, comme
  // une session réelle après le défi. *Sans cette ligne, les scénarios
  // échoueraient sur l'authentification et ne mesureraient rien du catalogue.*
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
});

/** Une saisie valide, dont on ne change qu'un détail à la fois. */
function saisie(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaForfait.safeParse({
    code: `F-${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Forfait d'épreuve",
    type: "deplacement",
    rang: 1 + Math.floor(Math.random() * 100_000),
    montant_mineur: 4500,
    cumulable_temps: false,
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "forfait" WHERE "code" LIKE 'F-%'`,
  );
});

afterAll(fermerClients);

describe("« aucune condition » s'écrit NULL, et c'est la seule forme que la base accepte", () => {
  it("une création sans condition laisse les deux colonnes NULLES", async () => {
    const resultat = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie(),
      "XPF",
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) {
      return;
    }

    // RELUE EN SQL, sous le PROPRIÉTAIRE : Prisma rend `[]` pour une colonne
    // nulle, si bien qu'une lecture par le client ne saurait PAS distinguer
    // `NULL` de `{}` — et c'est exactement la distinction qui compte ici.
    const lignes = await clientOwner().$queryRawUnsafe<
      { zone_geo: unknown; type_intervention: unknown }[]
    >(
      `SELECT "zone_geo", "type_intervention" FROM "forfait" WHERE "id" = $1::uuid`,
      resultat.id,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.zone_geo).toBeNull();
    expect(lignes[0]!.type_intervention).toBeNull();
  });

  it("et une condition POSÉE est écrite telle quelle — le témoin de la précédente", () => {
    // Sans ce cas, l'assertion « les colonnes sont nulles » serait verte sur un
    // module qui n'écrit JAMAIS de condition, ce qui ne prouverait rien.
    return creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie({ zone_geo: ["grand_noumea"] }),
      "XPF",
      clientApp(),
    ).then(async (resultat) => {
      expect(resultat.accepte).toBe(true);
      if (!resultat.accepte) {
        return;
      }
      const lignes = await clientOwner().$queryRawUnsafe<
        { zone_geo: string[] }[]
      >(`SELECT "zone_geo" FROM "forfait" WHERE "id" = $1::uuid`, resultat.id);
      expect(lignes[0]!.zone_geo).toEqual(["grand_noumea"]);
    });
  });
});

describe("les refus nomment leur motif, et ils viennent de la BASE", () => {
  it("un rang déjà pris pour ce type est refusé, et le motif le dit", async () => {
    const commun = saisie();
    const premier = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      commun,
      "XPF",
      clientApp(),
    );
    expect(premier.accepte).toBe(true);

    // MÊME type, MÊME rang, code différent : c'est l'unicité composite
    // `(societe_id, type, rang)` qui doit mordre, et elle seule (D86).
    const second = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie({ rang: commun.rang, type: commun.type }),
      "XPF",
      clientApp(),
    );
    expect(second.accepte).toBe(false);
    if (!second.accepte) {
      expect(second.motif).toBe("rang_pris");
    }
  });

  it("un code déjà pris est refusé, et NE se confond pas avec un rang pris", async () => {
    const commun = saisie();
    await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      commun,
      "XPF",
      clientApp(),
    );

    const second = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie({ code: commun.code }),
      "XPF",
      clientApp(),
    );
    expect(second.accepte).toBe(false);
    if (!second.accepte) {
      expect(second.motif).toBe("code_pris");
    }
  });

  it("LE MÊME RANG DANS UNE AUTRE SOCIÉTÉ PASSE — le rang ne se compare qu'entre pairs", async () => {
    const commun = saisie();
    const premier = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      commun,
      "XPF",
      clientApp(),
    );
    expect(premier.accepte).toBe(true);

    const ailleurs = await creerForfait(
      contexte(SOCIETE_B, Role.admin_societe),
      saisie({ rang: commun.rang, type: commun.type, code: commun.code }),
      "EUR",
      clientApp(),
    );
    expect(
      ailleurs.accepte,
      "le catalogue d'une société bornerait celui d'une autre",
    ).toBe(true);
  });
});

describe("le cloisonnement est tenu par la POLITIQUE, jamais par une comparaison écrite au-dessus", () => {
  it("un forfait d'une autre société est INTROUVABLE, et le refus n'en dit pas plus", async () => {
    const chezB = await creerForfait(
      contexte(SOCIETE_B, Role.admin_societe),
      saisie(),
      "EUR",
      clientApp(),
    );
    expect(chezB.accepte).toBe(true);
    if (!chezB.accepte) {
      return;
    }

    const depuisA = await changerActiviteForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      chezB.id,
      false,
      clientApp(),
    );
    expect(depuisA.accepte).toBe(false);
    if (!depuisA.accepte) {
      // « introuvable » et non « pas à vous » : un message est un canal
      // d'information, soumis au cloisonnement comme une requête (D50).
      expect(depuisA.motif).toBe("introuvable");
    }

    // TÉMOIN : la ligne existe bel et bien, et elle n'a pas bougé.
    const lignes = await clientOwner().$queryRawUnsafe<{ actif: boolean }[]>(
      `SELECT "actif" FROM "forfait" WHERE "id" = $1::uuid`,
      chezB.id,
    );
    expect(lignes[0]!.actif).toBe(true);
  });

  it("et le rôle applicatif ne voit RIEN sans contexte — le témoin du harnais", async () => {
    await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie(),
      "XPF",
      clientApp(),
    );
    const sansContexte = await clientApp().forfait.count();
    expect(sansContexte).toBe(0);
  });
});

describe("une condition POSÉE ne se retire pas, et le refus est NOMMÉ", () => {
  it("la modification qui la retirerait est refusée plutôt que silencieusement ignorée", async () => {
    const cree = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie({ zone_geo: ["grand_noumea"] }),
      "XPF",
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) {
      return;
    }

    const retrait = await modifierForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      cree.id,
      saisie({ zone_geo: null }),
      "XPF",
      clientApp(),
    );
    expect(retrait.accepte).toBe(false);
    if (!retrait.accepte) {
      expect(retrait.motif).toBe("condition_non_retirable");
    }

    // **CE QUE LE REFUS PROTÈGE** : sans lui, l'écriture aurait OMIS la
    // colonne, donc laissé l'ancienne valeur — et l'écran aurait dit
    // « enregistré » sur un forfait dont la condition n'a pas bougé.
    const lignes = await clientOwner().$queryRawUnsafe<
      { zone_geo: string[] }[]
    >(`SELECT "zone_geo" FROM "forfait" WHERE "id" = $1::uuid`, cree.id);
    expect(lignes[0]!.zone_geo).toEqual(["grand_noumea"]);
  });

  it("mais CHANGER une condition, ou en poser une qui n'existait pas, passe", async () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON : le refus vise le
    // RETRAIT, jamais la modification.
    const cree = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie(),
      "XPF",
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) {
      return;
    }

    const pose = await modifierForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      cree.id,
      saisie({ zone_geo: ["nord"] }),
      "XPF",
      clientApp(),
    );
    expect(pose.accepte).toBe(true);

    const lignes = await clientOwner().$queryRawUnsafe<
      { zone_geo: string[] }[]
    >(`SELECT "zone_geo" FROM "forfait" WHERE "id" = $1::uuid`, cree.id);
    expect(lignes[0]!.zone_geo).toEqual(["nord"]);
  });
});

describe("désactiver retire du CHOIX sans toucher au passé", () => {
  it("le forfait reste en base, avec `actif` à faux", async () => {
    const cree = await creerForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      saisie(),
      "XPF",
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) {
      return;
    }

    const eteint = await changerActiviteForfait(
      contexte(SOCIETE_A, Role.admin_societe),
      cree.id,
      false,
      clientApp(),
    );
    expect(eteint.accepte).toBe(true);

    const lignes = await clientOwner().$queryRawUnsafe<{ actif: boolean }[]>(
      `SELECT "actif" FROM "forfait" WHERE "id" = $1::uuid`,
      cree.id,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.actif).toBe(false);
  });
});
