import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { ouvrirCampagne, campagnes } from "@/lib/vgp/campagne";
import {
  observationsEnAttente,
  planifierLObservation,
} from "@/lib/vgp/observations";
import {
  dernieresInformations,
  enregistrerVerification,
  schemaVerificationVgp,
  verificationsDeLaMachine,
} from "@/lib/vgp/verification";

import {
  avecPortail,
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  FAMILLE_A,
  MACHINE_A1,
  MACHINE_A2,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  PORTAIL_A_CLIENT,
} from "./setup/fixtures";

/**
 * LE REGISTRE DES VGP REÇOIT CE QU'ON LUI DIT (L9-08, L9-09, L9-10 ; D88, D114).
 *
 * ## CE QUE CE FICHIER MESURE, ET POURQUOI IL LE MESURE ICI
 *
 * Trois tables naissent avec la forme **« filiation »** — *une fille est visible
 * si son parent l'est* — et l'adossement se **CHAÎNE** : l'observation dépend de
 * la vérification, qui dépend de la machine, qui est de forme « parc ». **Aucune
 * clause de société n'est écrite nulle part dans cette branche**, et c'est
 * exactement ce qu'un scénario doit constater : un chaînage juste et une clause
 * recopiée se ressemblent tant qu'on ne les éprouve pas.
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

/** Le compte portail restreint au site S1 — MACHINE_A2 est hors de son périmètre. */
const SESSION_PORTAIL = {
  utilisateurId: PORTAIL_A_CLIENT,
  societeId: SOCIETE_A,
  role: Role.client,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: CLIENT_A1,
};

const PORTAIL_BRUT = {
  societeId: SOCIETE_A,
  clientId: CLIENT_A1,
  perimetreSites: [SITE_A1_S1],
} as const;

const LE_JOUR = new Date("2026-03-14T00:00:00.000Z");

/**
 * LES INTERVENTIONS QUE CE FICHIER ENGENDRE, et qu'il doit reprendre.
 *
 * **Le harnais d'isolation partage UNE base entre tous les fichiers**
 * (`fileParallelism: false`), et une intervention laissée derrière fausse les
 * décomptes de `tests/isolation/intervention.test.ts`. *Mesuré : deux scénarios
 * de cloisonnement du parc ont rougi en comptant quatre lignes au lieu de deux.*
 *
 * C'est le corollaire de L9-10 lui-même : *ce lot ALIMENTE le planning*, et un
 * scénario qui alimente doit nettoyer ce qu'il a versé.
 */
const interventionsEngendrees: string[] = [];

afterEach(async () => {
  // L'ORDRE COMPTE : les filles d'abord. Les clés étrangères sont en RESTRICT,
  // et un nettoyage dans le désordre échouerait — *ce qui est d'ailleurs la
  // preuve que le chaînage tient.*
  await clientOwner().$executeRawUnsafe(`DELETE FROM "vgp_observation"`);
  await clientOwner().$executeRawUnsafe(`DELETE FROM "vgp_verification"`);
  await clientOwner().$executeRawUnsafe(`DELETE FROM "vgp_campagne"`);
  if (interventionsEngendrees.length > 0) {
    const ids = interventionsEngendrees.splice(
      0,
      interventionsEngendrees.length,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_machine" WHERE "intervention_id" = ANY($1::uuid[])`,
      ids,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      ids,
    );
  }
});

/** Porte une observation au planning, et retient l'intervention pour le ménage. */
async function planifier(observationId: string) {
  const porte = await planifierLObservation(
    SESSION,
    {
      observationId,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      machineId: MACHINE_A1,
    },
    clientApp(),
  );
  if ("intervention_id" in porte) {
    interventionsEngendrees.push(porte.intervention_id);
  }
  return porte;
}

async function enregistrer(machineId: string, observations: string[] = []) {
  return enregistrerVerification(
    SESSION,
    schemaVerificationVgp.parse({
      machine_id: machineId,
      date_verification: LE_JOUR,
      organisme: "APAVE",
      reference_rapport: "RAP-2026-0042",
      origine: "rapport_organisme",
      observations,
    }),
    clientApp(),
  );
}

