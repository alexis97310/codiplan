import { afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  annulerLeDemarrage,
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";

import { clientApp, clientOwner, sousSocieteEtRole } from "./setup/db";
import {
  INTERVENTION_A2,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L36-ANNULER-DEMARRAGE-10S — D282, décision d'Alexis du 23/11/2026, point 8.
 *
 * ## POURQUOI DES INSTANTS RÉELS, ET NON LES DATES FIXES DU RESTE DE LA SUITE
 *
 * `intervention_cycle_de_vie` (D282) et le déclencheur de suppression de
 * `segment_travail` jugent contre `now()` DE POSTGRES, jamais contre un
 * paramètre — c'est la MARGE SERVEUR qu'ils bornent, et elle n'existe que
 * parce qu'un essai en ligne prend un temps réel à atteindre la base. Des
 * dates fixes de 2026 feraient donc refuser TOUT (la fenêtre serait déjà
 * fermée depuis des mois) : chaque scénario pose son segment à `new Date()`
 * (ou `new Date(Date.now() - …)` pour simuler une fenêtre dépassée).
 *
 * ## L'INTERVENTION, ET POURQUOI `INTERVENTION_A2`
 *
 * `INTERVENTION_A1` est la fixture partagée de `compteur-du-technicien.test.ts`
 * (chemin de production, D160/D120) — y toucher ici ferait deux fichiers se
 * disputer la même ligne. `INTERVENTION_A2` reste `planifiee` partout
 * ailleurs dans la suite ; chaque scénario la restaure dans `afterEach`.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

const session = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const poses: string[] = [];

function sql(
  id: string,
  utilisateurId: string,
  debut: Date,
  fin: Date | null,
): string {
  return `INSERT INTO "segment_travail"
            ("id", "societe_id", "intervention_id", "utilisateur_id", "nom_technicien_affiche", "debut", "fin", "modifie_le")
          VALUES ('${id}', '${SOCIETE_A}', '${INTERVENTION_A2}', '${utilisateurId}',
                  (SELECT "nom" FROM "utilisateur" WHERE "id" = '${utilisateurId}'),
                  TIMESTAMPTZ '${debut.toISOString()}',
                  ${fin === null ? "NULL" : `TIMESTAMPTZ '${fin.toISOString()}'`},
                  now())`;
}

function sousInterne<T>(
  travail: (tx: {
    $executeRawUnsafe: (s: string) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return sousSocieteEtRole(SOCIETE_A, Role.technicien, (tx) => travail(tx));
}

/** Remet INTERVENTION_A2 et ses segments à l'état du semis (`planifiee`, aucun segment). */
afterEach(async () => {
  if (poses.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "id" IN (${poses.map((i) => `'${i}'`).join(",")})`,
    );
    poses.length = 0;
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_piece_remplacee" WHERE "intervention_id" = '${INTERVENTION_A2}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `ALTER TABLE "intervention" DISABLE TRIGGER "intervention_cycle_de_vie"`,
  );
  await clientOwner().$executeRawUnsafe(
    `ALTER TABLE "intervention" DISABLE TRIGGER "intervention_temps_mesure_est_celui_du_compteur"`,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "statut" = 'planifiee', "temps_mesure_min" = NULL
      WHERE "id" = '${INTERVENTION_A2}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `ALTER TABLE "intervention" ENABLE TRIGGER "intervention_temps_mesure_est_celui_du_compteur"`,
  );
  await clientOwner().$executeRawUnsafe(
    `ALTER TABLE "intervention" ENABLE TRIGGER "intervention_cycle_de_vie"`,
  );
});

describe("9L36 — « Annuler le démarrage », dans les dix secondes (D282)", () => {
  describe("le chemin de production (lib/interventions/depot-compteur.ts)", () => {
    it("démarrer puis annuler DANS LA FENÊTRE : affectee, segment disparu, aucun temps compté", async () => {
      const depart = await demarrerLeCompteur(
        session,
        INTERVENTION_A2,
        new Date(),
        clientApp(),
      );
      expect(depart.accepte).toBe(true);
      if (!depart.accepte) throw new Error("démarrage refusé");

      const annulation = await annulerLeDemarrage(
        session,
        new Date(),
        clientApp(),
      );
      expect(annulation).toEqual({
        accepte: true,
        segment: depart.segment,
      });

      const intervention = await clientOwner().intervention.findUniqueOrThrow(
        { where: { id: INTERVENTION_A2 }, select: { statut: true } },
      );
      expect(intervention.statut).toBe("affectee");

      const segment = await clientOwner().segmentTravail.findUnique({
        where: { id: depart.segment.id },
      });
      expect(segment).toBeNull();
    });

    it("après dix secondes (marge réseau comprise) : refusée AVEC SA CLÉ, rien ne change", async () => {
      const id = uuidv7();
      poses.push(id);
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, new Date(Date.now() - 20_000), null)),
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A2}'`,
      );

      expect(await annulerLeDemarrage(session, new Date(), clientApp())).toEqual(
        { accepte: false, cle: "compteur.refus.annulation_expiree" },
      );

      const intervention = await clientOwner().intervention.findUniqueOrThrow(
        { where: { id: INTERVENTION_A2 }, select: { statut: true } },
      );
      expect(intervention.statut).toBe("en_cours");
      expect(
        await clientOwner().segmentTravail.findUnique({ where: { id } }),
      ).not.toBeNull();
    });

    it("un AUTRE technicien a démarré : refusée — ce n'est pas SON segment", async () => {
      const id = uuidv7();
      poses.push(id);
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, UTILISATEUR_INTERNE_A, new Date(), null)),
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A2}'`,
      );

      expect(await annulerLeDemarrage(session, new Date(), clientApp())).toEqual(
        { accepte: false, cle: "compteur.refus.aucun_en_cours" },
      );
    });

    it("une saisie a déjà été faite depuis le démarrage : refusée AVEC SA CLÉ", async () => {
      const depart = await demarrerLeCompteur(
        session,
        INTERVENTION_A2,
        new Date(),
        clientApp(),
      );
      expect(depart.accepte).toBe(true);
      if (!depart.accepte) throw new Error("démarrage refusé");
      // JAMAIS ANNULÉ DANS CE SCÉNARIO (c'est ce qu'il éprouve) : suivi ici
      // pour que `afterEach` le retire, plutôt que de polluer le suivant.
      poses.push(depart.segment.id);

      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_piece_remplacee"
           ("id", "societe_id", "intervention_id", "designation", "rang", "cree_le", "modifie_le")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${INTERVENTION_A2}', 'Courroie', 1, now(), now())`,
      );

      expect(await annulerLeDemarrage(session, new Date(), clientApp())).toEqual(
        { accepte: false, cle: "compteur.refus.annulation_saisie_faite" },
      );
      expect(
        await clientOwner().segmentTravail.findUnique({
          where: { id: depart.segment.id },
        }),
      ).not.toBeNull();
    });

    it("une REPRISE (un segment antérieur existe déjà) : refusée — hors du périmètre de ce bouton", async () => {
      const premier = await demarrerLeCompteur(
        session,
        INTERVENTION_A2,
        new Date(),
        clientApp(),
      );
      expect(premier.accepte).toBe(true);
      if (!premier.accepte) throw new Error("démarrage refusé");
      poses.push(premier.segment.id);
      const arret = await arreterLeCompteur(session, new Date(), clientApp());
      expect(arret.accepte).toBe(true);

      const second = await demarrerLeCompteur(
        session,
        INTERVENTION_A2,
        new Date(),
        clientApp(),
      );
      expect(second.accepte).toBe(true);
      if (!second.accepte) throw new Error("second démarrage refusé");
      // JAMAIS ANNULÉ DANS CE SCÉNARIO (le point même du test) : suivi pour
      // le nettoyage, comme ci-dessus.
      poses.push(second.segment.id);

      expect(await annulerLeDemarrage(session, new Date(), clientApp())).toEqual(
        {
          accepte: false,
          cle: "compteur.refus.annulation_reprise_non_couverte",
        },
      );
    });
  });

  // ── LE DÉCLENCHEUR, SANS LA FONCTION `annulerLeDemarrage` (D282) ─────────
  //
  // Chaque garde fine (même personne, aucune saisie, premier démarrage) ne
  // vit QUE dans `annulerLeDemarrage` (voir son docblock) — mais la fenêtre
  // de temps, elle, est aussi tenue par `intervention_cycle_de_vie`, et
  // SEULEMENT sous `codiplan_app` (voir l'en-tête de la migration) : un
  // essai direct SOUS CE RÔLE, sans passer par `annulerLeDemarrage`, ne doit
  // pas en sortir plus large. `sousInterne` — jamais `clientOwner()`, qui
  // n'est pas le rôle que cette garde surveille — pose donc la transition
  // jugée dans chacun des trois scénarios.

  describe("le déclencheur intervention_cycle_de_vie, directement", () => {
    it("REFUSÉE sans aucun segment ouvert sur l'intervention", async () => {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A2}'`,
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = '${INTERVENTION_A2}'`,
          ),
        ),
      ).rejects.toThrow(/aucun segment ouvert depuis moins de dix secondes/);
    });

    it("REFUSÉE si le seul segment ouvert date de plus de treize secondes", async () => {
      const id = uuidv7();
      poses.push(id);
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, new Date(Date.now() - 20_000), null)),
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A2}'`,
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = '${INTERVENTION_A2}'`,
          ),
        ),
      ).rejects.toThrow(/aucun segment ouvert depuis moins de dix secondes/);
    });

    it("LE JUMEAU : un segment ouvert TOUT JUSTE, et la transition passe", async () => {
      const id = uuidv7();
      poses.push(id);
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, new Date(), null)),
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A2}'`,
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = '${INTERVENTION_A2}'`,
          ),
        ),
      ).resolves.toBe(1);
    });
  });
});
