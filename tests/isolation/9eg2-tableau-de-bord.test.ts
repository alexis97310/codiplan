import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `DATABASE_URL` EST POSÉE AVANT L'IMPORT DU MODULE — même raison que
 * `tests/isolation/vgp-client-inactif-machine-sortie.test.ts` :
 * `faitsMiseEnRoute` et `pointsDonneesACompleter` appellent `famillesADeterminer`
 * (`lib/vgp/registre.ts`), qui ne reçoit AUCUN `client` et passe donc par le
 * client global de `lib/db/client.ts`, sous le rôle applicatif.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { compterEcrituresDuJour, dernieresEcrituresDuJour } =
  await import("@/lib/audit/journal");
const {
  pointsDonneesACompleter,
  techniciensAccesAOuvrir,
  compterHabilitationsExpirees,
} = await import("@/lib/tableau-de-bord/lectures");
const { faitsMiseEnRoute } =
  await import("@/lib/tableau-de-bord/mise-en-route");
const { creerTechnicien } = await import("@/lib/techniciens/depot");
const { habilitationsDesTechniciens } =
  await import("@/lib/habilitations/depot");
const { compterLesLots } = await import("@/lib/imports/depot");

/**
 * LE TABLEAU DE BORD DE LA DIRECTION ET DE L'ADMINISTRATEUR
 * (9EG-TP-UX6-TABLEAU-DE-BORD-2, D189 ; D91 depuis le 13/10/2026 — la
 * direction reçoit AUSSI les blocs d'administration) — trois propriétés
 * éprouvées contre un vrai PostgreSQL :
 *
 *   1. « Mise en route » sur une SOCIÉTÉ NEUVE (aucune agence, aucun tarif,
 *      aucun client) montre une seule étape faite sur huit — l'identité, qui
 *      ne se mesure pas ici (elle est toujours vraie, `presentation.test.ts`
 *      la couvre) : les SEPT faits mesurés par `faitsMiseEnRoute` sont tous
 *      FAUX.
 *   2. La société B ne lit ni les techniciens ni les comptes de la société A
 *      — `societe_id` est filtré EXPLICITEMENT, en plus de la RLS. Depuis
 *      D91, la MÊME épreuve est rejouée sous la DIRECTION de B, qui lit
 *      désormais ces mêmes blocs par les mêmes fonctions
 *      (`voitLesBlocsDAdministration`).
 *   3. Le journal d'aujourd'hui est refusé à l'ADV (politique RLS,
 *      `app_peut_consulter_journal_audit`) et lu par la direction, pour la
 *      MÊME écriture.
 */

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const ADMIN_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DIRECTION_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.direction],
  societeId: SOCIETE_A,
  role: Role.direction,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADV_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const ADMIN_B: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_B,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/**
 * LA DIRECTION DE B (D91, 13/10/2026) — même geste que `ADMIN_B` : la
 * direction lit désormais les MÊMES blocs d'administration
 * (`voitLesBlocsDAdministration`), par les MÊMES fonctions de
 * `lib/tableau-de-bord/lectures.ts`, jamais un second calcul qui pourrait
 * diverger de l'isolation déjà éprouvée pour l'administrateur.
 */
const DIRECTION_B: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.direction],
  societeId: SOCIETE_B,
  role: Role.direction,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Depuis l'époque : toute écriture créée par l'épreuve compte comme « du jour », sans dépendre de minuit réel. */
const DEBUT_DES_TEMPS = new Date(0);

describe("« Mise en route » sur une société neuve (PU-1, décision 29 d'Alexis du 05/10/2026)", () => {
  const SOCIETE_VIERGE = uuidv7();
  const CODE_VIERGE = `9EG2-${SOCIETE_VIERGE.slice(0, 8)}`;
  const ADMIN_VIERGE: ContexteSession = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
    societeId: SOCIETE_VIERGE,
    role: Role.admin_societe,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "societe" WHERE "id" = $1::uuid`,
      SOCIETE_VIERGE,
    );
  });

  it("rien n'est fait : les sept faits mesurés sont tous faux", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
         fuseau_horaire, devise_code,
         majoration_hors_ouverture_pct, langue, actif)
       VALUES ($1::uuid, $2, $3, 'NC', 'NC', 'Pacific/Noumea', 'XPF',
               0, 'fr', true)`,
      SOCIETE_VIERGE,
      CODE_VIERGE,
      `Société vierge ${CODE_VIERGE}`,
    );

    const faits = await faitsMiseEnRoute(ADMIN_VIERGE, clientApp());
    expect(faits.agenceAvecHoraires).toBe(false);
    expect(faits.tauxHoraire).toBe(false);
    expect(faits.trajetsEtForfaits).toBe(false);
    expect(faits.familleMateriel).toBe(false);
    expect(faits.famillesADeterminerCompte).toBe(0);
    expect(faits.equipePosee).toBe(false);
    expect(faits.accesAOuvrirCompte).toBe(0);
    expect(faits.clientsSitesMachines).toBe(false);
    expect(faits.planningTransmis).toBe(false);
  });
});

