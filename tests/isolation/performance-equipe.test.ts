import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  creerCompteDeBureau,
  etatsAccesDesComptes,
  listerComptesDeBureau,
} from "@/lib/auth/acces-bureau";
import { etatsAccesDesTechniciens } from "@/lib/auth/acces-technicien";
import { identitesExclusivesALaSociete } from "@/lib/auth/lien-d-acces";
import { Role } from "@/lib/auth/roles";
import {
  habilitationsDesTechniciens,
  listerHabilitations,
} from "@/lib/habilitations/depot";
import {
  agencesDisponibles,
  agencesProposablesPourTechnicien,
  compterInterventionsAVenirParTechnicien,
  creerTechnicien,
  listerLesTechniciens,
} from "@/lib/techniciens/depot";

import {
  instrumenter,
  profondeurSequentielle,
} from "../performance/instrument";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9ID-PERFORMANCES-MESURE-ET-CORRECTIFS — MESURE DE /parametres/equipe.
 *
 * `PageEquipe` (`app/(back-office)/parametres/equipe/page.tsx`) enchaînait
 * DOUZE lectures en séquence stricte, sans un seul `Promise.all` au niveau de
 * la page (audit du 04/11/2026). Ce scénario reproduit les DEUX ordres
 * d'appel — l'ANCIEN (chaque fonction attendue l'une après l'autre) et le
 * NOUVEAU (trois paliers, chacun en `Promise.all`, celui que la page tient
 * désormais) — sur les MÊMES fonctions de dépôt, avec le MÊME semis : la
 * comparaison porte sur l'ORDRE des appels, jamais sur une donnée différente.
 *
 * Six techniciens et deux comptes de bureau jetables (échelle de
 * démonstration, `prisma/seed-data.ts: TECHNICIENS_PAR_AGENCE`), créés sous
 * l'ADMIN de la société A et détruits en fin de scénario.
 */

afterAll(fermerClients);

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe] as string,
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "9id-equipe-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 10_000_000)}@codima.test`;
}

const techniciensJetables: string[] = [];
const bureauJetables: string[] = [];

async function semerEquipe(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: `Technicien 9ID ${i}`,
        email: courriel(),
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    if (!resultat.accepte) throw new Error("fixture technicien non créée");
    techniciensJetables.push(resultat.utilisateurId);
  }
  for (let i = 0; i < 2; i += 1) {
    const resultat = await creerCompteDeBureau(
      ADMIN_A,
      { nom: `Bureau 9ID ${i}`, courriel: courriel(), role: Role.adv },
      clientApp(),
    );
    if (!resultat.accepte) throw new Error("fixture compte bureau non créée");
    bureauJetables.push(resultat.utilisateurId);
  }
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "detail" LIKE $1 OR "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
  techniciensJetables.splice(0);
  bureauJetables.splice(0);
});

const anciennEnv = process.env.MESURE_PERFORMANCE_DELAI_MS;
afterAll(() => {
  if (anciennEnv === undefined) {
    delete process.env.MESURE_PERFORMANCE_DELAI_MS;
  } else {
    process.env.MESURE_PERFORMANCE_DELAI_MS = anciennEnv;
  }
});

/** L'ORDRE D'AVANT 9ID : douze lectures, une après l'autre. */
async function mesurerOrdreAncien(client: ReturnType<typeof clientApp>) {
  const techniciens = await listerLesTechniciens(ADMIN_A, client);
  await agencesDisponibles(ADMIN_A, client);
  const comptesBureau = await listerComptesDeBureau(ADMIN_A, client);
  const etatsAccesBureau = await etatsAccesDesComptes(
    ADMIN_A,
    comptesBureau.map((c) => c.utilisateurId),
    client,
  );
  await identitesExclusivesALaSociete(
    ADMIN_A,
    comptesBureau
      .filter(
        (c) =>
          (etatsAccesBureau.get(c.utilisateurId)?.etat ?? "aucun") === "actif",
      )
      .map((c) => c.utilisateurId),
    client,
  );
  const affiches = techniciens.filter((t) => t.actif);
  await Promise.all(
    affiches.map((t) =>
      agencesProposablesPourTechnicien(ADMIN_A, t.agenceId, client),
    ),
  );
  await compterInterventionsAVenirParTechnicien(
    ADMIN_A,
    affiches.map((t) => t.utilisateurId),
    client,
  );
  const etatsAcces = await etatsAccesDesTechniciens(
    ADMIN_A,
    affiches.map((t) => t.utilisateurId),
    client,
  );
  await identitesExclusivesALaSociete(
    ADMIN_A,
    affiches
      .filter(
        (t) => (etatsAcces.get(t.utilisateurId)?.etat ?? "aucun") === "actif",
      )
      .map((t) => t.utilisateurId),
    client,
  );
  await listerHabilitations(ADMIN_A, client);
  await habilitationsDesTechniciens(
    ADMIN_A,
    affiches.map((t) => t.utilisateurId),
    client,
  );
  await client.societe.findFirst({
    where: { id: SOCIETE_A },
    select: { fuseau_horaire: true },
  });
}

