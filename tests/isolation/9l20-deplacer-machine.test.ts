import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";

import { clientApp, fermerClients, urlApp } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  MODELE_A,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * DÉPLACER UNE MACHINE (9L20-DEPLACER-MACHINE, décision d'Alexis du
 * 10/11/2026) — le cloisonnement et les refus nommés de `deplacerMachine` et
 * de `modifierMachine` (`lib/machines/depot.ts`), sur la vraie table, sous
 * le contexte applicatif.
 *
 * `MACHINE_A1` porte déjà DEUX interventions ouvertes (`INTERVENTION_A1`,
 * `INTERVENTION_A2`, voir `setup/global.ts`) : une fixture déjà en place
 * sert l'épreuve du refus nommé, sans en ajouter une seule ligne. `MACHINE_A2`
 * n'en porte aucune — c'est elle qui prouve le chemin accepté, et elle est
 * remise sur son site d'origine (`SITE_A1_S2`) à la fin de chaque épreuve qui
 * la déplace : une fixture partagée ne doit pas sortir de ce fichier changée
 * pour les épreuves qui la lisent après celle-ci.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { deplacerMachine, lireMachine, modifierMachine } =
  await import("@/lib/machines/depot");
const { historiqueDesEmplacements } =
  await import("@/lib/machines/emplacements");
const { avecContexteApplicatif } = await import("@/lib/db/client");

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const SESSION_INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_INTERNE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/**
 * LA LECTURE DU JOURNAL EXIGE `admin_societe` OU `direction` (matrice §5.2,
 * `consulter_journal_audit`) — la politique `journal_audit_lecture` filtre
 * SOUS RLS, un rôle qui ne l'a pas (`adv`, utilisé ci-dessus pour les gestes
 * eux-mêmes) rend zéro ligne sans qu'aucun refus ne soit nommé. Voir la note
 * de tête de `peutConsulterEmplacements`, `app/(back-office)/parc/[id]/
 * page.tsx`.
 */
const SESSION_ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe] as string,
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/**
 * D283 (23/11/2026, 9L38) — RM, RS et ADV lisent désormais l'historique des
 * emplacements (politique `journal_audit_lecture_emplacements_machine`,
 * migration `20261124100000_historique_emplacements_tous_roles_9l38`), sans
 * avoir `consulter_journal_audit`. `UTILISATEUR_INTERNE_A`/`B` ne portent pas
 * de rôle propre en base : comme `SESSION_INTERNE_A/B` ci-dessus (déjà `adv`),
 * le rôle de la session est celui que le scénario arme, pas une colonne lue.
 */
const SESSION_RM_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_RS_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.responsable_sav,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_RM_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_DIRECTION_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.direction] as string,
  societeId: SOCIETE_A,
  role: Role.direction,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** La fiche complète de `SaisieMachine`, pour `modifierMachine` — même gabarit que `qt2-retouches-r1-r2.test.ts`. */
const SAISIE_MACHINE_A2_ACTUELLE = {
  modele_id: MODELE_A,
  client_id: CLIENT_A1,
  site_id: SITE_A1_S2,
  numero_serie: "SN-A2",
  reference_interne: null,
  localisation: null,
  facture_origine: null,
  date_mise_en_service: null,
  date_vente: null,
  garantie_fin: null,
  annee_fabrication: null,
  statut: "en_service" as const,
  criticite: "normale" as const,
  source_creation: "terrain" as const,
  machine_remplacee_id: null,
  complet: true,
};

describe("deplacerMachine — cloisonnement (I1)", () => {
  it("une société B ne déplace jamais une machine de la société A : refus « introuvable », rien n'est écrit", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_B,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S1 },
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.site_id).toBe(SITE_A1_S2);
  });
});

describe("deplacerMachine — les interventions ouvertes refusent, en nommant leur nombre", () => {
  it("MACHINE_A1 porte deux interventions ouvertes : refus nommé, rien n'est écrit", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A1,
      { nouveau_site_id: SITE_A1_S2 },
      false,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "interventions_ouvertes",
      nombre: 2,
    });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A1);
    expect(fiche?.site_id).toBe(SITE_A1_S1);
  });
});

describe("deplacerMachine — le site identique refuse", () => {
  it("MACHINE_A2 vers son site actuel : refus nommé « site_identique »", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S2 },
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "site_identique" });
  });
});

describe("deplacerMachine — un autre client exige une confirmation explicite", () => {
  it("MACHINE_A2 vers un site de CLIENT_A2, sans confirmation : refus nommé, rien n'est écrit", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A2_S1 },
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "confirmation_requise" });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.site_id).toBe(SITE_A1_S2);
    expect(fiche?.client_id).toBe(CLIENT_A1);
  });

  it("la MÊME cible, confirmée : acceptée, le client suit le site — puis remise en place", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A2_S1 },
      true,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.site_id).toBe(SITE_A2_S1);
    expect(fiche?.client_id).toBe(CLIENT_A2);

    // Remise dans son état initial.
    const retour = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S2 },
      true,
      clientApp(),
    );
    expect(retour).toEqual({ accepte: true });
    const remise = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(remise?.site_id).toBe(SITE_A1_S2);
    expect(remise?.client_id).toBe(CLIENT_A1);
  });
});

