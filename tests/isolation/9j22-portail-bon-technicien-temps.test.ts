import { afterAll, describe, expect, it } from "vitest";

import { bonInterventionDuParc } from "@/app/(portail)/portail/interventions/depot";
import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import {
  avecPortail,
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9J22-PORTAIL-BON-TECHNICIEN-TEMPS — LE NOM DU TECHNICIEN ET LES TEMPS
 * PASSÉS, SUR LE BON VU PAR LE CLIENT, POUR SES PROPRES INTERVENTIONS SEULES.
 *
 * Décision d'Alexis (06/11/2026, « Oui, les deux »). La migration
 * `20261107050000_portail_bon_technicien_temps_9j22` avait ajouté DEUX
 * politiques permissives, forme « filiation » scopée au contexte portail —
 * une sur `segment_travail`, une sur `utilisateur`.
 *
 * **REVU PAR 9J22A-REPRISE-9J22 (décision d'Alexis du 07/11/2026 ~12:15) :**
 * la politique sur `utilisateur` rendait TOUTE la ligne d'un technicien (dont
 * l'adresse électronique) à son client, et seule la discipline d'un appelant
 * (`lib/auth/annuaire.ts`), jamais la base, en bornait l'usage aux colonnes
 * `{id, nom}`. La migration `..._portail_nom_technicien_recopie_9j22a` la
 * RETIRE : `utilisateur` referme sa branche de rattachement au contexte
 * portail, sans aucune exception, et le nom affiché du technicien vient
 * désormais de `segment_travail.nom_technicien_affiche`, recopié une seule
 * fois à la naissance du segment. Seule la politique de `segment_travail`
 * (inchangée par 9J22A) subsiste, et ce fichier éprouve SA clause RÉELLE
 * plutôt que de la supposer — même discipline que `politiques-rls.test.ts`.
 *
 * Même geste que `9j08a-portail-bon.test.ts` : une intervention JETABLE,
 * jamais le fixture partagé `INTERVENTION_A1`, pour ne muter aucun état que
 * d'autres fichiers lisent en parallèle.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;
/** « Compte technicien » — posé par le harnais (`setup/global.ts`). */
const NOM_TECHNICIEN = `Compte ${Role.technicien}`;

afterAll(fermerClients);

function contextePortail(
  utilisateurId: string,
  clientId: string,
): ContexteSession {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId,
  };
}

/**
 * Une intervention JETABLE, CLÔTURÉE, du client A1, sur le site de son
 * périmètre, AVEC un segment de travail fermé — un aller du technicien
 * canonique, 60 minutes. Même rattachements qu'`INTERVENTION_A1`, copiés
 * plutôt que recopiés à la main : `technicien_id` en particulier doit rester
 * EXACTEMENT celui que `TECHNICIEN` nomme ci-dessus.
 */
async function surUneInterventionAvecSegment(
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  const segmentId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "duree_estimee_min",
       "modifie_le", "cloturee_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif'::"TypeIntervention", 'cloturee', "technicien_id", 60,
            now(), now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "segment_travail"
       ("id", "societe_id", "intervention_id", "utilisateur_id",
        "nom_technicien_affiche", "debut", "fin", "modifie_le")
     VALUES ('${segmentId}', '${SOCIETE_A}', '${id}', '${TECHNICIEN}',
             '${NOM_TECHNICIEN}',
             TIMESTAMPTZ '2026-09-20T08:00:00.000Z',
             TIMESTAMPTZ '2026-09-20T09:00:00.000Z', now())`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "id" = '${segmentId}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("le bon du portail — ce que la brèche de filiation OUVRE", () => {
  it("le client DE l'intervention lit le nom du technicien et ses segments", async () => {
    await surUneInterventionAvecSegment(async (id) => {
      const resultat = await bonInterventionDuParc(
        contextePortail(PORTAIL_A_CLIENT, CLIENT_A1),
        id,
        clientApp(),
      );
      expect(resultat.etat).toBe("disponible");
      if (resultat.etat !== "disponible") return;

      expect(resultat.bon.technicienAffecte).toBe(NOM_TECHNICIEN);
      expect(resultat.bon.segments).toHaveLength(1);
      expect(resultat.bon.segments[0]?.technicien).toBe(NOM_TECHNICIEN);
      expect(resultat.bon.segments[0]?.minutes).toBe(60);
      // AUCUN MONTANT, AUCUN TAUX : garantie à l'écran, pas ici — voir
      // `tests/unit/portail/bon-sans-montant.test.ts`, inchangé par ce ticket.
    });
  });

  it("le client DE l'intervention ne lit, pour autant, AUCUNE ligne « utilisateur » — pas même celle de SON technicien (9J22A)", async () => {
    await surUneInterventionAvecSegment(async () => {
      // LE NOM EST DONC LU AILLEURS (ci-dessus) : CETTE table-ci lui reste
      // structurellement fermée, même pour le technicien de sa PROPRE
      // intervention — la brèche que 9J22 avait ouverte sur `utilisateur`
      // est retirée sans aucune exception, jamais seulement rétrécie.
      const techniciens = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) => tx.utilisateur.findMany({ where: { id: TECHNICIEN } }),
      );
      expect(techniciens).toHaveLength(0);
    });
  });
});

describe("le bon du portail — ce que la brèche de filiation NE ROUVRE PAS", () => {
  it("un AUTRE client de la MÊME société ne lit ni le segment ni le nom", async () => {
    await surUneInterventionAvecSegment(async (id) => {
      // TÉMOIN — le bon lui-même reste « introuvable » (D35, D50), comme
      // avant 9J22 : la brèche de filiation ne change rien à CE refus,
      // puisque `intervention` elle-même reste fermée à ce client.
      const bon = await bonInterventionDuParc(
        contextePortail(PORTAIL_A2_CLIENT, CLIENT_A2),
        id,
        clientApp(),
      );
      expect(bon).toEqual({ etat: "introuvable" });

      // LA MESURE DIRECTE — même sous ce contexte, une lecture qui
      // contournerait `bonInterventionDuParc` ne trouverait rien non plus :
      // c'est la politique, pas la composition de l'écran, qui ferme.
      const segments = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A2 },
        (tx) => tx.segmentTravail.count({ where: { intervention_id: id } }),
      );
      expect(segments).toBe(0);

      const techniciens = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A2 },
        (tx) => tx.utilisateur.findMany({ where: { id: TECHNICIEN } }),
      );
      expect(techniciens).toHaveLength(0);
    });
  });

  it("une AUTRE société ne lit ni le segment ni le nom", async () => {
    await surUneInterventionAvecSegment(async (id) => {
      const segments = await avecPortail(
        { societeId: SOCIETE_B, clientId: CLIENT_A2 },
        (tx) => tx.segmentTravail.count({ where: { intervention_id: id } }),
      );
      expect(segments).toBe(0);
    });
  });
});

describe("la clause RÉELLE de la politique de segment_travail, ET la brèche de utilisateur retirée (9J22A)", () => {
  it("« cloisonnement_filiation_lecture_portail » (segment_travail) lit app.client_id ET s'adosse à intervention", async () => {
    const [politique] = await observerSousProprietaire(
      "lire la clause RÉELLE de la politique ajoutée par 9J22, plutôt que " +
        "de la supposer conforme à ce que la migration voulait écrire.",
    ).$queryRawUnsafe<Array<{ qual: string }>>(
      `SELECT "qual" FROM "pg_catalog"."pg_policies"
        WHERE "schemaname" = 'public' AND "tablename" = 'segment_travail'
          AND "policyname" = 'cloisonnement_filiation_lecture_portail'`,
    );
    expect(politique?.qual).toContain("app.client_id");
    expect(politique?.qual).toMatch(/EXISTS/i);
    expect(politique?.qual).toContain("intervention");
  });

  it("« utilisateur_lecture_filiation_portail » N'EXISTE PLUS — 9J22A l'a retirée, jamais rétrécie", async () => {
    const politiques = await observerSousProprietaire(
      "constater que la migration de 9J22A a bien retiré la politique, " +
        "plutôt que de supposer le DROP POLICY appliqué.",
    ).$queryRawUnsafe<Array<{ qual: string }>>(
      `SELECT "qual" FROM "pg_catalog"."pg_policies"
        WHERE "schemaname" = 'public' AND "tablename" = 'utilisateur'
          AND "policyname" = 'utilisateur_lecture_filiation_portail'`,
    );
    expect(politiques).toHaveLength(0);
  });
});
