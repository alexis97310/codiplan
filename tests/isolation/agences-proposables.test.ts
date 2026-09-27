import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerAgence } from "@/lib/agences/depot";
import { agencesProposables } from "@/lib/agences/proposables";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * AGENCE-ACTIVE (9AY-AA-1) — LE SEUL LECTEUR DU CRITÈRE « AGENCE PROPOSABLE ».
 *
 * ## Ce que ce module ferme
 *
 * Décision d'Alexis du 26/09/2026 : une agence inactive sort des choix (menus
 * de rattachement) et des filtres, sans disparaître de Paramètres > Agences
 * ni des fiches qui la portent déjà (précédent D129, le client inactif). Voir
 * l'en-tête de `lib/agences/proposables.ts` pour le piège que `garder` ferme
 * — un site rattaché à une agence qu'on vient de désactiver ne doit pas
 * perdre son option dans le menu, sous peine de voir « Enregistrer » un autre
 * champ changer le rattachement sans qu'on l'ait demandé.
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
const PREFIXE = "AA1-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve AA-1",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

afterAll(fermerClients);

describe("agencesProposables — active, inactive, inactive gardée", () => {
  it("une agence active est proposée, une agence inactive ne l'est pas", async () => {
    const active = await creerAgence(
      ADMIN_A,
      agence({ actif: true }),
      clientApp(),
    );
    const inactive = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(active.accepte).toBe(true);
    expect(inactive.accepte).toBe(true);
    if (!active.accepte || !inactive.accepte) return;

    const proposables = await avecContexteApplicatif(
      ADMIN_A,
      (tx) => agencesProposables(tx),
      clientApp(),
    );
    const ids = proposables.map((a) => a.id);
    expect(ids).toContain(active.fiche.id);
    expect(ids).not.toContain(inactive.fiche.id);
  });

  it("une agence inactive GARDÉE reste proposée, marquée `inactive`", async () => {
    const inactive = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(inactive.accepte).toBe(true);
    if (!inactive.accepte) return;

    const proposables = await avecContexteApplicatif(
      ADMIN_A,
      (tx) => agencesProposables(tx, { garder: inactive.fiche.id }),
      clientApp(),
    );
    const gardee = proposables.find((a) => a.id === inactive.fiche.id);
    expect(gardee?.inactive).toBe(true);
  });

  it("`garder` ne republie pas les AUTRES agences inactives de la société", async () => {
    const gardee = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    const autre = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(gardee.accepte).toBe(true);
    expect(autre.accepte).toBe(true);
    if (!gardee.accepte || !autre.accepte) return;

    const proposables = await avecContexteApplicatif(
      ADMIN_A,
      (tx) => agencesProposables(tx, { garder: gardee.fiche.id }),
      clientApp(),
    );
    const ids = proposables.map((a) => a.id);
    expect(ids).toContain(gardee.fiche.id);
    expect(ids).not.toContain(autre.fiche.id);
  });
});