describe("deplacerMachine — le chemin accepté est TRACÉ au journal", () => {
  it("MACHINE_A2 vers SITE_A1_S1 (même client) : accepté, et lisible dans l'historique des emplacements", async () => {
    const resultat = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S1 },
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.site_id).toBe(SITE_A1_S1);
    expect(fiche?.client_id).toBe(CLIENT_A1);

    // LA LECTURE DU JOURNAL EXIGE `admin_societe`/`direction` (voir
    // `SESSION_ADMIN_A`) — distincte du rôle qui fait le geste ci-dessus.
    const historique = await historiqueDesEmplacements(
      SESSION_ADMIN_A,
      MACHINE_A2,
      clientApp(),
    );
    const trace = historique.find(
      (e) => e.ancienSiteId === SITE_A1_S2 && e.nouveauSiteId === SITE_A1_S1,
    );
    expect(trace).toBeDefined();
    expect(trace?.utilisateurId).toBe(UTILISATEUR_INTERNE_A);

    // Remise dans son état initial.
    const retour = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S2 },
      false,
      clientApp(),
    );
    expect(retour).toEqual({ accepte: true });
    const remise = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(remise?.site_id).toBe(SITE_A1_S2);
  });
});

describe("modifierMachine — l'ancien formulaire ne déplace plus jamais le site", () => {
  it("un site différent de la fiche : refus nommé « deplacement_requis », rien n'est écrit", async () => {
    const resultat = await modifierMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { ...SAISIE_MACHINE_A2_ACTUELLE, site_id: SITE_A1_S1 },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "deplacement_requis" });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.site_id).toBe(SITE_A1_S2);
  });

  it("témoin — le MÊME site que la fiche : la correction reste acceptée", async () => {
    const resultat = await modifierMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      SAISIE_MACHINE_A2_ACTUELLE,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true, id: MACHINE_A2 });
  });
});

/**
 * D283 (23/11/2026, 9L38 — seconde moitié de D280) : RM, RS et ADV lisent
 * l'historique des emplacements SANS `consulter_journal_audit`, par la
 * fonction SECURITY DEFINER `app_historique_emplacements_machine`. Le journal
 * entier, lui, reste fermé — une ligne qui n'est PAS un déménagement (un
 * champ modifié sans toucher le site) reste illisible pour ces trois rôles,
 * lue directement sur `journal_audit` plutôt que par cette fonction.
 */
describe("historiqueDesEmplacements — ouvert à tout rôle qui voit la fiche (D283)", () => {
  it("MACHINE_A2 déplacée : RM, RS et ADV de la société A lisent la trace, puis remise en place", async () => {
    const deplacement = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S1 },
      false,
      clientApp(),
    );
    expect(deplacement).toEqual({ accepte: true });

    for (const session of [SESSION_RM_A, SESSION_RS_A, SESSION_INTERNE_A]) {
      const historique = await historiqueDesEmplacements(
        session,
        MACHINE_A2,
        clientApp(),
      );
      const trace = historique.find(
        (e) => e.ancienSiteId === SITE_A1_S2 && e.nouveauSiteId === SITE_A1_S1,
      );
      expect(trace, session.role).toBeDefined();
    }

    // La direction et l'administrateur, déjà ouverts avant ce lot, restent
    // inchangés.
    const historiqueDirection = await historiqueDesEmplacements(
      SESSION_DIRECTION_A,
      MACHINE_A2,
      clientApp(),
    );
    expect(
      historiqueDirection.some(
        (e) => e.ancienSiteId === SITE_A1_S2 && e.nouveauSiteId === SITE_A1_S1,
      ),
    ).toBe(true);

    // Remise dans son état initial.
    const retour = await deplacerMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { nouveau_site_id: SITE_A1_S2 },
      false,
      clientApp(),
    );
    expect(retour).toEqual({ accepte: true });
  });

  it("une société B ne lit jamais les déménagements d'une machine de la société A", async () => {
    const historique = await historiqueDesEmplacements(
      SESSION_RM_B,
      MACHINE_A2,
      clientApp(),
    );
    expect(historique).toEqual([]);
  });

  it("une ligne du journal qui n'est PAS un déménagement (site inchangé) reste illisible à RM, visible à l'administrateur", async () => {
    const modification = await modifierMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      { ...SAISIE_MACHINE_A2_ACTUELLE, localisation: "Entrepôt nord" },
      clientApp(),
    );
    expect(modification).toEqual({ accepte: true, id: MACHINE_A2 });

    const ligneNonDeplacement = await avecContexteApplicatif(
      SESSION_ADMIN_A,
      (tx) =>
        tx.journalAudit.findFirst({
          where: {
            societe_id: SOCIETE_A,
            entite: "machine",
            entite_id: MACHINE_A2,
            action: "modification",
            valeurs_apres: { path: ["localisation"], equals: "Entrepôt nord" },
          },
          select: { id: true },
        }),
      clientApp(),
    );
    expect(ligneNonDeplacement).not.toBeNull();
    const idLigne = ligneNonDeplacement?.id as string;

    const lueParAdmin = await avecContexteApplicatif(
      SESSION_ADMIN_A,
      (tx) => tx.journalAudit.findFirst({ where: { id: idLigne } }),
      clientApp(),
    );
    expect(lueParAdmin).not.toBeNull();

    const lueParRm = await avecContexteApplicatif(
      SESSION_RM_A,
      (tx) => tx.journalAudit.findFirst({ where: { id: idLigne } }),
      clientApp(),
    );
    expect(lueParRm).toBeNull();

    // Remise dans son état initial.
    const retour = await modifierMachine(
      SESSION_INTERNE_A,
      MACHINE_A2,
      SAISIE_MACHINE_A2_ACTUELLE,
      clientApp(),
    );
    expect(retour).toEqual({ accepte: true, id: MACHINE_A2 });
  });
});
