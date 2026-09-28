import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { listerPlanning } from "@/lib/interventions/depot";

import {
  clientApp,
  clientOwner,
  fermerClients,
  sousSocieteEtRole,
} from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * PG-A8-ANNULEES-MASQUEES — les annulées sont masquées du planning PAR
 * DÉFAUT (audit d'ergonomie du 27/09/2026, I-17 ; annexe D du cahier des
 * charges, `docs/cahier-des-charges.md:1735` : « Annulée — gris barré —
 * masqué par défaut »).
 *
 * **Mesuré sur `main`** : `listerPlanning` ne filtrait sur AUCUN statut —
 * une annulée SANS date restait dans la file d'attente (barrée), une
 * annulée DATÉE restait sur la grille.
 *
 * **Le paramètre `options.inclureAnnulees` de `listerPlanning` vaut `true`
 * PAR DÉFAUT** — l'inverse de ce que `/planning` demande — parce que les
 * DEUX AUTRES appelants (`/terrain`, `/tableau-de-bord`) n'ont aucune
 * connaissance de ce paramètre et doivent continuer de voir exactement ce
 * qu'ils voyaient : « sans casser d'autre appelant » (le ticket). C'est
 * `app/(back-office)/planning/page.tsx` qui passe `inclureAnnulees: false`
 * EXPLICITEMENT dès que `?annulees=1` est absent — ce fichier éprouve les
 * DEUX défauts, celui de la fonction et celui de l'écran, pour qu'ils ne
 * divergent pas en silence.
 *
 * Deux lignes forgées ici (préfixe `PGA8-` dans leur description, aucune
 * fixture `SCENE.*` partagée), supprimées en fin de scénario — jamais un
 * statut, une date ou un technicien écrits sur une ligne du semis partagé.
 */

const PERIODE_DU = new Date("2026-09-01T00:00:00.000Z");
const PERIODE_AU = new Date("2026-09-30T00:00:00.000Z");
const DATE_DANS_LA_FENETRE = new Date("2026-09-15T00:00:00.000Z");

const PLANIFICATEUR = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const interventionsPosees: string[] = [];

function squelette(
  id: string,
  datePlanifiee: Date | null,
): {
  id: string;
  societe_id: string;
  client_id: string;
  site_id: string;
  agence_id: string;
  type: "curatif";
  statut: "annulee";
  date_planifiee: Date | null;
  description: string;
} {
  interventionsPosees.push(id);
  return {
    id,
    societe_id: SOCIETE_A,
    client_id: CLIENT_A1,
    site_id: SITE_A1_S1,
    agence_id: AGENCE_A,
    type: "curatif",
    statut: "annulee",
    date_planifiee: datePlanifiee,
    // Identifie la ligne dans un export de base, sans effet sur aucune
    // requête ni aucun décompte lu par une autre épreuve.
    description: "PGA8- épreuve d'isolation, supprimée en fin de scénario",
  };
}

async function poserLesDeuxFormes(): Promise<{
  sansDate: string;
  datee: string;
}> {
  const sansDate = uuidv7();
  const datee = uuidv7();
  await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
    tx.intervention.create({ data: squelette(sansDate, null) }),
  );
  await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
    tx.intervention.create({
      data: squelette(datee, DATE_DANS_LA_FENETRE),
    }),
  );
  return { sansDate, datee };
}

afterEach(async () => {
  if (interventionsPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN (${interventionsPosees
        .map((id) => `'${id}'`)
        .join(",")})`,
    );
    interventionsPosees.length = 0;
  }
});

afterAll(fermerClients);

describe("PG-A8-ANNULEES-MASQUEES — listerPlanning", () => {
  it("TÉMOIN — sans l'option, le défaut historique reste inchangé (terrain, tableau de bord)", async () => {
    const { sansDate, datee } = await poserLesDeuxFormes();
    const sansOption = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
    );
    const ids = sansOption.map((ligne) => ligne.id);
    expect(ids).toContain(sansDate);
    expect(ids).toContain(datee);
  });

  it("inclureAnnulees: false — ce que /planning demande par défaut — écarte les deux formes", async () => {
    const { sansDate, datee } = await poserLesDeuxFormes();
    const masquees = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
      { inclureAnnulees: false },
    );
    const ids = masquees.map((ligne) => ligne.id);
    expect(ids).not.toContain(sansDate);
    expect(ids).not.toContain(datee);
  });

  it("inclureAnnulees: true — ce que le filtre coché demande — les remontre", async () => {
    const { sansDate, datee } = await poserLesDeuxFormes();
    const remontrees = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
      { inclureAnnulees: true },
    );
    const ids = remontrees.map((ligne) => ligne.id);
    expect(ids).toContain(sansDate);
    expect(ids).toContain(datee);
  });
});