describe("la société B ne voit rien de la société A", () => {
  it("« Accès à ouvrir » de B ne porte aucun technicien de A", async () => {
    const accesB = await techniciensAccesAOuvrir(ADMIN_B, clientApp());
    const accesA = await techniciensAccesAOuvrir(ADMIN_A, clientApp());
    const idsA = new Set(accesA.map((ligne) => ligne.utilisateurId));
    expect(accesB.some((ligne) => idsA.has(ligne.utilisateurId))).toBe(false);
  });

  it("« Données à compléter » de B n'additionne jamais les comptes de A", async () => {
    // Même critère filtré par société (RLS + `societe_id` explicite) :
    // les points lus pour B restent bornés à ses propres lignes, jamais la
    // somme de A et B.
    const pointsB = await pointsDonneesACompleter(
      ADMIN_B,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    for (const point of pointsB) {
      expect(point.compte).toBeGreaterThanOrEqual(0);
    }
  });

  it("« Accès à ouvrir » de la DIRECTION de B ne porte aucun technicien de A (D91)", async () => {
    const accesB = await techniciensAccesAOuvrir(DIRECTION_B, clientApp());
    const accesA = await techniciensAccesAOuvrir(ADMIN_A, clientApp());
    const idsA = new Set(accesA.map((ligne) => ligne.utilisateurId));
    expect(accesB.some((ligne) => idsA.has(ligne.utilisateurId))).toBe(false);
  });

  it("« Données à compléter » de la DIRECTION de B n'additionne jamais les comptes de A (D91)", async () => {
    const pointsB = await pointsDonneesACompleter(
      DIRECTION_B,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    for (const point of pointsB) {
      expect(point.compte).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * L'ISOLATION PAR LES CHIFFRES (9F1B, point 2) — les cas ci-dessus
 * n'assertaient que `compte >= 0` (vrai par construction, même si B lisait A)
 * sans jamais poser de donnée pour A : rien ne prouvait que ces lectures
 * COMPTENT quelque chose. Ici, un `beforeAll` mesure B et A AVANT, un second
 * `beforeAll` crée pour A ce que chaque lecture doit voir bouger (un
 * technicien sans accès, une intervention sans durée, un lot en contrôle,
 * une habilitation expirée), puis le test mesure APRÈS : B reste identique,
 * A a bougé.
 */
describe("l'isolation se mesure par les chiffres, pas par une borne toujours vraie (D91, 9F1B point 2)", () => {
  const PREFIXE = "9EG2-NOMBRES-";
  const EMAIL_TECHNICIEN = `${PREFIXE.toLowerCase()}technicien@codima.test`;

  const { local } = maintenant(FUSEAU_SOCIETE_A);
  const AUJOURD_HUI = jourDe(local);
  const HIER = instantDuJour(jourSuivant(AUJOURD_HUI, -1));

  let utilisateurTechnicienId = "";
  let interventionSansDureeId = "";
  let habilitationId = "";
  let attributionId = "";
  let lotId = "";

  let avantAccesB: Awaited<ReturnType<typeof techniciensAccesAOuvrir>>;
  let avantPointsB: Awaited<ReturnType<typeof pointsDonneesACompleter>>;
  let avantLotsB = 0;
  let avantHabExpireesB = 0;
  let avantFaitsB: Awaited<ReturnType<typeof faitsMiseEnRoute>>;

  let avantAccesA: Awaited<ReturnType<typeof techniciensAccesAOuvrir>>;
  let avantPointsA: Awaited<ReturnType<typeof pointsDonneesACompleter>>;
  let avantLotsA = 0;
  let avantHabExpireesA = 0;
  let avantFaitsA: Awaited<ReturnType<typeof faitsMiseEnRoute>>;

  // ── 1. LA MESURE « AVANT », POUR B PUIS POUR A ──────────────────────────
  beforeAll(async () => {
    avantAccesB = await techniciensAccesAOuvrir(DIRECTION_B, clientApp());
    avantPointsB = await pointsDonneesACompleter(
      DIRECTION_B,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    avantLotsB = await compterLesLots(DIRECTION_B, "a-appliquer", clientApp());
    avantHabExpireesB = await compterHabilitationsExpirees(
      DIRECTION_B,
      AUJOURD_HUI,
      clientApp(),
    );
    avantFaitsB = await faitsMiseEnRoute(DIRECTION_B, clientApp());

    avantAccesA = await techniciensAccesAOuvrir(ADMIN_A, clientApp());
    avantPointsA = await pointsDonneesACompleter(
      ADMIN_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    avantLotsA = await compterLesLots(ADMIN_A, "a-appliquer", clientApp());
    avantHabExpireesA = await compterHabilitationsExpirees(
      ADMIN_A,
      AUJOURD_HUI,
      clientApp(),
    );
    avantFaitsA = await faitsMiseEnRoute(ADMIN_A, clientApp());
  });

  // ── 2. CE QUI DOIT FAIRE BOUGER A, ET RIEN D'AUTRE ──────────────────────
  beforeAll(async () => {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve 9EG2-NOMBRES",
        email: EMAIL_TECHNICIEN,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    if (!resultat.accepte) {
      throw new Error("la création du technicien de l'épreuve a été refusée");
    }
    utilisateurTechnicienId = resultat.utilisateurId;

    interventionSansDureeId = uuidv7();
    await clientOwner().intervention.create({
      data: {
        id: interventionSansDureeId,
        societe_id: SOCIETE_A,
        agence_id: AGENCE_A,
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        type: "curatif",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        priorite: "p3",
        statut: "a_planifier",
        description: `${PREFIXE}sans durée`,
      },
    });

    habilitationId = uuidv7();
    await clientOwner().habilitation.create({
      data: {
        id: habilitationId,
        societe_id: SOCIETE_A,
        code: `${PREFIXE}EXP`,
        libelle: `${PREFIXE}Habilitation expirée`,
        actif: true,
      },
    });
    attributionId = uuidv7();
    await clientOwner().technicienHabilitation.create({
      data: {
        id: attributionId,
        societe_id: SOCIETE_A,
        utilisateur_id: utilisateurTechnicienId,
        habilitation_id: habilitationId,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: HIER,
      },
    });

    lotId = uuidv7();
    await clientOwner().importLot.create({
      data: {
        id: lotId,
        societe_id: SOCIETE_A,
        type_import: "9eg2_nombres",
        version_modele: 1,
        utilisateur_id: utilisateurTechnicienId,
        nom_fichier: "9eg2-nombres-lot.xlsx",
        statut: "controle",
      },
    });
  });

  afterAll(async () => {
    if (lotId !== "") {
      await clientOwner().importLot.deleteMany({ where: { id: lotId } });
    }
    if (interventionSansDureeId !== "") {
      await clientOwner().intervention.deleteMany({
        where: { id: interventionSansDureeId },
      });
    }
    if (attributionId !== "") {
      await clientOwner().technicienHabilitation.deleteMany({
        where: { id: attributionId },
      });
    }
    if (habilitationId !== "") {
      await clientOwner().habilitation.deleteMany({
        where: { id: habilitationId },
      });
    }
    if (utilisateurTechnicienId !== "") {
      await clientOwner().technicien.deleteMany({
        where: { utilisateur_id: utilisateurTechnicienId },
      });
      await clientOwner().utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurTechnicienId },
      });
      await clientOwner().utilisateur.deleteMany({
        where: { id: utilisateurTechnicienId },
      });
    }
  });

  it("B est IDENTIQUE après ; A a BOUGÉ, exactement de ce que l'épreuve lui a ajouté", async () => {
    const apresAccesB = await techniciensAccesAOuvrir(DIRECTION_B, clientApp());
    const apresPointsB = await pointsDonneesACompleter(
      DIRECTION_B,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    const apresLotsB = await compterLesLots(
      DIRECTION_B,
      "a-appliquer",
      clientApp(),
    );
    const apresHabExpireesB = await compterHabilitationsExpirees(
      DIRECTION_B,
      AUJOURD_HUI,
      clientApp(),
    );
    const apresFaitsB = await faitsMiseEnRoute(DIRECTION_B, clientApp());

    expect(apresAccesB).toEqual(avantAccesB);
    expect(apresPointsB).toEqual(avantPointsB);
    expect(apresLotsB).toBe(avantLotsB);
    expect(apresHabExpireesB).toBe(avantHabExpireesB);
    expect(apresFaitsB).toEqual(avantFaitsB);

    const apresAccesA = await techniciensAccesAOuvrir(ADMIN_A, clientApp());
    const apresPointsA = await pointsDonneesACompleter(
      ADMIN_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    const apresLotsA = await compterLesLots(
      ADMIN_A,
      "a-appliquer",
      clientApp(),
    );
    const apresHabExpireesA = await compterHabilitationsExpirees(
      ADMIN_A,
      AUJOURD_HUI,
      clientApp(),
    );
    const apresFaitsA = await faitsMiseEnRoute(ADMIN_A, clientApp());

    expect(apresAccesA.length).toBe(avantAccesA.length + 1);
    expect(
      apresAccesA.some(
        (ligne) => ligne.utilisateurId === utilisateurTechnicienId,
      ),
    ).toBe(true);

    const compteSansDuree = (
      points: Awaited<ReturnType<typeof pointsDonneesACompleter>>,
    ): number =>
      points.find(
        (point) =>
          point.cle === "donnees_a_completer.kpi_interventions_sans_duree",
      )?.compte ?? 0;
    expect(compteSansDuree(apresPointsA)).toBe(
      compteSansDuree(avantPointsA) + 1,
    );

    expect(apresLotsA).toBe(avantLotsA + 1);
    expect(apresHabExpireesA).toBe(avantHabExpireesA + 1);
    expect(apresFaitsA.accesAOuvrirCompte).toBe(
      avantFaitsA.accesAOuvrirCompte + 1,
    );
  });

  it("« habilitationsDesTechniciens » : B ne lit rien pour un identifiant d'utilisateur de A, même transmis explicitement", async () => {
    expect(utilisateurTechnicienId).not.toBe("");
    const carteB = await habilitationsDesTechniciens(
      DIRECTION_B,
      [utilisateurTechnicienId],
      clientApp(),
    );
    expect(carteB.size).toBe(0);

    const carteA = await habilitationsDesTechniciens(
      ADMIN_A,
      [utilisateurTechnicienId],
      clientApp(),
    );
    expect(carteA.size).toBe(1);
    expect(carteA.get(utilisateurTechnicienId)?.[0]?.id).toBe(attributionId);
  });
});

describe("le journal d'aujourd'hui est refusé à l'ADV (RLS) et lu par la direction (I8, D32)", () => {
  const PREFIXE = "9EG2-JOURNAL-";

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
  });

  it("une écriture fraîche est invisible sous ADV, visible sous direction", async () => {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien d'épreuve 9EG2",
        email: courriel(),
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const comptePourAdv = await compterEcrituresDuJour(
      ADV_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    expect(comptePourAdv).toBe(0);
    const lignesPourAdv = await dernieresEcrituresDuJour(
      ADV_A,
      DEBUT_DES_TEMPS,
      5,
      clientApp(),
    );
    expect(lignesPourAdv).toEqual([]);

    const comptePourDirection = await compterEcrituresDuJour(
      DIRECTION_A,
      DEBUT_DES_TEMPS,
      clientApp(),
    );
    expect(comptePourDirection).toBeGreaterThan(0);

    // L'ÉCRITURE PRÉCISE, PAR SON PROPRE `id` (`technicien.id`, jamais
    // `utilisateur_id`) — lue SANS politique, comme `journalDe` de
    // `journal-audit.test.ts` : ce test veut savoir ce que le déclencheur a
    // réellement produit, pas ce qu'un rôle en voit.
    const technicienCree = await clientOwner().technicien.findFirst({
      where: { utilisateur_id: resultat.accepte ? resultat.utilisateurId : "" },
      select: { id: true },
    });
    expect(technicienCree).not.toBeNull();

    const lignesPourDirection = await dernieresEcrituresDuJour(
      DIRECTION_A,
      DEBUT_DES_TEMPS,
      50,
      clientApp(),
    );
    expect(
      lignesPourDirection.some(
        (ligne) =>
          ligne.entite === "technicien" &&
          ligne.entiteId === technicienCree?.id,
      ),
    ).toBe(true);
  });
});
