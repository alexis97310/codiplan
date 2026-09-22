import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  historiqueDeLaMachine,
  teteDeLHistorique,
} from "@/lib/machines/historique";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  MODELE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * L'APERÇU DU PARC NE RAMÈNE QUE CE QU'IL AFFICHE (PARC-1).
 *
 * `app/(back-office)/parc/page.tsx` montrait trois événements en appelant
 * `historiqueDeLaMachine` — sans `take` — puis `.slice(0, 3)` : la requête
 * ramenait TOUT l'historique de la machine, et la page en jetait tout sauf
 * trois lignes. Anodin sur un parc de démonstration ; depuis le 22/09/2026,
 * la base de production porte 1751 interventions d'archive et 298
 * vérifications VGP, et une machine qui a quinze ans de factures fait
 * traverser quinze ans de lignes au réseau à chaque survol de l'aperçu.
 *
 * **Ce fichier compte les lignes que la requête RAMÈNE, jamais celles que la
 * page affiche.** Une épreuve qui vérifierait « trois lignes à l'écran »
 * passerait aussi avec l'ancien code — la page tronquait déjà — et ne
 * prouverait rien. Il monte donc une machine à N interventions, N franchement
 * supérieur à trois, et mesure des deux côtés : la lecture complète rend N,
 * la lecture bornée rend exactement la borne.
 *
 * ## Ce qu'il tient aussi, et pourquoi
 *
 * *La fiche n'a pas bougé.* `app/(back-office)/parc/[id]/page.tsx` appelle
 * `historiqueDeLaMachine` légitimement sans troncature ; ce fichier exige
 * qu'elle rende toujours N — le cas qui doit rester vert pour sa propre raison
 * (§9, 11/09), sans quoi borner la lecture partagée ferait passer ce
 * scénario en amputant la fiche.
 *
 * *La tête est bien la TÊTE.* Les lignes bornées sont les premières de la
 * lecture complète, dans le même ordre : deux requêtes d'un même critère
 * divergent en silence (§9, 01/09), et c'est ce qui les confronte.
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

/**
 * UNE MACHINE POSÉE EXPRÈS, avec un historique que nul autre scénario du
 * harnais ne partage : `MACHINE_A1` porte deux interventions dont
 * `historique-machine.test.ts` compare les identifiants avant et après un
 * déménagement — lui en ajouter quinze ferait mesurer à ce scénario-là autre
 * chose que ce qu'il annonce.
 *
 * **Quinze interventions** — « quinze ans de factures », une par an —, datées
 * LOIN DANS LE FUTUR et non `NULL` : une `date_planifiee` nulle range la
 * fiche dans la file d'attente, que d'autres scénarios dénombrent sur toute
 * la société (`file-attente.test.ts`). Des dates DISTINCTES, pour que l'ordre
 * « du plus récent au plus ancien » soit sans ambiguïté : le `numero`, second
 * critère de tri, est attribué par le serveur et vaut `NULL` ici.
 */
const MACHINE_QUINZE_ANS = "aaaaaaaa-0000-7000-8000-00000000a151";
const QR_QUINZE_ANS = "Q15ZANSXWB2NRJ5FHCV3PDGSA6";
const NOMBRE_D_INTERVENTIONS = 15;
const LIGNES_DE_L_APERCU = 3;

function idIntervention(rang: number): string {
  return `aaaaaaaa-0000-7000-8000-0000000151${String(rang).padStart(2, "0")}`;
}

function idRattachement(rang: number): string {
  return `aaaaaaaa-0000-7000-8000-0000000152${String(rang).padStart(2, "0")}`;
}

/** Une date par an, à partir de 2099 — hors de portée de tout comptage daté. */
function dateDuRang(rang: number): string {
  return `${2099 + rang}-01-01`;
}

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "qr_token", "numero_serie", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, 'SN-PARC-1', now())
     ON CONFLICT ("id") DO NOTHING`,
    MACHINE_QUINZE_ANS,
    SOCIETE_A,
    MODELE_A,
    CLIENT_A1,
    SITE_A1_S1,
    QR_QUINZE_ANS,
  );
  for (let rang = 0; rang < NOMBRE_D_INTERVENTIONS; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'terminee', NULL, $6::date, now())
       ON CONFLICT ("id") DO NOTHING`,
      idIntervention(rang),
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      dateDuRang(rang),
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
       ON CONFLICT ("id") DO NOTHING`,
      idRattachement(rang),
      SOCIETE_A,
      idIntervention(rang),
      MACHINE_QUINZE_ANS,
    );
  }
});

afterAll(async () => {
  // Le rattachement suit l'intervention (`ON DELETE CASCADE`, la seule du
  // dépôt) ; la machine part en dernier, ses filles n'existant plus.
  for (let rang = 0; rang < NOMBRE_D_INTERVENTIONS; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      idIntervention(rang),
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" = $1::uuid`,
    MACHINE_QUINZE_ANS,
  );
});

