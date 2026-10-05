import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien, modifierTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * AGENCE-ACTIVE (AA-3-EQUIPE) — un technicien ne se rattache plus à une
 * agence inactive.
 *
 * ## Le constat que ce ticket ferme
 *
 * `creerTechnicien` et `modifierTechnicien` (`lib/techniciens/depot.ts`) ne
 * contrôlaient que l'appartenance à la société (clé étrangère) : rien
 * n'empêchait de rattacher un technicien à une agence inactive, à la
 * création comme à la modification. Même raisonnement, même refus, que
 * `tests/isolation/sites-agence-inactive.test.ts` pour les sites.
 *
 * **Le MAINTIEN d'un rattachement déjà posé, même inactif, reste accepté** :
 * le formulaire de fiche renvoie TOUJOURS `agence_id`
 * (`app/api/techniciens/[id]/modifier/route.ts`), donc refuser tout
 * `agence_id` inactif romprait l'enregistrement d'un champ sans rapport sur
 * une fiche déjà rattachée à une agence désactivée depuis.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Un préfixe qui n'appartient qu'à ce fichier — le ménage s'y accroche. */
const PREFIXE = "AA3-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve AA-3",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function courriel(): string {
  return `${PREFIXE.toLowerCase()}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

afterAll(fermerClients);

describe("creerTechnicien — refus d'une agence inactive", () => {
  it("refuse la création rattachée à une agence inactive", async () => {
    const inactive = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(inactive.accepte).toBe(true);
    if (!inactive.accepte) return;

    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve AA-3",
        email: courriel(),
        agence_id: inactive.fiche.id,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (resultat.accepte) return;
    expect(resultat.motif).toBe("agence_inactive");
  });

  it("accepte la création rattachée à une agence active", async () => {
    const active = await creerAgence(
      ADMIN_A,
      agence({ actif: true }),
      clientApp(),
    );
    expect(active.accepte).toBe(true);
    if (!active.accepte) return;

    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve AA-3",
        email: courriel(),
        agence_id: active.fiche.id,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("modifierTechnicien — passage refusé, maintien accepté", () => {
  it("refuse le PASSAGE vers une agence inactive différente de l'actuelle", async () => {
    const depart = await creerAgence(
      ADMIN_A,
      agence({ actif: true }),
      clientApp(),
    );
    const cible = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(depart.accepte).toBe(true);
    expect(cible.accepte).toBe(true);
    if (!depart.accepte || !cible.accepte) return;

    const cree = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve AA-3",
        email: courriel(),
        agence_id: depart.fiche.id,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    const resultat = await modifierTechnicien(
      ADMIN_A,
      cree.utilisateurId,
      { agence_id: cible.fiche.id, actif: true, statut_ressource: null },
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (resultat.accepte) return;
    expect(resultat.motif).toBe("agence_inactive");
  });

  it("accepte le MAINTIEN de l'agence actuelle, même devenue inactive", async () => {
    const rattachement = await creerAgence(
      ADMIN_A,
      agence({ actif: true }),
      clientApp(),
    );
    expect(rattachement.accepte).toBe(true);
    if (!rattachement.accepte) return;

    const cree = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve AA-3",
        email: courriel(),
        agence_id: rattachement.fiche.id,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    // L'agence devient inactive APRÈS le rattachement du technicien — c'est
    // exactement le cas que D134 a déjà traité pour le menu.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "agence" SET "actif" = false WHERE "id" = '${rattachement.fiche.id}'`,
    );

    const resultat = await modifierTechnicien(
      ADMIN_A,
      cree.utilisateurId,
      {
        agence_id: rattachement.fiche.id,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});