/** L'ORDRE D'APRÈS 9ID : trois paliers, chacun en `Promise.all`. */
async function mesurerOrdreNouveau(client: ReturnType<typeof clientApp>) {
  const [techniciens, , comptesBureau, , ,] = await Promise.all([
    listerLesTechniciens(ADMIN_A, client),
    agencesDisponibles(ADMIN_A, client),
    listerComptesDeBureau(ADMIN_A, client),
    listerHabilitations(ADMIN_A, client),
    client.societe.findFirst({
      where: { id: SOCIETE_A },
      select: { fuseau_horaire: true },
    }),
  ]);
  const affiches = techniciens.filter((t) => t.actif);
  const [etatsAccesBureau, , , etatsAcces] = await Promise.all([
    etatsAccesDesComptes(
      ADMIN_A,
      comptesBureau.map((c) => c.utilisateurId),
      client,
    ),
    Promise.all(
      affiches.map((t) =>
        agencesProposablesPourTechnicien(ADMIN_A, t.agenceId, client),
      ),
    ),
    compterInterventionsAVenirParTechnicien(
      ADMIN_A,
      affiches.map((t) => t.utilisateurId),
      client,
    ),
    etatsAccesDesTechniciens(
      ADMIN_A,
      affiches.map((t) => t.utilisateurId),
      client,
    ),
    habilitationsDesTechniciens(
      ADMIN_A,
      affiches.map((t) => t.utilisateurId),
      client,
    ),
  ]);
  await Promise.all([
    identitesExclusivesALaSociete(
      ADMIN_A,
      comptesBureau
        .filter(
          (c) =>
            (etatsAccesBureau.get(c.utilisateurId)?.etat ?? "aucun") ===
            "actif",
        )
        .map((c) => c.utilisateurId),
      client,
    ),
    identitesExclusivesALaSociete(
      ADMIN_A,
      affiches
        .filter(
          (t) => (etatsAcces.get(t.utilisateurId)?.etat ?? "aucun") === "actif",
        )
        .map((t) => t.utilisateurId),
      client,
    ),
  ]);
}

describe("mesure de /parametres/equipe (9ID, points 2 et 3)", () => {
  it("l'ordre NOUVEAU (trois paliers) est bien moins profond que l'ANCIEN (douze allers-retours), sur le MÊME semis", async () => {
    await semerEquipe();
    process.env.MESURE_PERFORMANCE_DELAI_MS = "50";

    const ancien = instrumenter(clientApp());
    const debutAncien = Date.now();
    await mesurerOrdreAncien(ancien.client);
    const dureeAncienne = Date.now() - debutAncien;
    const profondeurAncienne = profondeurSequentielle(dureeAncienne, 50);

    const nouveau = instrumenter(clientApp());
    const debutNouveau = Date.now();
    await mesurerOrdreNouveau(nouveau.client);
    const dureeNouvelle = Date.now() - debutNouveau;
    const profondeurNouvelle = profondeurSequentielle(dureeNouvelle, 50);

    // eslint-disable-next-line no-console -- la mesure EST le résultat attendu de ce scénario (9ID, point 2).
    console.log(
      `[9ID équipe] avant: ${ancien.compteur.transactions} transactions, ${ancien.compteur.requetes} requêtes, ${dureeAncienne}ms, profondeur≈${profondeurAncienne} — ` +
        `après: ${nouveau.compteur.transactions} transactions, ${nouveau.compteur.requetes} requêtes, ${dureeNouvelle}ms, profondeur≈${profondeurNouvelle}`,
    );

    expect(profondeurNouvelle).toBeLessThan(profondeurAncienne);
    // LE GARDE-FOU (point 4) : mesuré à 17 sur ce semis (six techniciens,
    // deux comptes de bureau) — les trois paliers restent, mais certaines
    // des branches qu'ils regroupent (`etatsAccesDesComptes`,
    // `etatsAccesDesTechniciens`) enchaînent elles-mêmes plusieurs requêtes
    // en interne (tranches de 5, D226). Plafond posé à 20 : une régression
    // qui réintroduit un `await` isolé entre deux paliers, ou qui retire le
    // plafonnement par tranches, fait rougir cette borne.
    expect(profondeurNouvelle).toBeLessThanOrEqual(20);
  });
});
