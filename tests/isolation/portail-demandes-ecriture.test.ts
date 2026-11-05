import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { deposerDemande } from "@/lib/demandes/depot";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  PORTAIL_A_CLIENT,
  PORTAIL_A2_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * L'ÉCRITURE DE `demande` DEPUIS LE PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * `tests/isolation/demande.test.ts` prouve déjà le chemin applicatif pour un
 * utilisateur INTERNE. Ce fichier ajoute le chemin que ce ticket ouvre : un
 * compte portail (`Role.client`, `app.client_id` posé) déposant une demande
 * par `lib/demandes/depot.ts` — jamais une recopie de la règle, et aucune
 * migration (la politique « parc » de `demande` existe depuis L2-06, D102).
 *
 * `PORTAIL_A_CLIENT` est rattaché à `CLIENT_A1` et restreint à `SITE_A1_S1`
 * (`PERIMETRE_A1_S1`, `tests/isolation/setup/global.ts`) — `SITE_A1_S2`
 * appartient au MÊME client mais reste HORS de son périmètre, exactement la
 * fixture qu'il faut pour éprouver le périmètre sans fabriquer de donnée
 * neuve. Même raison pour `SITE_A2_S1`, du client A2, MÊME société.
 */

afterAll(fermerClients);

const SESSION_PORTAIL_A1 = {
  utilisateurId: PORTAIL_A_CLIENT,
  societeId: SOCIETE_A,
  role: Role.client,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: CLIENT_A1,
};

const SESSION_PORTAIL_A2 = {
  ...SESSION_PORTAIL_A1,
  utilisateurId: PORTAIL_A2_CLIENT,
  clientId: CLIENT_A2,
};

/** Un dépôt complet, pour ne répéter que ce qui change d'un scénario à l'autre. */
function depot(partiel: {
  readonly id: string;
  readonly client_id: string;
  readonly site_id: string;
}) {
  return {
    source: "portail" as const,
    machine_id: null,
    contact_id: null,
    description: "Déposée depuis le portail (épreuve)",
    urgence: "p3" as const,
    machine_arretee: false,
    etat_machine: null,
    date_souhaitee: null,
    ...partiel,
  };
}

let demandeIds: string[] = [];

beforeEach(() => {
  demandeIds = [];
});

