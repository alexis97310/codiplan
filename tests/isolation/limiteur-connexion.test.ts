import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { tenterConnexion } from "@/lib/auth/connexion";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import {
  FENETRE_ECHECS_CONNEXION_SECONDES,
  SEUIL_ECHECS_CONNEXION,
  enregistrerEchec,
  identifiantConnexion,
  reinitialiserEchecs,
  verrouille,
} from "@/lib/auth/limiteur-connexion";
import { Role } from "@/lib/auth/roles";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import { ROLE_APP, SOCIETE_A } from "./setup/fixtures";

class Annulation extends Error {}

/**
 * LE LIMITEUR DE TENTATIVES DE CONNEXION (décision d'Alexis du 10/11/2026 ;
 * D258, ticket 9L07-CONNEXION-TENTATIVES-LIMITEES).
 *
 * Mesuré contre la vraie base, sous le rôle applicatif réel — comme
 * `reponses-indiscernables.test.ts`, dont ce scénario partage l'esprit : le
 * refus par verrouillage doit être INDISCERNABLE d'un refus ordinaire (D35).
 */
const auth = creerAuth(clientApp());

/**
 * L'instance qui OUVRE un compte (L1-02c). Personne ne crée son propre compte :
 * l'ouverture est un acte administratif, sous une société et par le rôle qui
 * administre.
 */
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";
const MAUVAIS_MOT_DE_PASSE = "ce-mot-de-passe-est-faux";
const EMAIL_REEL = "limiteur-reel@iso.test";
const EMAIL_INCONNU = "limiteur-inconnu@iso.test";

async function connecter(
  email: string,
  motDePasse: string,
  adresseIp: string | null = null,
) {
  return tenterConnexion({ email, motDePasse }, auth, clientApp(), adresseIp);
}

