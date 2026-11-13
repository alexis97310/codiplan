import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  accepterRattachementClient,
  comptesDuPortailDuClient,
  inviterClientAuPortail,
  rattachementsEnAttenteDuCompte,
  RefusInvitationClient,
  refuserRattachementClient,
  revoquerAccesPortailClient,
} from "@/lib/auth/lien-d-acces";
import { habilitationsDuCompte } from "@/lib/auth/societe-active";
import { Role } from "@/lib/auth/roles";
import { rattachementsDuCompte } from "@/lib/portail/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D96, D230 (9J02A-REPRISE-9J02) — INVITER UN CLIENT AU PORTAIL, ET RÉVOQUER
 * SON ACCÈS.
 *
 * ## Pourquoi `administrer_utilisateurs`, et pas `gerer_client_site`
 *
 * D230 : inviter un client ouvre souvent une identité, et la base ne
 * l'accepte que de `app_peut_administrer_identites()` — admin_societe et
 * direction (D37/D199), jamais l'ADV malgré D130. Ces épreuves rejouent donc,
 * pour `inviterClientAuPortail`/`revoquerAccesPortailClient`, le même refus
 * ADV que `tests/isolation/acces-technicien.test.ts` tient déjà pour le
 * chemin technicien — et c'est cette identité de garde qui vaut pour une
 * REQUÊTE FORGÉE : les routes d'API n'ajoutent rien à `exigerCapacite` puis
 * cet appel direct.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DIRECTION_A = { ...ADMIN_A, role: Role.direction };
const ADV_A = { ...ADMIN_A, role: Role.adv };