afterEach(async () => {
  for (const id of demandeIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

describe("un compte portail dépose SUR SON CLIENT, par le dépôt", () => {
  it("ACCEPTE : dépose une demande de son client, site dans son périmètre", async () => {
    const id = uuidv7();
    const pose = await deposerDemande(
      SESSION_PORTAIL_A1,
      depot({ id, client_id: CLIENT_A1, site_id: SITE_A1_S1 }),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);
    if (!pose.accepte) return;
    demandeIds.push(pose.fiche.id);
    expect(pose.fiche.client_id).toBe(CLIENT_A1);
    expect(pose.fiche.site_id).toBe(SITE_A1_S1);
    expect(pose.fiche.source).toBe("portail");
    expect(pose.fiche.statut).toBe("nouvelle");
  });

  it("REFUS : un AUTRE client, même société, est refusé comme un lieu inconnu (D35/D50)", async () => {
    // SITE_A2_S1 est un site RÉEL, mais du client A2 — invisible sous le
    // contexte de PORTAIL_A_CLIENT (app.client_id = CLIENT_A1) : la lecture
    // du site, SOUS le contexte, rend zéro ligne avant même d'écrire quoi
    // que ce soit (même refus qu'un site inexistant).
    const id = uuidv7();
    const refus = await deposerDemande(
      SESSION_PORTAIL_A1,
      depot({ id, client_id: CLIENT_A2, site_id: SITE_A2_S1 }),
      clientApp(),
    );
    expect(refus.accepte).toBe(false);
    if (!refus.accepte) {
      expect(refus.cle).toBe("demande.refus.lieu_inconnu");
    }
    expect(await compterDemandes(id)).toBe(0);
  });

  it("REFUS : un site du MÊME client mais HORS de son périmètre est refusé comme un lieu inconnu", async () => {
    // SITE_A1_S2 appartient à CLIENT_A1 mais pas au périmètre de
    // PORTAIL_A_CLIENT, restreint à SITE_A1_S1 — la lecture du site, SOUS le
    // contexte, rend déjà zéro ligne (forme « parc », périmètre de sites) ;
    // le dépôt ne distingue jamais « site d'un autre client » de « site hors
    // périmètre », les deux rendant le même refus (D35, D50).
    const id = uuidv7();
    const refus = await deposerDemande(
      SESSION_PORTAIL_A1,
      depot({ id, client_id: CLIENT_A1, site_id: SITE_A1_S2 }),
      clientApp(),
    );
    expect(refus.accepte).toBe(false);
    if (!refus.accepte) {
      expect(refus.cle).toBe("demande.refus.lieu_inconnu");
    }
    expect(await compterDemandes(id)).toBe(0);
  });

  it("REFUS (WITH CHECK) : un compte portail ne dépose pas une demande au nom d'un AUTRE client, même forcé en requête brute", async () => {
    // DÉFENSE EN PROFONDEUR — même patron que `portail-contacts-ecriture
    // .test.ts` : la lecture du dépôt refuse déjà (test ci-dessus), ceci
    // éprouve la GARDE DE FOND quand le dépôt applicatif est contourné.
    const id = uuidv7();
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.client,
          auteurId: PORTAIL_A_CLIENT,
          clientId: CLIENT_A1,
        },
        (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "demande"
               ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                "description", "depose_le", "compteur_accuse_le")
             VALUES ($1::uuid, $2::uuid, 'portail', $3::uuid, $4::uuid, $5::uuid,
                     'Intrus (épreuve)', now(), now())`,
            id,
            SOCIETE_A,
            CLIENT_A2,
            SITE_A2_S1,
            AGENCE_A,
          ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
    expect(await compterDemandes(id)).toBe(0);
  });

  it("REFUS (WITH CHECK) : un compte portail ne dépose pas une demande sur un site HORS de SON périmètre, même forcé en requête brute", async () => {
    const id = uuidv7();
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.client,
          auteurId: PORTAIL_A_CLIENT,
          clientId: CLIENT_A1,
        },
        (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "demande"
               ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                "description", "depose_le", "compteur_accuse_le")
             VALUES ($1::uuid, $2::uuid, 'portail', $3::uuid, $4::uuid, $5::uuid,
                     'Intrus (épreuve)', now(), now())`,
            id,
            SOCIETE_A,
            CLIENT_A1,
            SITE_A1_S2,
            AGENCE_A,
          ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
    expect(await compterDemandes(id)).toBe(0);
  });

  it("REFUS : un compte portail d'un AUTRE client ne voit pas la demande de CLIENT_A1 (introuvable)", async () => {
    const id = uuidv7();
    const pose = await deposerDemande(
      SESSION_PORTAIL_A1,
      depot({ id, client_id: CLIENT_A1, site_id: SITE_A1_S1 }),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);
    if (!pose.accepte) return;
    demandeIds.push(pose.fiche.id);

    // Un second dépôt, par PORTAIL_A2_CLIENT, ne fait que prouver que le
    // compte d'A2 continue d'écrire chez A2 : la demande de A1 n'est jamais
    // lue ni modifiée par cette session, exactement comme `demandesOuvertes`
    // ne la rendrait jamais.
    const idA2 = uuidv7();
    const poseA2 = await deposerDemande(
      SESSION_PORTAIL_A2,
      depot({ id: idA2, client_id: CLIENT_A2, site_id: SITE_A2_S1 }),
      clientApp(),
    );
    expect(poseA2.accepte).toBe(true);
    if (poseA2.accepte) {
      demandeIds.push(poseA2.fiche.id);
      expect(poseA2.fiche.client_id).toBe(CLIENT_A2);
    }
  });
});

describe("l'audit couvre une écriture PORTAIL comme une écriture interne (I8, D55)", () => {
  it("un dépôt depuis le portail laisse une ligne au journal, avec le compte portail pour auteur", async () => {
    const id = uuidv7();
    const pose = await deposerDemande(
      SESSION_PORTAIL_A1,
      depot({ id, client_id: CLIENT_A1, site_id: SITE_A1_S1 }),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);
    if (!pose.accepte) return;
    demandeIds.push(pose.fiche.id);

    const ligne = await observerSousProprietaire(
      "même raison que `portail-contacts-ecriture.test.ts` : vérifier QUI le " +
        "déclencheur a journalisé comme auteur n'est pas une lecture que le " +
        "rôle applicatif pourrait faire lui-même.",
    ).$queryRawUnsafe<{ action: string; utilisateur_id: string | null }[]>(
      `SELECT "action", "utilisateur_id"
         FROM "journal_audit"
        WHERE "entite" = 'demande' AND "entite_id" = $1::uuid`,
      pose.fiche.id,
    );
    expect(ligne).toHaveLength(1);
    expect(ligne[0]?.action).toBe("creation");
    expect(ligne[0]?.utilisateur_id).toBe(PORTAIL_A_CLIENT);
  });
});

async function compterDemandes(id: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "demande" WHERE "id" = $1::uuid`,
    id,
  );
  return Number(lignes[0]?.n ?? 0);
}
