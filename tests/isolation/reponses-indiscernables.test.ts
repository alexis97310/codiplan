import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { tenterConnexion } from "@/lib/auth/connexion";
import { PLANCHER_REPONSE_MS } from "@/lib/auth/reponse-uniforme";
import { Role } from "@/lib/auth/roles";
import { basculerSociete } from "@/lib/auth/societe-active";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n/fr";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * Réponses d'authentification indiscernables (arbitrage D35, ticket L0-06b).
 *
 * **Ce que ce scénario protège.** CODIPLAN est vendu à des entreprises qui se
 * font concurrence. Si « compte inexistant », « mot de passe faux » et « compte
 * sans habilitation » se répondent différemment — par le texte ou par le temps
 * —, la page de connexion, et plus encore celle de mot de passe oublié,
 * deviennent un annuaire : un client apprend lesquels de ses concurrents sont
 * clients de la plateforme, sans jamais entrer. Cette fuite ne demande aucun
 * mot de passe, et elle ne laisse aucune trace anormale.
 *
 * **Les trois cas, et où ils vivent.** L'identité est globale (D35) et
 * l'habilitation est par société : les deux premiers refus tombent donc à la
 * CONNEXION (`tenterConnexion`), le troisième à l'ACTIVATION d'une société
 * (`basculerSociete`). Ils partagent le même message et le même plancher de
 * durée — c'est précisément ce que ce scénario vérifie, sur les deux chemins à
 * la fois.
 *
 * Les mesures sont prises contre la vraie base, sous le rôle applicatif réel :
 * une uniformité obtenue sur des doublures ne dirait rien du temps que coûtent
 * un hachage scrypt et un aller-retour PostgreSQL.
 */
const auth = creerAuth(clientApp());

/**
 * L'instance qui OUVRE un compte (L1-02c). Personne ne crée son propre compte :
 * l'ouverture est un acte administratif, sous une société et par le rôle qui
 * administre — matrice §5.2. Le harnais emprunte donc le MÊME chemin que la
 * production, plutôt que de s'accorder une porte que la production n'a pas.
 */
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";
const EMAIL_HABILITE = "indiscernable-habilite@iso.test";
const EMAIL_ORPHELIN = "indiscernable-orphelin@iso.test";
const EMAIL_INEXISTANT = "indiscernable-inexistant@iso.test";

/** Nombre de mesures par cas. La médiane écarte le hoquet isolé. */
const MESURES = 3;

type Mesure = { motif: string; dureeMs: number };

function mediane(valeurs: readonly number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  return triees[Math.floor(triees.length / 2)]!;
}

async function chronometrer(travail: () => Promise<string>): Promise<Mesure[]> {
  const mesures: Mesure[] = [];
  for (let essai = 0; essai < MESURES; essai += 1) {
    const debut = performance.now();
    const motif = await travail();
    mesures.push({ motif, dureeMs: performance.now() - debut });
  }
  return mesures;
}

/** Cas 1 et 2 — refus à la connexion. Rend le motif rendu à l'appelant. */
async function refusConnexion(
  email: string,
  motDePasse: string,
): Promise<string> {
  const resultat = await tenterConnexion(
    { email, motDePasse },
    auth,
    clientApp(),
  );
  expect(resultat.issue, `${email} ne devrait pas obtenir de session`).toBe(
    "refus",
  );
  return resultat.issue === "refus" ? resultat.motif : "";
}

/** Cas 3 — refus à l'activation d'une société sur laquelle le compte n'est rien. */
async function refusHabilitation(utilisateurId: string): Promise<string> {
  const sessionId = uuidv7();
  await clientApp().session.create({
    data: {
      id: sessionId,
      token: `jeton-${sessionId}`,
      utilisateur_id: utilisateurId,
      expire_le: new Date("2030-01-01T00:00:00Z"),
      modifie_le: new Date("2026-08-20T00:00:00Z"),
    },
  });

  const resultat = await basculerSociete(
    {
      utilisateurId,
      sessionId,
      societeId: SOCIETE_B,
      societeIdSource: null,
      secondFacteurValide: true,
    },
    clientApp(),
  );

  expect(resultat.accepte).toBe(false);
  return resultat.accepte ? "" : resultat.motif;
}