const PREFIXE = "9j02acces-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_client_site" WHERE "utilisateur_client_id" IN (
       SELECT "id" FROM "utilisateur_client" WHERE "utilisateur_id" IN (
         SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1))`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_client" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
});

afterAll(fermerClients);

describe("inviterClientAuPortail — l'invitation", () => {
  it("ouvre l'identité, accorde le rattachement ACTIF, émet un jeton, trace « ouverture_identite »", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.enAttente).toBe(false);
    expect(resultat.url).not.toBeNull();
    expect(resultat.url?.length).toBeGreaterThan(0);

    // L'ADRESSE INVITÉE VOYAGE DANS LE LIEN LUI-MÊME (9J21, point 6) :
    // `/premier-acces` l'affichera en lecture seule SANS lire le jeton — elle
    // doit donc déjà être dans `callbackURL`, avant même que la personne
    // invitée ne clique.
    const callbackURL = new URL(
      resultat.url ?? "",
      "http://localhost",
    ).searchParams.get("callbackURL");
    expect(callbackURL).not.toBeNull();
    expect(callbackURL).toBe(
      `/premier-acces?email=${encodeURIComponent(email)}`,
    );

    const [rattachement] = await clientOwner().$queryRawUnsafe<
      { actif: boolean; societe_id: string; accepte_le: Date | null }[]
    >(
      `SELECT uc.actif, uc.societe_id::text, uc.accepte_le FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 AND uc.client_id = $2::uuid`,
      email,
      CLIENT_A1,
    );
    expect(rattachement).toBeDefined();
    expect(rattachement?.actif).toBe(true);
    expect(rattachement?.societe_id).toBe(SOCIETE_A);
    // UNE IDENTITÉ NOUVELLE EST ACCEPTÉE D'EMBLÉE (9L04, D249) : son premier
    // accès — choisir un mot de passe par ce lien — vaut lui-même acceptation.
    expect(rattachement?.accepte_le).not.toBeNull();

    // JAMAIS DE LIGNE `utilisateur_societe` (D10, D96).
    const [habilitation] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_societe" us
         JOIN "utilisateur" u ON u.id = us.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(habilitation).toBeUndefined();

    const [compte] = await clientOwner().$queryRawUnsafe<
      { mot_de_passe: string | null }[]
    >(
      `SELECT c.mot_de_passe FROM "compte" c
         JOIN "utilisateur" u ON u.id = c.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(compte?.mot_de_passe).toBeNull();

    const [trace] = await clientOwner().$queryRawUnsafe<
      {
        evenement: string;
        utilisateur_id: string;
        societe_id_cible: string;
        role: string;
      }[]
    >(
      `SELECT ja.evenement::text, ja.utilisateur_id::text, ja.societe_id_cible::text, ja.role::text
         FROM "journal_acces" ja
         JOIN "utilisateur" u ON u.id = (
           SELECT uc.utilisateur_id FROM "utilisateur_client" uc
            WHERE uc.client_id = $2::uuid AND uc.utilisateur_id IN (
              SELECT id FROM "utilisateur" WHERE email = $1))
        WHERE ja.evenement = 'ouverture_identite'
        ORDER BY ja.horodatage DESC LIMIT 1`,
      email,
      CLIENT_A1,
    );
    expect(trace).toBeDefined();
    // L'AUTEUR EST L'ADMINISTRATEUR, jamais le compte client (D162).
    expect(trace?.utilisateur_id).toBe(ADMIN_A.utilisateurId);
    expect(trace?.societe_id_cible).toBe(SOCIETE_A);
    expect(trace?.role).toBe(Role.admin_societe);
  });

  it("D199 — la DIRECTION invite avec le même succès que l'administrateur", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      DIRECTION_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("un client introuvable (autre société) reçoit un refus NOMMÉ", async () => {
    const email = courriel();
    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_B1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "client_introuvable" });

    const [identite] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identite).toBeUndefined();
  });

  it("un rôle qui n'administre pas (ADV) est refusé AVANT toute écriture — requête forgée (D230)", async () => {
    const email = courriel();
    await expect(
      inviterClientAuPortail(ADV_A, CLIENT_A1, email, clientApp()),
    ).rejects.toBeInstanceOf(RefusInvitationClient);

    const [identite] = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identite).toBeUndefined();
  });

  it("une adresse qui est DÉJÀ un compte interne de la société active est refusée NOMMÉMENT (9J21)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Compte interne", email },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: SOCIETE_A,
        role: Role.adv,
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "compte_interne" });

    // AUCUN RATTACHEMENT CLIENT N'A ÉTÉ POSÉ sur ce compte interne.
    const rattachement = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(rattachement).toHaveLength(0);
  });

  /**
   * C1 (étude du 08/11, décision d'Alexis du 08/11 ~09:00) — UNE IDENTITÉ
   * CONNUE D'UNE AUTRE SOCIÉTÉ. Les trois scénarios ci-dessous posent la
   * fixture directement (comme le test « compte interne » ci-dessus) plutôt
   * que d'emprunter les comptes partagés `PORTAIL_B_CLIENT`/
   * `UTILISATEUR_INTERNE_B` du harnais global : ceux-ci survivent à TOUT le
   * run d'isolation, et les muter (nouveau rattachement, révocation) les
   * ferait dériver sous les épreuves d'un AUTRE fichier. `afterEach`
   * nettoie par motif de courriel, quelle que soit la société où la fixture
   * a été posée.
   */
  it("C1(a) — une identité CLIENTE déjà ACTIVE (mot de passe posé) d'une AUTRE société est acceptée, mais EN ATTENTE (9L04, D249 — revient sur D233)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Client de B, déjà actif", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true, url: null, enAttente: true });

    const rattachements = await clientOwner().$queryRawUnsafe<
      {
        societe_id: string;
        client_id: string;
        accepte_le: Date | null;
        nom_client_invitation: string | null;
      }[]
    >(
      `SELECT societe_id::text, client_id::text, accepte_le, nom_client_invitation
         FROM "utilisateur_client"
        WHERE utilisateur_id = $1::uuid ORDER BY societe_id`,
      utilisateurId,
    );
    expect(rattachements).toHaveLength(2);
    const nouveau = rattachements.find(
      (r) => r.societe_id === SOCIETE_A && r.client_id === CLIENT_A1,
    );
    expect(nouveau).toBeDefined();
    // EN ATTENTE : ni acceptée, ni lisible par le compte tant qu'elle ne l'a
    // pas acceptée — le cliché du nom du client est posé (9L04).
    expect(nouveau?.accepte_le).toBeNull();
    expect(nouveau?.nom_client_invitation).not.toBeNull();
    expect(
      rattachements.some(
        (r) => r.societe_id === SOCIETE_B && r.client_id === CLIENT_B1,
      ),
    ).toBe(true);

    // UNE LIGNE NON ACCEPTÉE N'OUVRE AUCUN ACCÈS (9L04) : le compte ne lit
    // pas encore son rattachement à A1, et la société A ne lui est pas encore
    // ouverte.
    const rattachementsLus = await rattachementsDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(rattachementsLus.some((r) => r.clientId === CLIENT_A1)).toBe(false);
    const habilitations = await habilitationsDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(habilitations.some((h) => h.societeId === SOCIETE_A)).toBe(false);
  });

  it("C1(b) — une identité connue d'une autre société mais PAS ENCORE ACTIVÉE est refusée, sans jeton ni rattachement", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Client de B, en attente", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "compte_connu_ailleurs",
    });

    const rattachementA = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_client"
        WHERE utilisateur_id = $1::uuid AND societe_id = $2::uuid`,
      utilisateurId,
      SOCIETE_A,
    );
    expect(rattachementA).toHaveLength(0);

    // AUCUN JETON ÉMIS — Better Auth pose `verification.valeur = utilisateurId`
    // (même lecture que `tests/isolation/nouveau-lien-mot-de-passe-deja-pose.test.ts`).
    const jetons = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "verification" WHERE valeur = $1`,
      utilisateurId,
    );
    expect(jetons).toHaveLength(0);
  });

  it("C1(c) — une identité EMPLOYÉE d'une AUTRE société est refusée", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Employé de B", email },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: SOCIETE_B,
        role: Role.adv,
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "compte_connu_ailleurs",
    });

    const rattachement = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(rattachement).toHaveLength(0);
  });

  /**
   * D233 (c), fermé par le complément du 09/11/2026 (9K04-PORTAIL-
   * INVITATION-EMPLOYE, décision verbatim d'Alexis du 08/11 ~09:00), MOTIF
   * UNIFIÉ PAR 9L04/D249 : un EMPLOYÉ (interne) d'une autre société, même
   * déjà actif (mot de passe posé), est refusé — avec le MÊME motif neutre
   * que C1(b) et C1(c) ci-dessus, jamais `compte_interne` (réservé au cas
   * LOCAL, voir l'en-tête d'`inviterClientAuPortail`). Avant D249, ce cas
   * rendait `compte_interne`, distinct des deux autres : D249 l'unifie pour
   * ne plus révéler qu'une adresse est connue d'une autre société, ni sous
   * quelle forme.
   */
  it("C1(c), compte déjà actif — un EMPLOYÉ déjà actif (mot de passe posé) d'une AUTRE société est REFUSÉ, avec le MÊME motif neutre (D249)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Employé de B, déjà actif", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: SOCIETE_B,
        role: Role.adv,
      },
    });

    const resultat = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "compte_connu_ailleurs",
    });

    // AUCUN RATTACHEMENT CLIENT N'A ÉTÉ POSÉ, dans AUCUNE société.
    const rattachement = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    expect(rattachement).toHaveLength(0);
  });

  /**
   * COMPORTEMENT RAMENÉ PAR 9L03B (reprise de 9L04, décision d'Alexis du
   * 13/11/2026) — D249 avait fermé, pour TOUTE identité déjà ouverte, la voie
   * du lien de premier accès, qu'elle ait ou non déjà choisi un mot de passe.
   * La reprise la rouvre pour la SEULE identité JAMAIS ACTIVÉE, EXCLUSIVE à
   * la société active : une seconde invitation, pour un AUTRE client de la
   * MÊME société, lui garde son lien de premier accès et ne la met jamais
   * « en attente » — exactement comme une identité neuve (voir le test
   * juste au-dessus). Le test suivant (mot de passe déjà posé) reste, lui,
   * INCHANGÉ par la reprise : D249 continue de s'appliquer pleinement dès
   * qu'un mot de passe existe déjà.
   */
  it("une identité JAMAIS ACTIVÉE, invitée à un SECOND client, garde son lien de premier accès — traitée comme une identité neuve (9L03B, D249 amendée)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());

    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A2,
      email,
      clientApp(),
    );
    expect(second.accepte).toBe(true);
    if (!second.accepte) return;
    expect(second.url).not.toBeNull();
    expect(second.enAttente).toBe(false);
  });

  it("une seconde invitation POUR LE MÊME client RÉACTIVE la ligne, jamais ne la duplique — sans redemander d'acceptation (9L04)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const revocation = await clientOwner().$executeRawUnsafe(
      `UPDATE "utilisateur_client" uc SET actif = false
         FROM "utilisateur" u
        WHERE u.id = uc.utilisateur_id AND u.email = $1`,
      email,
    );
    expect(revocation).toBe(1);

    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      email,
      clientApp(),
    );
    expect(second.accepte).toBe(true);

    const lignes = await clientOwner().$queryRawUnsafe<
      { actif: boolean; accepte_le: Date | null }[]
    >(
      `SELECT uc.actif, uc.accepte_le FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 AND uc.client_id = $2::uuid`,
      email,
      CLIENT_A1,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.actif).toBe(true);
    // RÉACTIVATION, PAS UNE NOUVELLE OFFRE (9L04) : la ligne était acceptée
    // (identité nouvelle à sa création) — la réactiver ne redemande rien.
    expect(lignes[0]?.accepte_le).not.toBeNull();
  });

  it("une IDENTITÉ DÉJÀ OUVERTE, invitée à un SECOND client, entre EN ATTENTE sans jeton, même avec un mot de passe déjà posé (9L04, D249)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    await clientOwner().$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-de-test'
         FROM "utilisateur" u
        WHERE u.id = compte.utilisateur_id AND u.email = $1`,
      email,
    );

    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A2,
      email,
      clientApp(),
    );
    expect(second).toEqual({ accepte: true, url: null, enAttente: true });

    // AUCUNE SECONDE IDENTITÉ N'A ÉTÉ OUVERTE — une seule ligne `utilisateur`.
    const identites = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "utilisateur" WHERE email = $1`,
      email,
    );
    expect(identites).toHaveLength(1);

    const rattachements = await clientOwner().$queryRawUnsafe<
      { client_id: string; accepte_le: Date | null }[]
    >(
      `SELECT uc.client_id::text, uc.accepte_le FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 ORDER BY uc.client_id`,
      email,
    );
    expect(rattachements.map((r) => r.client_id).sort()).toEqual(
      [CLIENT_A1, CLIENT_A2].sort(),
    );
    const versA2 = rattachements.find((r) => r.client_id === CLIENT_A2);
    expect(versA2?.accepte_le).toBeNull();
  });

  /**
   * LE MESSAGE DE REFUS EST IDENTIQUE, OCTET POUR OCTET, POUR TOUT CAS
   * « ADRESSE CONNUE AILLEURS » (9L04, D249) — qu'il s'agisse d'une identité
   * pas encore activée (C1(b)) ou d'un employé déjà actif ailleurs (C1(c),
   * complément) : c'est la garantie que ce lot ajoute, vérifiée ici
   * directement sur les DEUX motifs plutôt que sur un seul.
   */
  it("D249 — les refus « connu ailleurs » rendent le MÊME motif, qu'il s'agisse d'un compte pas encore activé ou d'un employé déjà actif", async () => {
    const emailPasEncoreActive = courriel();
    const utilisateurPasEncoreActive = uuidv7();
    await clientOwner().utilisateur.create({
      data: {
        id: utilisateurPasEncoreActive,
        nom: "Pas encore activé",
        email: emailPasEncoreActive,
      },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurPasEncoreActive,
        societe_id: SOCIETE_B,
        role: Role.adv,
      },
    });

    const emailEmployeActif = courriel();
    const utilisateurEmployeActif = uuidv7();
    await clientOwner().utilisateur.create({
      data: {
        id: utilisateurEmployeActif,
        nom: "Employé déjà actif",
        email: emailEmployeActif,
      },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurEmployeActif,
        emetteur: "local:credential",
        compte_externe_id: utilisateurEmployeActif,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurEmployeActif,
        societe_id: SOCIETE_B,
        role: Role.adv,
      },
    });

    const resultatPasEncoreActive = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      emailPasEncoreActive,
      clientApp(),
    );
    const resultatEmployeActif = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A1,
      emailEmployeActif,
      clientApp(),
    );
    expect(resultatPasEncoreActive.accepte).toBe(false);
    expect(resultatEmployeActif.accepte).toBe(false);
    if (resultatPasEncoreActive.accepte || resultatEmployeActif.accepte) {
      return;
    }
    expect(resultatEmployeActif.motif).toBe(resultatPasEncoreActive.motif);
  });
});

