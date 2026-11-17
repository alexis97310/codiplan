import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L15-TEMPS-VALIDE-TECHNICIEN (D271, décision d'Alexis du 10/11/2026,
 * option 1) — LE TECHNICIEN QUI CLÔTURE NE CORRIGE PAS SON TEMPS, DE BOUT EN
 * BOUT.
 *
 * ## Pourquoi un fichier e2e, et pas seulement l'épreuve d'isolation
 *
 * `tests/isolation/droits-cycle-de-vie.test.ts` appelle `cloturerIntervention`
 * directement : elle prouve que le DÉPÔT refuse, jamais que la PORTE laisse
 * le ○ du technicien atteindre ce dépôt par la vraie route, sous sa vraie
 * session. Ce fichier rejoue la route réelle (`/api/interventions/<id>/
 * cloturer`), posée sous une session de technicien ouverte PAR L'ÉCRAN.
 *
 * ## AUCUN DIALOGUE À CAPTURER ICI, ET C'EST CONSTATÉ, PAS OMIS
 *
 * `DialogueCloturer` (le dialogue « Clôturer ») ne vit que sur la fiche du
 * back-office, `/interventions/<id>` — fermée au technicien par le garde de
 * D221 (`app/(back-office)/template.tsx`), qui le renvoie systématiquement
 * vers sa fiche terrain. La clôture, elle, n'est pas davantage portée par la
 * file hors réseau du terrain (`lib/interventions/saisie-differee.ts` ne
 * couvre que le compteur et « Terminer »). Il n'existe donc, à ce jour, AUCUN
 * écran par lequel un technicien atteint ce dialogue — la capacité ○ que la
 * matrice lui ouvre sur `cloturer_intervention` (D131) reste sans chemin
 * d'écran, constat distinct de cette décision et laissé à Alexis plutôt que
 * résolu ici par un écran neuf (voir la passation). Cette épreuve prouve donc
 * la règle par la ROUTE, directement, plutôt que par un dialogue qu'aucun
 * écran n'ouvre.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9L15 = uuidv7();
const SITE_9L15 = uuidv7();
const INTERVENTION_9L15 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L15,
        societe_id: reperes.societeId,
        raison_sociale: "9L15-TEMPS-VALIDE-TECHNICIEN — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L15,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L15,
        agence_id: agence.id,
        libelle: "9L15-TEMPS-VALIDE-TECHNICIEN — site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L15,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L15,
        site_id: SITE_9L15,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
        rapport_valide_par: reperes.technicienDucos,
        rapport_valide_le: new Date(),
      },
    });
    // MÊME ORDRE QUE `fiche-cloturer.spec.ts` : le segment d'abord, la somme
    // ensuite (`intervention_temps_mesure_est_celui_du_compteur`).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","nom_technicien_affiche","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid,
               (SELECT "nom" FROM "utilisateur" WHERE "id" = $3::uuid), now() - interval '90 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_9L15,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_9L15 },
      data: { temps_mesure_min: 90 },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L15,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L15,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9L15 } });
    await client.client.deleteMany({ where: { id: CLIENT_9L15 } });
  } finally {
    await client.$disconnect();
  }
});

test("un technicien qui soumet une valeur DIFFÉRENTE du temps mesuré est refusé, et rien ne change en base", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  const reponse = await page.request.post(
    `/api/interventions/${INTERVENTION_9L15}/cloturer`,
    { form: { temps_valide_min: "45" } },
  );
  expect(reponse.ok()).toBe(true);

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9L15 },
      select: { statut: true, temps_valide_min: true, temps_valide_par: true },
    });
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_valide_min).toBeNull();
    expect(ligne.temps_valide_par).toBeNull();
  } finally {
    await client.$disconnect();
  }
});

test("le même technicien, avec la valeur EXACTE mesurée, clôture son intervention", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  const reponse = await page.request.post(
    `/api/interventions/${INTERVENTION_9L15}/cloturer`,
    { form: { temps_valide_min: "90" } },
  );
  expect(reponse.ok()).toBe(true);

  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9L15 },
      select: {
        statut: true,
        temps_valide_min: true,
        temps_valide_par: true,
        temps_valide_le: true,
      },
    });
    expect(ligne.statut).toBe("cloturee");
    expect(ligne.temps_valide_min).toBe(90);
    expect(ligne.temps_valide_par).toBe(reperes.technicienDucos);
    expect(ligne.temps_valide_le).not.toBeNull();
  } finally {
    await client.$disconnect();
  }
});
