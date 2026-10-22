import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  cloturerIntervention,
  validerRapport,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * RG-INT-03 (D135, 9H1) — PAS DE CLÔTURE SANS RAPPORT VALIDÉ, ÉPROUVÉ SUR LA
 * VRAIE BASE.
 *
 * Même discipline que `droits-cycle-de-vie.test.ts` : une ligne JETABLE,
 * copiée de `INTERVENTION_A1` (même société, même site), jamais la ligne
 * partagée elle-même — ce fichier mute un statut, et `INTERVENTION_A1` sert
 * de décor à des dizaines d'autres scénarios qui tiennent pour acquis
 * qu'elle reste `planifiee`.
 *
 * Deux garanties : le PÉRIMÈTRE (le ○ n'existe pas pour `valider_rapport` —
 * aucun rôle restreint, donc un rôle sans le ● complet n'atteint jamais le
 * dépôt) et le CLOISONNEMENT (la société B ne voit pas le rapport de A).
 */

afterAll(fermerClients);

const RESPONSABLE_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.responsable_materiel] as string,
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

// `adv` N'A AUCUNE LIGNE dans la matrice pour `valider_rapport` (maquette
// `CAN.valider`, « jamais l'ADV ») — contrairement à `cloturer_intervention`,
// où il a le ● complet.
const ADV_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv] as string,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const RESPONSABLE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];
const tauxPoses: string[] = [];

/** Le taux horaire qu'exige `cloturerIntervention` pour valoriser (D83). */
async function poserLeTaux(): Promise<void> {
  const id = uuidv7();
  tauxPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
     VALUES ('${id}', '${SOCIETE_A}', DATE '2020-01-01', 5000, 'XPF')
     ON CONFLICT DO NOTHING`,
  );
}

/** Une jetable « terminee », copiée de INTERVENTION_A1, avec son rapport. */
async function jetable(commentaireTechnicien: string | null): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","commentaire_technicien","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'terminee', ${
              commentaireTechnicien === null
                ? "NULL"
                : `'${commentaireTechnicien}'`
            }, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

/**
 * LE TEMPS MESURÉ NE SE SAISIT PAS — il est la somme des segments FERMÉS du
 * compteur (`intervention_temps_mesure_est_celui_du_compteur`) : poser un
 * segment clos de `minutes` plutôt qu'écrire la colonne directement.
 */
async function poserUnSegmentFerme(id: string, minutes: number): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${RESPONSABLE_A.utilisateurId}',
             now() - interval '${minutes} minutes', now(), now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "temps_mesure_min" = ${minutes} WHERE "id" = '${id}'`,
  );
}

async function rapportEnBase(
  id: string,
): Promise<{ par: string | null; le: Date | null }> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ rapport_valide_par: string | null; rapport_valide_le: Date | null }>
  >(
    `SELECT "rapport_valide_par", "rapport_valide_le" FROM "intervention" WHERE "id" = '${id}'`,
  );
  return {
    par: ligne?.rapport_valide_par ?? null,
    le: ligne?.rapport_valide_le ?? null,
  };
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    // LE SEGMENT D'ABORD : `segment_travail.intervention` est `onDelete:
    // Restrict` (schema.prisma) — supprimer l'intervention avant lui échoue.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
  for (const id of tauxPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${id}'`,
    );
  }
});

describe("validerRapport — RG-INT-03 (D135)", () => {
  it("un responsable valide le rapport d'une terminee qui en porte un", async () => {
    const id = await jetable("Le compresseur a été changé.");

    const resultat = await validerRapport(RESPONSABLE_A, id, clientApp());
    expect(resultat.accepte).toBe(true);

    const apres = await rapportEnBase(id);
    expect(apres.par).toBe(RESPONSABLE_A.utilisateurId);
    expect(apres.le).not.toBeNull();
  });

  it("refuse SANS rapport écrit — valider du vide n'est pas un geste", async () => {
    const id = await jetable(null);

    const resultat = await validerRapport(RESPONSABLE_A, id, clientApp());
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.rapport_absent",
    });
  });

  // LE ○ N'EXISTE PAS (mesuré dans `lib/auth/habilitations.ts`, maquette
  // « jamais l'ADV ») : l'ADV a le ● complet sur `cloturer_intervention`
  // juste à côté, et « aucun » ici — même fonction `accesSurCetteIntervention`
  // que `cloturerIntervention`, une capacité différente.
  it("un rôle sans le droit (ADV) est refusé — et rien ne change en base", async () => {
    const id = await jetable("Le compresseur a été changé.");

    const resultat = await validerRapport(ADV_A, id, clientApp());
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.inconnue",
    });

    const apres = await rapportEnBase(id);
    expect(apres.par).toBeNull();
  });

  // LE CLOISONNEMENT : la société B ne voit pas l'intervention de A — hors
  // périmètre et inexistante rendent LA MÊME chose (D35, D50).
  it("la société B ne valide pas le rapport de la société A", async () => {
    const id = await jetable("Le compresseur a été changé.");

    const resultat = await validerRapport(RESPONSABLE_B, id, clientApp());
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.inconnue",
    });

    const apres = await rapportEnBase(id);
    expect(apres.par).toBeNull();
  });
});

describe("cloturerIntervention — refuse tant que le rapport n'est pas validé (RG-INT-03)", () => {
  it("refuse une terminee au rapport NON validé, même temps mesuré", async () => {
    const id = await jetable("Le compresseur a été changé.");
    await poserUnSegmentFerme(id, 60);

    const resultat = await cloturerIntervention(
      RESPONSABLE_A,
      { intervention_id: id, temps_valide_min: 60 },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.rapport_non_valide",
    });
  });

  it("passe une fois le rapport validé — le cas qui DOIT rester vert", async () => {
    await poserLeTaux();
    const id = await jetable("Le compresseur a été changé.");
    await poserUnSegmentFerme(id, 60);

    const valide = await validerRapport(RESPONSABLE_A, id, clientApp());
    expect(valide.accepte).toBe(true);

    const resultat = await cloturerIntervention(
      RESPONSABLE_A,
      { intervention_id: id, temps_valide_min: 60 },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});