describe("comptesDuPortailDuClient — la lecture pour la fiche client", () => {
  it("rend le compte invité, avec son courriel et son état — identité nouvelle, jamais en attente", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());

    const comptes = await comptesDuPortailDuClient(
      ADMIN_A,
      CLIENT_A1,
      clientApp(),
    );
    const compte = comptes.find((c) => c.email === email);
    expect(compte).toBeDefined();
    expect(compte?.actif).toBe(true);
    expect(compte?.enAttente).toBe(false);
  });

  it("D249 — rend `enAttente: true` pour une identité déjà ouverte, pas encore acceptée", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Client de B, déjà actif", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());

    const comptes = await comptesDuPortailDuClient(
      ADMIN_A,
      CLIENT_A1,
      clientApp(),
    );
    const compte = comptes.find((c) => c.email === email);
    expect(compte).toBeDefined();
    expect(compte?.actif).toBe(true);
    expect(compte?.enAttente).toBe(true);
  });

  /**
   * 9L03B (13/11/2026) — une ligne `actif: true`, `accepte_le: null`, posée
   * directement en base (comme le ferait un rattachement jamais accepté),
   * n'est PAS « en attente » si son titulaire n'a JAMAIS choisi de mot de
   * passe : `enAttente` ne se lit plus seulement sur `accepte_le`, il exige
   * aussi qu'un mot de passe existe déjà (voir `CompteDuPortailClient`,
   * `lib/auth/lien-d-acces.ts`). Sans ce critère, « Copier un nouveau lien »
   * (9K14) se cacherait à tort sur la ligne d'un compte invité jamais activé.
   */
  it("une ligne non acceptée MAIS JAMAIS ACTIVÉE (aucun mot de passe) n'est pas « en attente » (9L03B)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Jamais activé", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_A1,
        societe_id: SOCIETE_A,
        actif: true,
      },
    });

    const comptes = await comptesDuPortailDuClient(
      ADMIN_A,
      CLIENT_A1,
      clientApp(),
    );
    const compte = comptes.find((c) => c.email === email);
    expect(compte).toBeDefined();
    expect(compte?.actif).toBe(true);
    expect(compte?.enAttente).toBe(false);
  });
});