/**
 * LE TÉMOIN — la machine porte bien ses quinze rattachements EN BASE, lus
 * sous le propriétaire, avant qu'une seule assertion ne soit tirée. Sans lui,
 * un `INSERT` qui n'aurait rien inséré ferait rendre zéro aux deux lectures,
 * et zéro est inférieur à trois (§9, 30/08 — un décompte nul ressemble
 * toujours à un sans-faute).
 */
async function temoinDesRattachements(): Promise<void> {
  const [ligne] = await clientOwner().$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM "intervention_machine"
      WHERE "societe_id" = $1::uuid AND "machine_id" = $2::uuid`,
    SOCIETE_A,
    MACHINE_QUINZE_ANS,
  );
  expect(ligne?.n).toBe(NOMBRE_D_INTERVENTIONS);
}

describe("l'aperçu du parc ne ramène que ce qu'il affiche (PARC-1)", () => {
  it("AVANT — la lecture complète ramène les QUINZE lignes : c'est ce que l'aperçu recevait pour en afficher trois", async () => {
    await temoinDesRattachements();
    const complet = await historiqueDeLaMachine(
      SESSION,
      MACHINE_QUINZE_ANS,
      clientApp(),
    );
    expect(complet).toHaveLength(NOMBRE_D_INTERVENTIONS);
  });

  it("APRÈS — la lecture bornée à trois ramène EXACTEMENT trois lignes, pas quinze tronquées", async () => {
    await temoinDesRattachements();
    const tete = await teteDeLHistorique(
      SESSION,
      MACHINE_QUINZE_ANS,
      LIGNES_DE_L_APERCU,
      clientApp(),
    );
    expect(tete).toHaveLength(LIGNES_DE_L_APERCU);
  });

  it("la tête est bien la TÊTE — les mêmes lignes, dans le même ordre, que le début de la lecture complète", async () => {
    await temoinDesRattachements();
    const [complet, tete] = await Promise.all([
      historiqueDeLaMachine(SESSION, MACHINE_QUINZE_ANS, clientApp()),
      teteDeLHistorique(
        SESSION,
        MACHINE_QUINZE_ANS,
        LIGNES_DE_L_APERCU,
        clientApp(),
      ),
    ]);
    expect(tete.map((l) => l.id)).toEqual(
      complet.slice(0, LIGNES_DE_L_APERCU).map((l) => l.id),
    );
    // Et « la plus récente d'abord » se lit sur les dates elles-mêmes : la
    // tête commence par la dernière année posée, jamais par la première.
    expect(tete[0]?.date_planifiee?.toISOString().slice(0, 10)).toBe(
      dateDuRang(NOMBRE_D_INTERVENTIONS - 1),
    );
  });

  it("LA FICHE N'A PAS BOUGÉ — la lecture complète rend toujours quinze lignes après que la bornée existe", async () => {
    // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09) : borner
    // la lecture partagée plutôt qu'en ajouter une ferait passer les trois
    // scénarios ci-dessus et amputerait `/parc/[id]` en silence.
    await temoinDesRattachements();
    const complet = await historiqueDeLaMachine(
      SESSION,
      MACHINE_QUINZE_ANS,
      clientApp(),
    );
    expect(complet.length).toBeGreaterThan(LIGNES_DE_L_APERCU);
    expect(complet).toHaveLength(NOMBRE_D_INTERVENTIONS);
  });

  it("une borne qui n'est pas un entier strictement positif est REFUSÉE avant toute requête", async () => {
    // Prisma lit un `take` négatif comme « depuis la FIN » : `-3` rendrait
    // les trois plus anciennes sous le titre « derniers événements », sans
    // qu'aucune ligne ne manque ni ne rougisse. Un zéro rendrait un état vide
    // sur une machine qui a un historique. Ni l'un ni l'autre n'est une borne.
    for (const borne of [0, -3, 1.5, Number.NaN]) {
      await expect(
        teteDeLHistorique(SESSION, MACHINE_QUINZE_ANS, borne, clientApp()),
      ).rejects.toThrow(/entier strictement positif/);
    }
  });
});