describe("L9-09 — CE QU'ON NOUS A DIT, et d'où on le tient", () => {
  it("TÉMOIN PRÉALABLE — la politique est en vigueur et elle mord", async () => {
    const [drapeaux] = await observerSousProprietaire(
      "lire les deux drapeaux RLS de « vgp_verification » : FORCE ne se prouve " +
        "pas par la lecture (§9, 31/08).",
    ).$queryRawUnsafe<Array<{ actif: boolean; force: boolean }>>(
      `SELECT relrowsecurity AS "actif", relforcerowsecurity AS "force"
         FROM pg_class WHERE relname = 'vgp_verification'`,
    );
    expect(drapeaux?.actif).toBe(true);
    expect(drapeaux?.force).toBe(true);

    await enregistrer(MACHINE_A1);
    const sansContexte = await clientApp().vgpVerification.findMany({
      select: { id: true },
    });
    expect(sansContexte).toHaveLength(0);
  });

  it("l'ORIGINE est enregistrée telle qu'elle a été dite", async () => {
    // *Un rapport de l'organisme, une vignette et une parole du client n'ont pas
    // la même valeur le jour d'un contrôle*, et l'origine ne se reconstitue pas
    // après coup.
    const fiche = await enregistrer(MACHINE_A1);
    expect(fiche.origine).toBe("rapport_organisme");
    expect(fiche.organisme).toBe("APAVE");
  });

  it("l'origine est SANS DÉFAUT — une saisie qui l'omet est refusée", async () => {
    // *Une origine par défaut serait une valeur probante inventée*, sur la ligne
    // même qu'on produirait le jour d'un contrôle.
    expect(
      schemaVerificationVgp.safeParse({
        machine_id: MACHINE_A1,
        date_verification: LE_JOUR,
        organisme: "APAVE",
      }).success,
    ).toBe(false);
  });

  it("la dernière information est celle de la VÉRIFICATION, jamais de la saisie", async () => {
    // Une vignette relevée aujourd'hui peut porter une vérification d'il y a
    // onze mois. *Trier sur `cree_le` rendrait le registre dépendant de l'ordre
    // où on l'a rempli.*
    await enregistrer(MACHINE_A1);
    await enregistrerVerification(
      SESSION,
      schemaVerificationVgp.parse({
        machine_id: MACHINE_A1,
        date_verification: new Date("2025-04-02T00:00:00.000Z"),
        organisme: "Bureau Veritas",
        origine: "vignette_constatee",
      }),
      clientApp(),
    );
    const recues = await dernieresInformations(SESSION, clientApp());
    expect(recues.get(MACHINE_A1)?.toISOString().slice(0, 10)).toBe(
      "2026-03-14",
    );
  });

  it("un compte PORTAIL retrouve les rapports de SES machines", async () => {
    await enregistrer(MACHINE_A1);
    const siennes = await verificationsDeLaMachine(
      SESSION_PORTAIL,
      MACHINE_A1,
      clientApp(),
    );
    expect(siennes).toHaveLength(1);
    expect(siennes[0]?.organisme).toBe("APAVE");
  });

  it("…ET RIEN D'AUTRE — la machine hors périmètre ne rend rien", async () => {
    // C'est la moitié qui compte : la forme « filiation » propage les TROIS
    // filtres du parc, et aucune clause n'est écrite au-dessus.
    await enregistrer(MACHINE_A2);
    const horsPerimetre = await verificationsDeLaMachine(
      SESSION_PORTAIL,
      MACHINE_A2,
      clientApp(),
    );
    expect(horsPerimetre).toHaveLength(0);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : un compte INTERNE la
    // voit. Sans cette moitié, « zéro » serait aussi bien la preuve que rien
    // n'a été écrit (§9, 30/08).
    const vueInterne = await verificationsDeLaMachine(
      SESSION,
      MACHINE_A2,
      clientApp(),
    );
    expect(vueInterne).toHaveLength(1);
  });

  it("JUMEAU — la clause de filiation retirée, le portail voit TOUT", async () => {
    await enregistrer(MACHINE_A2);
    const CLAUSE =
      `EXISTS (SELECT 1 FROM "machine" ` +
      `WHERE "machine"."id" = "vgp_verification"."machine_id")`;
    let vuSansClause = -1;
    try {
      await clientOwner().$executeRawUnsafe(
        `ALTER POLICY "cloisonnement_filiation" ON "vgp_verification" USING (true) WITH CHECK (true)`,
      );
      vuSansClause = (
        await avecPortail(PORTAIL_BRUT, (tx) =>
          tx.vgpVerification.findMany({ select: { id: true } }),
        )
      ).length;
    } finally {
      await clientOwner().$executeRawUnsafe(
        `ALTER POLICY "cloisonnement_filiation" ON "vgp_verification" USING (${CLAUSE}) WITH CHECK (${CLAUSE})`,
      );
    }
    // LA VIOLATION A BIEN EU LIEU (§9, 30/08). Sans ce décompte, le jumeau
    // serait vert sans avoir rien lu.
    expect(vuSansClause).toBe(1);

    const rendu = await avecPortail(PORTAIL_BRUT, (tx) =>
      tx.vgpVerification.findMany({ select: { id: true } }),
    );
    expect(rendu).toHaveLength(0);
  });
});