describe("rattachementsEnAttenteDuCompte, accepterRattachementClient, refuserRattachementClient (9L04, D249)", () => {
  it("liste l'invitation en attente avec le nom de la société et le cliché du nom du client", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Déjà actif ailleurs", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());

    const enAttente = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0]?.societeNom).not.toBeNull();
    expect(enAttente[0]?.clientNom).not.toBeNull();

    // AUCUNE AUTRE IDENTITÉ N'APPREND CETTE LISTE (D92) — même compte, mais
    // sous une AUTRE identité, ne voit rien.
    const vuDAilleurs = await rattachementsEnAttenteDuCompte(
      UTILISATEUR_PAR_ROLE[Role.admin_societe],
      clientApp(),
    );
    expect(vuDAilleurs).toHaveLength(0);
  });

  it("accepterRattachementClient pose accepte_le et ouvre la lecture du parc et de la société", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Déjà actif ailleurs", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [enAttente] = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    if (enAttente === undefined) throw new Error("fixture non créée");

    const resultat = await accepterRattachementClient(
      utilisateurId,
      enAttente.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const rattachements = await rattachementsDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(
      rattachements.some(
        (r) => r.societeId === SOCIETE_A && r.clientId === CLIENT_A1,
      ),
    ).toBe(true);
    const habilitations = await habilitationsDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(habilitations.some((h) => h.societeId === SOCIETE_A)).toBe(true);

    // PLUS RIEN EN ATTENTE.
    const resteEnAttente = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(resteEnAttente).toHaveLength(0);

    // ACCEPTER DEUX FOIS LA MÊME LIGNE ÉCHOUE NOMMÉMENT (déjà acceptée).
    const second = await accepterRattachementClient(
      utilisateurId,
      enAttente.id,
      clientApp(),
    );
    expect(second).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("refuserRattachementClient laisse la ligne INACTIVE, jamais acceptée, jamais supprimée (I6)", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Déjà actif ailleurs", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [enAttente] = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    if (enAttente === undefined) throw new Error("fixture non créée");

    const resultat = await refuserRattachementClient(
      utilisateurId,
      enAttente.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const [ligne] = await clientOwner().$queryRawUnsafe<
      { actif: boolean; accepte_le: Date | null }[]
    >(
      `SELECT actif, accepte_le FROM "utilisateur_client" WHERE id = $1::uuid`,
      enAttente.id,
    );
    expect(ligne).toBeDefined();
    expect(ligne?.actif).toBe(false);
    expect(ligne?.accepte_le).toBeNull();

    const resteEnAttente = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    expect(resteEnAttente).toHaveLength(0);
  });

  it("accepter ou refuser la ligne d'AUTRUI échoue nommément — aucune ligne ne bouge", async () => {
    const email = courriel();
    const utilisateurId = uuidv7();
    await clientOwner().utilisateur.create({
      data: { id: utilisateurId, nom: "Déjà actif ailleurs", email },
    });
    await clientOwner().compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await clientOwner().utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: CLIENT_B1,
        societe_id: SOCIETE_B,
        actif: true,
        accepte_le: new Date(),
      },
    });
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [enAttente] = await rattachementsEnAttenteDuCompte(
      utilisateurId,
      clientApp(),
    );
    if (enAttente === undefined) throw new Error("fixture non créée");

    const resultat = await accepterRattachementClient(
      UTILISATEUR_PAR_ROLE[Role.admin_societe],
      enAttente.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    const [ligne] = await clientOwner().$queryRawUnsafe<
      { accepte_le: Date | null }[]
    >(
      `SELECT accepte_le FROM "utilisateur_client" WHERE id = $1::uuid`,
      enAttente.id,
    );
    expect(ligne?.accepte_le).toBeNull();
  });
});

