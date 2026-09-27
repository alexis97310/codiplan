import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import {
  creerSite,
  creerSitesEnLot,
  modifierSite,
  modifierSiteDans,
} from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { CLIENT_A1, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * AGENCE-ACTIVE (9AZ-AA-2) — un site ne se rattache plus à une agence inactive.
 *
 * ## Le constat que ce ticket ferme
 *
 * `creerSite` et `modifierSite` (`lib/sites/depot.ts`) ne contrôlaient que
 * l'appartenance à la société (clé étrangère) : rien n'empêchait de rattacher
 * un site à une agence inactive, à la création comme à la modification.
 * AA-1 (9AY) a déjà retiré ces agences des MENUS ; ce ticket refuse le
 * rattachement côté serveur pour un `agence_id` posté directement.
 *
 * **Le MAINTIEN d'un rattachement déjà posé, même inactif, reste accepté** :
 * le formulaire de fiche renvoie TOUJOURS `agence_id`
 * (`app/api/sites/[id]/modifier/route.ts`), donc refuser tout `agence_id`
 * inactif romprait l'enregistrement d'un champ sans rapport sur une fiche déjà
 * rattachée à une agence désactivée depuis.
 *
 * **L'IMPORT reste un chemin séparé** (`lib/imports/parc-agences.ts`) : il
 * appelle `creerSitesEnLot` et `modifierSiteDans` directement, jamais
 * `creerSite`/`modifierSite` — ce module n'y ajoute donc aucun contrôle, et un
 * scénario ci-dessous le montre.
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
const PREFIXE = "AA2-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve AA-2",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function site(agenceId: string, surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationSite.safeParse({
    client_id: CLIENT_A1,
    agence_id: agenceId,
    libelle: `${PREFIXE}Site d'épreuve`,
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "libelle" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

afterAll(fermerClients);

describe("creerSite — refus d'une agence inactive", () => {
  it("refuse la création rattachée à une agence inactive", async () => {
    const inactive = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(inactive.accepte).toBe(true);
    if (!inactive.accepte) return;

    const resultat = await creerSite(
      ADMIN_A,
      site(inactive.fiche.id),
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

    const resultat = await creerSite(
      ADMIN_A,
      site(active.fiche.id),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("modifierSite — passage refusé, maintien accepté", () => {
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

    const cree = await creerSite(ADMIN_A, site(depart.fiche.id), clientApp());
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    const resultat = await modifierSite(
      ADMIN_A,
      cree.fiche.id,
      { agence_id: cible.fiche.id, temps_trajet_min: null },
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

    const cree = await creerSite(
      ADMIN_A,
      site(rattachement.fiche.id),
      clientApp(),
    );
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    // L'agence devient inactive APRÈS le rattachement du site — c'est
    // exactement le cas que D134 a déjà traité pour le menu.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "agence" SET "actif" = false WHERE "id" = '${rattachement.fiche.id}'`,
    );

    const resultat = await modifierSite(
      ADMIN_A,
      cree.fiche.id,
      { agence_id: rattachement.fiche.id, temps_trajet_min: null },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("l'import reste un chemin séparé, non touché par ce refus", () => {
  it("creerSitesEnLot accepte un rattachement à une agence inactive", async () => {
    const inactive = await creerAgence(
      ADMIN_A,
      agence({ actif: false }),
      clientApp(),
    );
    expect(inactive.accepte).toBe(true);
    if (!inactive.accepte) return;

    const id = uuidv7();
    await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        creerSitesEnLot(tx, SOCIETE_A, [
          { id, saisie: site(inactive.fiche.id) },
        ]),
      clientApp(),
    );

    const lignes = await avecContexteApplicatif(
      ADMIN_A,
      (tx) => tx.site.findMany({ where: { id }, select: { id: true } }),
      clientApp(),
    );
    expect(lignes).toHaveLength(1);
  });

  it("modifierSiteDans accepte un rattachement à une agence inactive", async () => {
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

    const cree = await creerSite(ADMIN_A, site(depart.fiche.id), clientApp());
    expect(cree.accepte).toBe(true);
    if (!cree.accepte) return;

    const fiche = await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        modifierSiteDans(tx, cree.fiche.id, {
          agence_id: cible.fiche.id,
          temps_trajet_min: null,
        }),
      clientApp(),
    );
    expect(fiche.agence_id).toBe(cible.fiche.id);
  });
});