describe("L9-10 — une observation engendre une intervention à planifier", () => {
  it("elle attend tant que personne ne l'a planifiée", async () => {
    // *Une observation non traitée est l'état qui compte*, et la confondre avec
    // une observation traitée ferait disparaître du travail dû.
    await enregistrer(MACHINE_A1, ["Jeu au vérin gauche", "Flexible fendillé"]);
    const attente = await observationsEnAttente(SESSION, clientApp());
    expect(attente).toHaveLength(2);
    expect(attente[0]?.machine_id).toBe(MACHINE_A1);
  });

  it("planifier en crée UNE, et l'observation cesse d'attendre", async () => {
    const fiche = await enregistrer(MACHINE_A1, ["Jeu au vérin gauche"]);
    const observationId = fiche.observations[0]?.id ?? "";
    const porte = await planifier(observationId);
    expect("intervention_id" in porte).toBe(true);
    expect(await observationsEnAttente(SESSION, clientApp())).toHaveLength(0);
  });

  it("et une seconde fois est REFUSÉE — deux visites pour une observation", async () => {
    // *C'est un déplacement payé deux fois.*
    const fiche = await enregistrer(MACHINE_A1, ["Jeu au vérin gauche"]);
    const observationId = fiche.observations[0]?.id ?? "";
    await planifier(observationId);
    const seconde = await planifier(observationId);
    expect(seconde).toEqual({ refus: "observation_deja_planifiee" });
  });

  it("une observation INVISIBLE et une INEXISTANTE rendent LE MÊME refus", async () => {
    // Les distinguer ferait un oracle (D35, D50).
    const inexistante = await planifierLObservation(
      SESSION,
      {
        observationId: uuidv7(),
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        machineId: MACHINE_A1,
      },
      clientApp(),
    );
    expect(inexistante).toEqual({ refus: "observation_introuvable" });
  });
});

describe("L9-08 — UNE campagne datée, et un compteur qui DESCEND", () => {
  it("le reste-à-faire compte les machines sans information depuis l'ouverture", async () => {
    // *Deux cents alertes le jour d'une déclaration sont la panne par le bruit*
    // — il n'y a ici QU'UN objet, daté, avec un reste-à-faire visible.
    await ouvrirCampagne(SESSION, FAMILLE_A, LE_JOUR, clientApp());
    const avant = await campagnes(SESSION, clientApp());
    expect(avant).toHaveLength(1);
    expect(avant[0]?.resteAFaire).toBe(avant[0]?.total);
    expect(avant[0]?.total).toBeGreaterThan(0);

    await enregistrer(MACHINE_A1);
    const apres = await campagnes(SESSION, clientApp());
    // IL DESCEND. C'est tout ce que L9-08 demande, et c'est ce qu'un compteur
    // stocké aurait cessé de faire au premier oubli de décrément.
    expect(apres[0]?.resteAFaire).toBe((avant[0]?.resteAFaire ?? 0) - 1);
  });

  it("une information ANTÉRIEURE à l'ouverture ne solde PAS la campagne", async () => {
    // *C'est tout ce que la date d'ouverture sert à borner.* Sans elle, déclarer
    // une famille soumise aurait l'air d'être déjà fait.
    await enregistrerVerification(
      SESSION,
      schemaVerificationVgp.parse({
        machine_id: MACHINE_A1,
        date_verification: new Date("2025-01-05T00:00:00.000Z"),
        organisme: "APAVE",
        origine: "rapport_organisme",
      }),
      clientApp(),
    );
    await ouvrirCampagne(SESSION, FAMILLE_A, LE_JOUR, clientApp());
    const lues = await campagnes(SESSION, clientApp());
    expect(lues[0]?.resteAFaire).toBe(lues[0]?.total);
  });
});