describe("revoquerAccesPortailClient — la révocation (I6 : jamais de suppression)", () => {
  it("bascule actif=false ; le compte ne lit PLUS son rattachement ni son parc", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { id: string; utilisateur_id: string }[]
    >(
      `SELECT uc.id::text, uc.utilisateur_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    expect(ligne).toBeDefined();
    if (ligne === undefined) throw new Error("fixture non créée");

    // TÉMOIN — avant révocation, le compte lit bien son rattachement (D92).
    const avant = await rattachementsDuCompte(
      ligne.utilisateur_id,
      clientApp(),
    );
    expect(avant.map((r) => r.clientId)).toContain(CLIENT_A1);

    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      ligne.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const apres = await rattachementsDuCompte(
      ligne.utilisateur_id,
      clientApp(),
    );
    expect(apres.map((r) => r.clientId)).not.toContain(CLIENT_A1);

    // JAMAIS DE SUPPRESSION (I6) — la ligne existe encore, révoquée.
    const [toujoursLa] = await clientOwner().$queryRawUnsafe<
      { actif: boolean }[]
    >(`SELECT actif FROM "utilisateur_client" WHERE id = $1::uuid`, ligne.id);
    expect(toujoursLa).toBeDefined();
    expect(toujoursLa?.actif).toBe(false);
  });

  /**
   * I1, décision d'Alexis du 08/11 (point (d)) — RÉVOCATION IMMÉDIATE : plus
   * aucun rattachement actif dans la société qui révoque détruit TOUTES les
   * sessions de l'identité, barème compris (aucune route du portail ne lit
   * de session détruite — `obtenirSession` relit la table à chaque requête,
   * `lib/auth/config.ts` ne pose aucun cache de cookie).
   */
  it("I1(d) — détruit toutes les sessions quand plus aucun accès actif ne reste dans la société qui révoque", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { id: string; utilisateur_id: string }[]
    >(
      `SELECT uc.id::text, uc.utilisateur_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    if (ligne === undefined) throw new Error("fixture non créée");

    // UNE SESSION, posée directement — TÉMOIN qu'elle existe avant révocation.
    await clientOwner().session.create({
      data: {
        id: uuidv7(),
        token: `${PREFIXE}${ligne.utilisateur_id}`,
        utilisateur_id: ligne.utilisateur_id,
        expire_le: new Date(Date.now() + 3_600_000),
        societe_id_active: SOCIETE_A,
      },
    });
    const avant = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "session" WHERE utilisateur_id = $1::uuid`,
      ligne.utilisateur_id,
    );
    expect(avant).toHaveLength(1);

    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      ligne.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    const apres = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "session" WHERE utilisateur_id = $1::uuid`,
      ligne.utilisateur_id,
    );
    expect(apres).toHaveLength(0);
  });

  it("I1(d) — garde la session quand un AUTRE rattachement actif reste dans la MÊME société", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const second = await inviterClientAuPortail(
      ADMIN_A,
      CLIENT_A2,
      email,
      clientApp(),
    );
    expect(second.accepte).toBe(true);

    const [ligneA1] = await clientOwner().$queryRawUnsafe<
      { id: string; utilisateur_id: string }[]
    >(
      `SELECT uc.id::text, uc.utilisateur_id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1 AND uc.client_id = $2::uuid`,
      email,
      CLIENT_A1,
    );
    if (ligneA1 === undefined) throw new Error("fixture non créée");

    await clientOwner().session.create({
      data: {
        id: uuidv7(),
        token: `${PREFIXE}${ligneA1.utilisateur_id}`,
        utilisateur_id: ligneA1.utilisateur_id,
        expire_le: new Date(Date.now() + 3_600_000),
        societe_id_active: SOCIETE_A,
      },
    });

    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      ligneA1.id,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true });

    // LE RATTACHEMENT À A2 EST TOUJOURS ACTIF — la session reste valide.
    const apres = await clientOwner().$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "session" WHERE utilisateur_id = $1::uuid`,
      ligneA1.utilisateur_id,
    );
    expect(apres).toHaveLength(1);
  });

  it("un identifiant inconnu reçoit un refus NOMMÉ", async () => {
    const resultat = await revoquerAccesPortailClient(
      ADMIN_A,
      uuidv7(),
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("un rôle qui n'administre pas (ADV) est refusé AVANT toute écriture — requête forgée (D230)", async () => {
    const email = courriel();
    await inviterClientAuPortail(ADMIN_A, CLIENT_A1, email, clientApp());
    const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT uc.id::text FROM "utilisateur_client" uc
         JOIN "utilisateur" u ON u.id = uc.utilisateur_id
        WHERE u.email = $1`,
      email,
    );
    if (ligne === undefined) throw new Error("fixture non créée");

    await expect(
      revoquerAccesPortailClient(ADV_A, ligne.id, clientApp()),
    ).rejects.toBeInstanceOf(RefusInvitationClient);

    const [toujoursActif] = await clientOwner().$queryRawUnsafe<
      { actif: boolean }[]
    >(`SELECT actif FROM "utilisateur_client" WHERE id = $1::uuid`, ligne.id);
    expect(toujoursActif?.actif).toBe(true);
  });
});