describe("limiteur de tentatives de connexion (D258)", () => {
  afterAll(fermerClients);

  let utilisateurId = "";

  beforeAll(async () => {
    const compte = await authAdmin.api.signUpEmail({
      body: { email: EMAIL_REEL, password: MOT_DE_PASSE, name: "Compte réel" },
    });
    utilisateurId = compte.user.id;
  }, 60000);

  it("les constantes portent exactement les deux valeurs de la décision", () => {
    expect(SEUIL_ECHECS_CONNEXION).toBe(5);
    expect(FENETRE_ECHECS_CONNEXION_SECONDES).toBe(900);
  });

  it("cinq échecs verrouillent, même avec le BON mot de passe ensuite", async () => {
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await reinitialiserEchecs(identifiant, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION; essai += 1) {
      const resultat = await connecter(EMAIL_REEL, MAUVAIS_MOT_DE_PASSE);
      expect(resultat.issue, `essai ${essai + 1}`).toBe("refus");
    }

    // Le sixième essai est verrouillé — et le BON mot de passe ne change rien :
    // le mot de passe n'est même pas vérifié pendant le verrouillage.
    const avecBonMotDePasse = await connecter(EMAIL_REEL, MOT_DE_PASSE);
    expect(avecBonMotDePasse.issue).toBe("refus");
  });

  it("un compte INCONNU se verrouille exactement de la même façon (D35)", async () => {
    const identifiant = identifiantConnexion(EMAIL_INCONNU);
    await reinitialiserEchecs(identifiant, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION; essai += 1) {
      const resultat = await connecter(EMAIL_INCONNU, MAUVAIS_MOT_DE_PASSE);
      expect(resultat.issue, `essai ${essai + 1}`).toBe("refus");
    }

    expect(
      await verrouille({ identifiant, adresseIp: null }, clientApp()),
    ).toBe(true);

    // Aucune ligne de journal pour ce courriel : il ne correspond à aucun
    // compte, et journal_acces.utilisateur_id est NOT NULL (D258, point 6).
    const refus = await connecter(EMAIL_INCONNU, MAUVAIS_MOT_DE_PASSE);
    expect(refus.issue).toBe("refus");
  });

  it("la fenêtre glisse : passé 15 minutes, l'horloge injectée relève le verrou", async () => {
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await reinitialiserEchecs(identifiant, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION; essai += 1) {
      await enregistrerEchec({ identifiant, adresseIp: null }, clientApp());
    }

    const maintenant = new Date();
    expect(
      await verrouille(
        { identifiant, adresseIp: null },
        clientApp(),
        () => maintenant,
      ),
    ).toBe(true);

    // Horloge injectée, AUCUNE attente réelle : une seconde après l'expiration
    // exacte de la fenêtre de quinze minutes.
    const apresLaFenetre = new Date(
      maintenant.getTime() + FENETRE_ECHECS_CONNEXION_SECONDES * 1000 + 1000,
    );
    expect(
      await verrouille(
        { identifiant, adresseIp: null },
        clientApp(),
        () => apresLaFenetre,
      ),
    ).toBe(false);
  });

  it("une connexion réussie remet le compteur à zéro", async () => {
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await reinitialiserEchecs(identifiant, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION - 1; essai += 1) {
      const resultat = await connecter(EMAIL_REEL, MAUVAIS_MOT_DE_PASSE);
      expect(resultat.issue).toBe("refus");
    }

    const succes = await connecter(EMAIL_REEL, MOT_DE_PASSE);
    expect(succes.issue).toBe("session");

    expect(
      await verrouille({ identifiant, adresseIp: null }, clientApp()),
    ).toBe(false);
  });

  it("le verrou par ADRESSE joue même sur des comptes différents", async () => {
    const adresseIp = "203.0.113.42";
    const identifiantA = identifiantConnexion("limiteur-adresse-a@iso.test");
    const identifiantB = identifiantConnexion("limiteur-adresse-b@iso.test");
    await reinitialiserEchecs(identifiantA, clientApp());
    await reinitialiserEchecs(identifiantB, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION; essai += 1) {
      await enregistrerEchec(
        { identifiant: identifiantA, adresseIp },
        clientApp(),
      );
    }

    // L'adresse est verrouillée pour un AUTRE compte, qui n'a lui-même aucun
    // échec — c'est le second volet de la décision (« si c'est simple »).
    expect(
      await verrouille({ identifiant: identifiantB, adresseIp }, clientApp()),
    ).toBe(true);

    // Sans l'adresse, ce même compte n'est pas verrouillé : les deux clés sont
    // indépendantes.
    expect(
      await verrouille(
        { identifiant: identifiantB, adresseIp: null },
        clientApp(),
      ),
    ).toBe(false);
  });

  it("le verrouillage est journalisé — « connexion_temporisee » — pour un compte réel", async () => {
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await reinitialiserEchecs(identifiant, clientApp());

    for (let essai = 0; essai < SEUIL_ECHECS_CONNEXION; essai += 1) {
      await connecter(EMAIL_REEL, MAUVAIS_MOT_DE_PASSE);
    }
    // Le sixième essai est le premier à être réellement VERROUILLÉ.
    await connecter(EMAIL_REEL, MAUVAIS_MOT_DE_PASSE);

    const journal = await observerSousProprietaire(
      "relire le journal des accès, dont la lecture est bornée à la " +
        "désignation depuis L1-02d : le harnais observe le contenu de la " +
        "trace, il n'en tire aucune conclusion de cloisonnement",
    ).journalAcces.findMany({
      where: {
        utilisateur_id: utilisateurId,
        evenement: "connexion_temporisee",
      },
    });

    expect(journal.length).toBeGreaterThan(0);
  });

  it("JUMEAU — sans politique, une lecture non désignée ne dénombre RIEN ; avec, elle dénombre TOUT", async () => {
    // La garantie réelle de cette table n'est pas qu'un courriel soit secret
    // — il ne l'est pas — c'est qu'AUCUNE requête qui ne désigne rien ne lise
    // la table ENTIÈRE : un accès qui ne tiendrait que les identifiants de
    // `codiplan_app` ne peut pas dénombrer tous les comptes récemment en
    // échec. Le jumeau du §9 : un test de refus prouve que le verrou mordait
    // le jour où on l'a écrit ; celui-ci RETIRE le verrou — la politique
    // `tentative_connexion_lecture` elle-même — et montre que le dénombrement
    // intégral passe alors. Transaction annulée (DDL transactionnel + `SET
    // LOCAL ROLE`) : rien ne survit au-delà du test.
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await enregistrerEchec({ identifiant, adresseIp: null }, clientApp());

    // SOUS LA VRAIE POLITIQUE : aucune désignation posée, donc zéro ligne —
    // même si la table en contient. C'est la garantie que le jumeau retire.
    const sansDesignation = await clientApp().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "tentative_connexion"`,
    );
    expect(Number(sansDesignation[0]?.n)).toBe(0);

    const sousLeJumeau = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_lecture" ON "tentative_connexion"
             FOR SELECT USING (true)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        const lignes = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "tentative_connexion"`,
        );
        throw new Annulation(String(lignes[0]?.n ?? 0));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // Le dénombrement intégral a bien eu lieu sous le jumeau permissif — sans
    // quoi ce test serait creux.
    expect(sousLeJumeau).toBeGreaterThan(0);

    // La transaction annulée n'a rien laissé derrière elle.
    const [politique] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'tentative_connexion' AND policyname = 'jumeau_lecture'`,
    );
    expect(Number(politique?.n)).toBe(0);
  });

  it("aucune politique d'UPDATE : la table ne se corrige jamais (D258)", async () => {
    const identifiant = identifiantConnexion(EMAIL_REEL);
    await enregistrerEchec({ identifiant, adresseIp: null }, clientApp());

    await expect(
      avecDesignationAuth(clientApp()).tentativeConnexion.updateMany({
        where: { identifiant },
        data: { identifiant: "rien-ne-doit-changer@iso.test" },
      }),
    ).rejects.toThrow();
  });
});
