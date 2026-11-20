import { afterAll, afterEach, describe, expect, it } from "vitest";

import { creerAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";
import { creerSite, modifierSite } from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_B1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * AGENCE-SITE-PROPAGEE — quand un site change d'agence, ses interventions
 * OUVERTES suivent la nouvelle agence dans la même transaction ; les
 * CLÔTURÉES et les ANNULÉES gardent l'ancienne (décision d'Alexis du
 * 10/11/2026, option 1).
 *
 * **« Ouverte » est ici celle de `estFige`** (`lib/interventions/cycle-de-
 * vie.ts`) — annulée et clôturée sont les deux seules figées — et non celle
 * de `STATUTS_INTERVENTION_FERMES` (FICHE-360-1), qui range aussi `terminee`
 * parmi les fermées pour un compteur d'affichage. Une `terminee` suit donc
 * la nouvelle agence comme une `en_cours`, et ce fichier le mesure.
 *
 * La CIBLE de chaque scénario est une agence NEUVE : `creerAgence` lui crée
 * un calendrier SANS AUCUNE PLAGE (voir l'en-tête de `lib/agences/depot.ts`)
 * — tout jour y est fermé, ce qui sert ICI à éprouver le signalement d'une
 * intervention déjà posée sans dépendre d'un jour férié réel.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "AGP-";

function agence(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaCreationAgence.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Agence d'épreuve AGP",
    territoire: "NC",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function site(agenceId: string) {
  const analyse = schemaCreationSite.safeParse({
    client_id: CLIENT_A1,
    agence_id: agenceId,
    libelle: `${PREFIXE}Site d'épreuve`,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function intervention(siteId: string) {
  const analyse = schemaCreation.safeParse({
    id: uuidv7(),
    client_id: CLIENT_A1,
    site_id: siteId,
    type: "curatif",
    description: "Épreuve AGENCE-SITE-PROPAGEE",
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

/**
 * FAIT AVANCER UNE INTERVENTION, UNE TRANSITION PERMISE À LA FOIS — la
 * matrice D8 (`intervention_cycle_de_vie`) la tient EN BASE, même sur une
 * écriture directe : un raccourci qui sauterait une étape échoue par 23514,
 * exactement comme `lib/interventions/depot.ts` le ferait.
 */
async function avancerVers(
  id: string,
  etapes: readonly { readonly statut: string; readonly extra?: string }[],
): Promise<void> {
  for (const etape of etapes) {
    const extra = etape.extra === undefined ? "" : `, ${etape.extra}`;
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = '${etape.statut}'${extra} WHERE "id" = '${id}'`,
    );
  }
}

const DUREE = `"duree_estimee_min" = 30`;
// UNE VALEUR D'ÉPREUVE, PAS UNE CLÉ ÉTRANGÈRE (RG-INT-03, D120, même régime
// que `temps_valide_par` dans `tests/isolation/intervention.test.ts`).
const RAPPORT_VALIDE_PAR = "00000000-0000-7000-8000-00000000f901";

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "site_id" IN (SELECT "id" FROM "site" WHERE "libelle" LIKE '${PREFIXE}%')`,
  );
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

describe("modifierSite — l'agence des interventions suit ou reste, selon leur figeage", () => {
  it("les ouvertes suivent, les figées gardent l'ancienne, et le compte est exact", async () => {
    const depart = await creerAgence(ADMIN_A, agence(), clientApp());
    const cible = await creerAgence(ADMIN_A, agence(), clientApp());
    expect(depart.accepte).toBe(true);
    expect(cible.accepte).toBe(true);
    if (!depart.accepte || !cible.accepte) return;

    const fiche = await creerSite(ADMIN_A, site(depart.fiche.id), clientApp());
    expect(fiche.accepte).toBe(true);
    if (!fiche.accepte) return;
    const siteId = fiche.fiche.id;

    const aPlanifier = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    const enCours = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    const terminee = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    const cloturee = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    const annulee = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    for (const r of [aPlanifier, enCours, terminee, cloturee, annulee]) {
      expect(r.accepte).toBe(true);
    }
    if (
      !aPlanifier.accepte ||
      !enCours.accepte ||
      !terminee.accepte ||
      !cloturee.accepte ||
      !annulee.accepte
    ) {
      return;
    }

    await avancerVers(enCours.fiche.id, [
      { statut: "planifiee", extra: DUREE },
      { statut: "en_cours" },
    ]);
    await avancerVers(terminee.fiche.id, [
      { statut: "planifiee", extra: DUREE },
      { statut: "en_cours" },
      { statut: "terminee" },
    ]);
    await avancerVers(cloturee.fiche.id, [
      { statut: "planifiee", extra: DUREE },
      { statut: "en_cours" },
      { statut: "terminee" },
      {
        statut: "cloturee",
        extra: `"temps_valide_min" = 60, "rapport_valide_par" = '${RAPPORT_VALIDE_PAR}', "rapport_valide_le" = now()`,
      },
    ]);
    await avancerVers(annulee.fiche.id, [
      { statut: "annulee", extra: `"motif_annulation" = 'AGP-épreuve'` },
    ]);
    // `a_planifier` reste tel quel — c'est le cas de `aPlanifier.fiche`.

    const resultat = await modifierSite(
      ADMIN_A,
      siteId,
      { agence_id: cible.fiche.id, temps_trajet_min: null },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    // QUATRE ouvertes : à planifier, en cours, terminée — PAS clôturée, PAS
    // annulée (`STATUTS_INTERVENTION_OUVERTS` lit `estFige`, pas
    // `STATUTS_INTERVENTION_FERMES`).
    expect(resultat.interventionsDeplacees).toBe(3);

    const lignes = await clientOwner().$queryRawUnsafe<
      Array<{ id: string; agence_id: string }>
    >(
      `SELECT "id", "agence_id" FROM "intervention" WHERE "site_id" = '${siteId}'`,
    );
    const agenceDe = (id: string) =>
      lignes.find((ligne) => ligne.id === id)?.agence_id;

    expect(agenceDe(aPlanifier.fiche.id)).toBe(cible.fiche.id);
    expect(agenceDe(enCours.fiche.id)).toBe(cible.fiche.id);
    expect(agenceDe(terminee.fiche.id)).toBe(cible.fiche.id);
    // LES FIGÉES GARDENT L'ANCIENNE — l'historique ne se réécrit pas.
    expect(agenceDe(cloturee.fiche.id)).toBe(depart.fiche.id);
    expect(agenceDe(annulee.fiche.id)).toBe(depart.fiche.id);
  });

  it("signale (sans la déplacer) une ouverte déjà posée hors horaires de la nouvelle agence", async () => {
    const depart = await creerAgence(ADMIN_A, agence(), clientApp());
    // CIBLE : calendrier neuf, AUCUNE plage — tout jour y est fermé (voir
    // l'en-tête du fichier).
    const cible = await creerAgence(ADMIN_A, agence(), clientApp());
    expect(depart.accepte).toBe(true);
    expect(cible.accepte).toBe(true);
    if (!depart.accepte || !cible.accepte) return;

    const fiche = await creerSite(ADMIN_A, site(depart.fiche.id), clientApp());
    expect(fiche.accepte).toBe(true);
    if (!fiche.accepte) return;
    const siteId = fiche.fiche.id;

    const posee = await creerIntervention(
      ADMIN_A,
      intervention(siteId),
      clientApp(),
    );
    expect(posee.accepte).toBe(true);
    if (!posee.accepte) return;

    await avancerVers(posee.fiche.id, [
      {
        statut: "planifiee",
        extra: `${DUREE}, "date_planifiee" = '2027-03-15', "creneau_debut" = '2027-03-14T21:00:00.000Z', "creneau_fin" = '2027-03-14T22:00:00.000Z'`,
      },
    ]);

    const resultat = await modifierSite(
      ADMIN_A,
      siteId,
      { agence_id: cible.fiche.id, temps_trajet_min: null },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    // SIGNALÉE, PAS REFUSÉE : le changement d'agence s'écrit malgré tout, et
    // l'intervention la suit — jamais déplacée d'office sur son créneau.
    expect(resultat.interventionsDeplacees).toBe(1);
    expect(resultat.interventionsASignaler).toHaveLength(1);
    expect(resultat.interventionsASignaler?.[0]?.id).toBe(posee.fiche.id);

    const ligne = await clientOwner().$queryRawUnsafe<
      Array<{ agence_id: string }>
    >(
      `SELECT "agence_id" FROM "intervention" WHERE "id" = '${posee.fiche.id}'`,
    );
    expect(ligne[0]?.agence_id).toBe(cible.fiche.id);
  });

  it("ne touche à rien hors du périmètre de la société active (I1)", async () => {
    const avant = await clientOwner().$queryRawUnsafe<
      Array<{ agence_id: string }>
    >(
      `SELECT "agence_id" FROM "intervention" WHERE "id" = '${INTERVENTION_B1}'`,
    );

    const depart = await creerAgence(ADMIN_A, agence(), clientApp());
    const cible = await creerAgence(ADMIN_A, agence(), clientApp());
    expect(depart.accepte).toBe(true);
    expect(cible.accepte).toBe(true);
    if (!depart.accepte || !cible.accepte) return;

    const fiche = await creerSite(ADMIN_A, site(depart.fiche.id), clientApp());
    expect(fiche.accepte).toBe(true);
    if (!fiche.accepte) return;

    const resultat = await modifierSite(
      ADMIN_A,
      fiche.fiche.id,
      { agence_id: cible.fiche.id, temps_trajet_min: null },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    // L'intervention de la SOCIÉTÉ B, sur un site qui n'a rien à voir avec
    // celui-ci, n'a pas bougé — la lecture des « ouvertes » ne porte aucun
    // filtre de société écrit en TypeScript (RLS forme « parc » seule), et
    // c'est exactement ce que ce témoin éprouve.
    const apres = await clientOwner().$queryRawUnsafe<
      Array<{ agence_id: string }>
    >(
      `SELECT "agence_id" FROM "intervention" WHERE "id" = '${INTERVENTION_B1}'`,
    );
    expect(apres[0]?.agence_id).toBe(avant[0]?.agence_id);
  });
});