describe("réponses d'authentification indiscernables (D35)", () => {
  afterAll(fermerClients);

  let orphelinId = "";
  let habiliteId = "";

  beforeAll(async () => {
    // Un compte habilité sur A — le témoin positif, sans lequel le scénario
    // prouverait seulement que tout est refusé.
    const habilite = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_HABILITE,
        password: MOT_DE_PASSE,
        name: "Compte habilité",
      },
    });
    habiliteId = habilite.user.id;
    await clientOwner().utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: habiliteId,
        societe_id: SOCIETE_A,
        role: Role.adv,
      },
    });

    // Un compte qui existe, dont le mot de passe est bon, et qui n'est habilité
    // nulle part : c'est lui qui porte le troisième cas de D35.
    const orphelin = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_ORPHELIN,
        password: MOT_DE_PASSE,
        name: "Compte orphelin",
      },
    });
    orphelinId = orphelin.user.id;
  }, 60000);

  it("le témoin positif fonctionne — un compte habilité entre bien", async () => {
    const resultat = await tenterConnexion(
      { email: EMAIL_HABILITE, motDePasse: MOT_DE_PASSE },
      auth,
      clientApp(),
    );

    expect(resultat.issue).toBe("session");
    if (resultat.issue !== "session") {
      return;
    }
    expect(resultat.utilisateurId).toBe(habiliteId);

    const bascule = await basculerSociete(
      {
        utilisateurId: habiliteId,
        sessionId: resultat.sessionId,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: true,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);
  });

  it("les trois cas rendent le MÊME message, et c'est celui du dictionnaire", async () => {
    const inexistant = await refusConnexion(EMAIL_INEXISTANT, MOT_DE_PASSE);
    const motDePasseFaux = await refusConnexion(
      EMAIL_ORPHELIN,
      "ce-mot-de-passe-est-faux",
    );
    const sansHabilitation = await refusHabilitation(orphelinId);

    expect(inexistant).toBe(fr["auth.refus"]);
    expect(motDePasseFaux).toBe(fr["auth.refus"]);
    expect(sansHabilitation).toBe(fr["auth.refus"]);
  });

  it("les trois cas répondent dans le même ordre de grandeur de temps", async () => {
    const cas = {
      "compte inexistant": await chronometrer(() =>
        refusConnexion(EMAIL_INEXISTANT, MOT_DE_PASSE),
      ),
      "mot de passe faux": await chronometrer(() =>
        refusConnexion(EMAIL_ORPHELIN, "ce-mot-de-passe-est-faux"),
      ),
      "sans habilitation": await chronometrer(() =>
        refusHabilitation(orphelinId),
      ),
    };

    const medianes = Object.fromEntries(
      Object.entries(cas).map(([nom, mesures]) => [
        nom,
        mediane(mesures.map((mesure) => mesure.dureeMs)),
      ]),
    );

    // Chaque chemin attend le plancher : c'est lui qui gomme l'écart de
    // traitement. La tolérance couvre l'imprécision de `setTimeout`.
    for (const [nom, valeur] of Object.entries(medianes)) {
      expect(valeur, `${nom} répond sous le plancher`).toBeGreaterThanOrEqual(
        PLANCHER_REPONSE_MS - 30,
      );
    }

    // « Même ordre de grandeur » : un facteur 10 séparerait les cas. On exige
    // nettement mieux — un facteur 2 —, faute de quoi le plancher ne
    // couvrirait pas le chemin le plus lent et devrait être relevé.
    const valeurs = Object.values(medianes);
    const rapport = Math.max(...valeurs) / Math.min(...valeurs);
    expect(
      rapport,
      `médianes observées : ${JSON.stringify(medianes)}`,
    ).toBeLessThan(2);
  }, 60000);

  it("un refus reste journalisé côté serveur, avec son motif réel (D32, D34)", async () => {
    // L'uniformité est tournée vers l'extérieur. À l'intérieur, la trace dit ce
    // qui s'est réellement passé — sans quoi « qui a tenté d'accéder à mes
    // données » resterait sans réponse (D34).
    const journal = await clientApp().journalAcces.findMany({
      where: { utilisateur_id: orphelinId },
      orderBy: { horodatage: "asc" },
    });

    expect(journal.length).toBeGreaterThan(0);
    expect(journal[0]?.evenement).toBe("bascule_refusee");
    expect(journal[0]?.societe_id_cible).toBe(SOCIETE_B);
    expect(journal[0]?.detail).toContain("Aucune habilitation");
  });
});
