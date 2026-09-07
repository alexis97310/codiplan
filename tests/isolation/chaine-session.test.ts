import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { tenterConnexion } from "@/lib/auth/connexion";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { basculerSociete } from "@/lib/auth/societe-active";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A } from "./setup/fixtures";

/**
 * LA CHAÎNE DE SESSION A ENFIN UN APPELANT (ticket L1-02d).
 *
 * ## Pourquoi ce fichier existe, et c'est une leçon avant d'être un test
 *
 * L1-02c a cassé **toutes les pages authentifiées** : `obtenirSession` rendait
 * `null` pour tout compte fraîchement connecté. Rien n'a rougi. Pas parce que
 * les gardiens étaient mauvais — parce qu'**il n'y a pas encore de pages**, donc
 * personne n'appelait cette chaîne. *Le dépôt ne peut pas détecter les
 * régressions d'une couche qui n'a pas d'appelant.*
 *
 * Ça ne se répare pas en écrivant des écrans — ce n'est pas le moment du plan.
 * Ça se répare en donnant un appelant à la chaîne, et c'est ce fichier : ouvrir
 * une session, la RELIRE, basculer de société, la RELIRE encore, puis s'en
 * servir pour lire du cloisonné. Sans passer par le moindre écran.
 *
 * ## Ce qu'il éprouve que les autres n'éprouvent pas
 *
 * Les scénarios voisins vérifient chaque maillon : `authentification.test.ts`
 * l'ouverture, `bascule-societe.test.ts` l'habilitation, `identite-cloisonnee`
 * et `categorie-authentification` les politiques. Aucun ne les MET BOUT À BOUT.
 * Le défaut de L1-02c vivait exactement là — dans le maillon que personne ne
 * traversait, entre `signInEmail` et `obtenirSession`.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

/** Ouvre un compte habilité sur A, et rend son courriel. */
async function compteHabilite(role: Role): Promise<string> {
  const email = `chaine-${role}-${Date.now()}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Chaîne ${role}` },
  });
  // L'habilitation s'écrit sous le contexte de la société, comme en production :
  // `utilisateur_societe` porte la forme « société ».
  await avecContexteRls(
    clientApp(),
    { societeId: SOCIETE_A, role: Role.admin_societe },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
        uuidv7(),
        cree.user.id,
        SOCIETE_A,
        role,
      ),
  );
  return email;
}

/** Les en-têtes qu'un navigateur renverrait après une connexion. */
async function connecter(email: string): Promise<Headers> {
  const reponse = await auth.api.signInEmail({
    body: { email, password: MOT_DE_PASSE },
    asResponse: true,
  });
  const cookie = (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
  // TÉMOIN : sans cookie, tout ce qui suit mesurerait l'absence de session au
  // lieu de la session (§9, 07/09 — un vert inattendu est un soupçon sur la
  // mesure).
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

describe("de la connexion au premier octet cloisonné, sans écran", () => {
  it("ouvre, RELIT, bascule, RELIT — et le contexte relu ouvre la société", async () => {
    const email = await compteHabilite(Role.adv);

    // 1. OUVERTURE — par le module de connexion, plancher de durée compris.
    const ouverture = await tenterConnexion(
      { email, motDePasse: MOT_DE_PASSE },
      auth,
      clientApp(),
    );
    expect(ouverture.issue).toBe("session");
    if (ouverture.issue !== "session") {
      return;
    }

    // 2. PREMIÈRE RELECTURE — c'est ELLE qui rendait `null` avant L1-02d.
    const entetes = await connecter(email);
    const avant = await obtenirSession(entetes, auth);
    expect(
      avant,
      "obtenirSession a rendu null pour un compte fraîchement connecté — " +
        "c'est le défaut exact de L1-02c, invisible parce qu'aucune page ne " +
        "s'en sert encore.",
    ).not.toBeNull();
    expect(avant?.contexte.societeId).toBeNull();
    expect(avant?.contexte.role).toBeNull();

    // 3. BASCULE — la session porte désormais une société et un rôle.
    const bascule = await basculerSociete(
      {
        utilisateurId: avant!.contexte.utilisateurId,
        jetonSession: avant!.jetonSession,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: avant!.contexte.secondFacteurValide,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);

    // 4. SECONDE RELECTURE — et c'est le maillon que personne ne traversait :
    // la bascule écrit sur `session`, la relecture la lit, et les deux passent
    // par des politiques différentes.
    const apres = await obtenirSession(entetes, auth);
    expect(apres).not.toBeNull();
    expect(apres?.contexte.societeId).toBe(SOCIETE_A);
    expect(apres?.contexte.role).toBe(Role.adv);

    // 5. LE PREMIER OCTET CLOISONNÉ — le contexte relu ouvre bien la société.
    const agences = await avecContexteRls(
      clientApp(),
      {
        societeId: apres!.contexte.societeId!,
        role: apres!.contexte.role,
        auteurId: apres!.contexte.utilisateurId,
      },
      (tx) => tx.agence.findMany({ select: { id: true } }),
    );
    expect(agences.map((agence) => agence.id)).toContain(AGENCE_A);
  });

  it("et la chaîne se referme : le jeton d'un autre compte n'ouvre pas celle-ci", async () => {
    // La contre-épreuve, sans laquelle le scénario ci-dessus prouverait
    // seulement que « quelque chose se lit ».
    const premier = await compteHabilite(Role.adv);
    const second = await compteHabilite(Role.responsable_sav);

    const entetesPremier = await connecter(premier);
    const entetesSecond = await connecter(second);

    const sessionPremier = await obtenirSession(entetesPremier, auth);
    const sessionSecond = await obtenirSession(entetesSecond, auth);

    expect(sessionPremier?.contexte.utilisateurId).not.toBe(
      sessionSecond?.contexte.utilisateurId,
    );
    expect(sessionPremier?.jetonSession).not.toBe(sessionSecond?.jetonSession);
  });
});
