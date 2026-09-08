import { afterAll, describe, expect, it } from "vitest";

import { etatArrivee, roleReclamantUnEnrolement } from "@/lib/auth/arrivee";
import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  basculerSociete,
  habilitationsDuCompte,
} from "@/lib/auth/societe-active";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * LA DETTE PAYÉE : LE CLOISONNEMENT PROUVÉ À TRAVERS L'APPLICATION (L1-02f).
 *
 * ## Ce qui manquait, et depuis le début
 *
 * *Le cloisonnement est prouvé dans la base, jamais à travers l'application.*
 * Trois cents scénarios éprouvent les politiques sous le rôle applicatif ; pas
 * un ne partait d'une **connexion** pour arriver à ce qu'un écran affiche. Le
 * chemin complet — identifiants, session, habilitation, activation, lecture
 * cloisonnée, rendu — n'avait jamais été parcouru d'un bout à l'autre.
 *
 * Ce fichier le parcourt, et il emprunte **la fonction que la page appelle
 * réellement** : `etatArrivee`. Pas une variante écrite pour le test — c'est
 * tout l'intérêt d'avoir sorti la lecture du composant.
 *
 * ## Ce qu'il prouve, et dans les deux sens
 *
 * Un compte de la société A arrive sur SA société, et **B n'apparaît nulle
 * part** : ni son nom, ni ses agences, ni même la possibilité de l'activer. Et
 * la contre-épreuve, sans laquelle le premier scénario prouverait seulement que
 * « quelque chose s'affiche » : un compte de B arrive sur B.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());

afterAll(fermerClients);

/** Ouvre un compte et l'habilite sur les sociétés demandées. */
async function compte(
  etiquette: string,
  habilitations: readonly { societeId: string; role: Role }[],
): Promise<{ email: string; utilisateurId: string }> {
  const email = `ecran-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  // L'ouverture est un acte administratif, sous la société qui ouvre (L1-02c).
  const administratrice = habilitations[0]?.societeId ?? SOCIETE_A;
  const cree = await creerAuth(clientApp(), {
    societeId: administratrice,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Écran ${etiquette}` },
  });

  for (const habilitation of habilitations) {
    await avecContexteRls(
      clientApp(),
      { societeId: habilitation.societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          habilitation.societeId,
          habilitation.role,
        ),
    );
  }
  return { email, utilisateurId: cree.user.id };
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
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

/**
 * Ce que fait le chemin de connexion quand le compte n'a qu'une habilitation :
 * il l'active, parce qu'il n'y a aucun choix à faire.
 */
async function activerLaSeule(entetes: Headers): Promise<void> {
  const session = await obtenirSession(entetes, auth);
  const habilitations = await habilitationsDuCompte(
    session!.contexte.utilisateurId,
    clientApp(),
  );
  expect(habilitations).toHaveLength(1);
  const bascule = await basculerSociete(
    {
      utilisateurId: session!.contexte.utilisateurId,
      jetonSession: session!.jetonSession,
      societeId: habilitations[0]!.societeId,
      societeIdSource: null,
      secondFacteurValide: false,
    },
    clientApp(),
  );
  expect(bascule.accepte).toBe(true);
}

describe("LA DETTE — un compte de A n'aperçoit rien de B, à travers l'application", () => {
  it("de la connexion à l'écran : A voit A, et B n'est nulle part", async () => {
    const { email } = await compte("societe-a", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);
    const entetes = await connecter(email);

    // TÉMOIN : avant activation, l'écran ne montre aucune société. Sans lui, un
    // scénario où la société serait déjà active ne prouverait pas l'activation.
    const avant = await etatArrivee(entetes, auth, clientApp());
    expect(avant.issue).toBe("sans_societe");

    await activerLaSeule(entetes);

    const apres = await etatArrivee(entetes, auth, clientApp());
    expect(apres.issue).toBe("arrivee");
    if (apres.issue !== "arrivee") {
      return;
    }

    expect(apres.arrivee.email).toBe(email);
    expect(apres.arrivee.role).toBe(Role.adv);
    expect(apres.arrivee.societe).not.toBeNull();

    // ── ET RIEN DE B ────────────────────────────────────────────────────────
    //
    // La preuve porte sur ce que l'ÉCRAN rend, en toutes lettres : le nom de la
    // société de B ne doit apparaître dans aucun champ. C'est une assertion sur
    // le rendu, pas sur une requête — c'est très exactement ce qui manquait.
    const nomDeB = await nomDeLaSociete(SOCIETE_B);
    const rendu = JSON.stringify(apres.arrivee);
    expect(rendu).toContain(await nomDeLaSociete(SOCIETE_A));
    expect(
      rendu.includes(nomDeB),
      `l'écran d'un compte de la société A porte le nom de la société B : ` +
        "le cloisonnement ne tient pas à travers l'application.",
    ).toBe(false);
    expect(rendu.includes(SOCIETE_B)).toBe(false);
  });

  it("la contre-épreuve : un compte de B arrive sur B, et pas sur A", async () => {
    const { email } = await compte("societe-b", [
      { societeId: SOCIETE_B, role: Role.adv },
    ]);
    const entetes = await connecter(email);
    await activerLaSeule(entetes);

    const etat = await etatArrivee(entetes, auth, clientApp());
    expect(etat.issue).toBe("arrivee");
    if (etat.issue !== "arrivee") {
      return;
    }
    expect(etat.arrivee.societe).toBe(await nomDeLaSociete(SOCIETE_B));
    expect(etat.arrivee.societe).not.toBe(await nomDeLaSociete(SOCIETE_A));
  });

  it("un compte de A ne peut pas ACTIVER B, même en la nommant", async () => {
    const { email, utilisateurId } = await compte("tentative", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);

    const bascule = await basculerSociete(
      {
        utilisateurId,
        jetonSession: session!.jetonSession,
        societeId: SOCIETE_B,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(false);

    const etat = await etatArrivee(entetes, auth, clientApp());
    expect(etat.issue).toBe("sans_societe");
  });
});

describe("APPARTENANCE — un compte lit SES habilitations, jamais celles d'autrui (D61)", () => {
  it("il découvre ses sociétés sans qu'aucune ne soit active — le mur abattu", async () => {
    const { utilisateurId } = await compte("multi", [
      { societeId: SOCIETE_A, role: Role.adv },
      { societeId: SOCIETE_B, role: Role.technicien },
    ]);

    const siennes = await habilitationsDuCompte(utilisateurId, clientApp());
    expect(siennes).toHaveLength(2);
    expect(siennes.map((h) => h.societeId).sort()).toEqual(
      [SOCIETE_A, SOCIETE_B].sort(),
    );
  });

  it("et il ne lit PAS celles d'un autre compte", async () => {
    const { utilisateurId: moi } = await compte("moi", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);
    const { utilisateurId: autre } = await compte("autre", [
      { societeId: SOCIETE_A, role: Role.technicien },
      { societeId: SOCIETE_B, role: Role.technicien },
    ]);

    // La politique est ancrée sur `app.utilisateur_id`, que ce chemin pose
    // depuis l'identité de la session. Demander celles d'un autre rend zéro :
    // le paramètre ne choisit pas ce que la politique laisse voir.
    const volees = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: moi },
      (tx) =>
        tx.utilisateurSociete.findMany({
          where: { utilisateur_id: autre },
          select: { societe_id: true },
        }),
    );
    expect(volees).toEqual([]);

    // TÉMOIN DE NON-VACUITÉ : les lignes de l'autre EXISTENT bien. Sans lui,
    // « zéro » ne distinguerait pas « masqué » de « inexistant ».
    expect(await habilitationsDuCompte(autre, clientApp())).toHaveLength(2);
  });

  it("un balayage sans identité posée ne rend rien", async () => {
    const balayage = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null },
      (tx) => tx.utilisateurSociete.findMany({ select: { id: true } }),
    );
    expect(balayage).toEqual([]);
  });
});

describe("ENRÔLEMENT REQUIS — le jugement, et son ordre", () => {
  it("un rôle qui exige le second facteur, sans facteur, réclame l'enrôlement", async () => {
    const { email } = await compte("admin", [
      { societeId: SOCIETE_A, role: Role.admin_societe },
    ]);
    const entetes = await connecter(email);

    const etat = await etatArrivee(entetes, auth, clientApp());
    expect(etat.issue).toBe("enrolement_requis");
    if (etat.issue !== "enrolement_requis") {
      return;
    }
    expect(etat.role).toBe(Role.admin_societe);
  });

  it("un rôle qui ne l'exige pas n'y est jamais renvoyé", async () => {
    const { email } = await compte("sans-facteur", [
      { societeId: SOCIETE_A, role: Role.technicien },
    ]);
    const entetes = await connecter(email);
    const etat = await etatArrivee(entetes, auth, clientApp());
    expect(etat.issue).not.toBe("enrolement_requis");
  });

  it("il suffit qu'UNE habilitation l'exige — le facteur est porté par l'identité", () => {
    expect(
      roleReclamantUnEnrolement(
        [{ role: Role.technicien }, { role: Role.direction }],
        false,
      ),
    ).toBe(Role.direction);
    expect(
      roleReclamantUnEnrolement(
        [{ role: Role.technicien }, { role: Role.direction }],
        true,
      ),
    ).toBeNull();
  });
});

/**
 * L'IMPASSE MULTI-SOCIÉTÉ — un RENDEZ-VOUS, pas une embuscade (ticket L2-11).
 *
 * ## Ce que ce fichier constate, et pourquoi il ne le répare pas
 *
 * D61 l'a écrit noir sur blanc : *cette décision n'ouvre aucun sélecteur de
 * société.* Le premier écran active la société d'un compte qui n'en a qu'une, et
 * se contente de DIRE qu'aucune n'est active quand il y en a plusieurs. Le
 * sélecteur est un écran de back-office, et il viendra avec lui.
 *
 * **Le coût de cette phrase n'était écrit nulle part, et c'est ce qui la rendait
 * dangereuse.** Un compte habilité sur deux sociétés se connecte, arrive, et ne
 * peut RIEN faire : aucun chemin de l'application ne lui donne une société
 * active, et sans société active aucune donnée cloisonnée ne se lit. Ce n'est
 * pas une gêne, c'est une impasse — et elle est aujourd'hui sans conséquence
 * seulement parce qu'aucun compte réel n'est dans ce cas.
 *
 * *Le premier le sera probablement celui de la direction* : une personne
 * habilitée à la fois sur CODIMA-NC et sur CODIMA-EU. Le jour où ce compte est
 * ouvert, l'impasse cesse d'être théorique — et elle se découvrira à l'écran,
 * pas dans un document.
 *
 * **Même traitement que la console éditeur (L1-02c) et que L7-01** : une épreuve
 * qui constate l'impasse et la NOMME. *Le silence a exactement la forme du
 * succès* (§9, 31/08) — une limite qu'aucun scénario ne prononce se découvre en
 * exploitation, et le rendez-vous devient une embuscade.
 *
 * Ce fichier ne construit pas le sélecteur : ce serait un écran de lot 2 écrit
 * en avance, exactement ce que l'étroitesse de L1-02f refusait.
 */
describe("L'IMPASSE MULTI-SOCIÉTÉ — constatée et nommée (L2-11)", () => {
  it("deux habilitations : le compte arrive sans société active, et aucun chemin ne lui en donne une", async () => {
    const { email, utilisateurId } = await compte("impasse", [
      { societeId: SOCIETE_A, role: Role.adv },
      { societeId: SOCIETE_B, role: Role.adv },
    ]);
    const entetes = await connecter(email);

    // TÉMOIN : le compte VOIT bien ses deux habilitations — c'est le mur que
    // D61 a abattu. Sans lui, « aucune société active » se confondrait avec
    // « aucune habilitation », qui est un tout autre cas.
    const siennes = await habilitationsDuCompte(utilisateurId, clientApp());
    expect(siennes).toHaveLength(2);

    // ── CE QUE LE CHEMIN DE CONNEXION FAIT, ET C'EST TOUT CE QU'IL FAIT ────
    //
    // `app/api/session/connexion/route.ts` n'active que sur EXACTEMENT une
    // habilitation. Ici il y en a deux : rien n'est activé, et rien dans
    // l'application ne propose de choisir.
    const etat = await etatArrivee(entetes, auth, clientApp());
    expect(
      etat.issue,
      "un compte habilité sur plusieurs sociétés doit arriver SANS société " +
        "active : l'activation automatique serait un choix fait à sa place.",
    ).toBe("sans_societe");

    // ── ET L'IMPASSE EST TOTALE ───────────────────────────────────────────
    //
    // Sans société active, aucune donnée cloisonnée ne se lit. Ce n'est pas une
    // liste vide qu'un écran afficherait comme « aucun résultat » : c'est
    // l'ensemble du produit qui est hors de portée.
    const session = await obtenirSession(entetes, auth);
    expect(session!.contexte.societeId).toBeNull();
    const agences = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: utilisateurId },
      (tx) => tx.agence.findMany({ select: { id: true } }),
    );
    expect(
      agences,
      "RENDEZ-VOUS L2-11 — le sélecteur de société. Tant qu'il n'existe pas, " +
        "un compte habilité sur plusieurs sociétés ne peut RIEN lire : il n'a " +
        "aucun moyen d'en activer une. Voir docs/backlog.md, section « Tickets " +
        "déjà arrêtés hors du chemin critique ».",
    ).toEqual([]);

    // TÉMOIN DE NON-VACUITÉ : les agences EXISTENT. Sans lui, « zéro » ne
    // distinguerait pas « hors de portée » de « rien à lire » (§9, 30/08).
    const sousA = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.adv, auteurId: utilisateurId },
      (tx) => tx.agence.findMany({ select: { id: true } }),
    );
    expect(sousA.length).toBeGreaterThan(0);
  });

  it("la seule sortie existante est de NOMMER la société — ce qu'aucun écran ne permet", async () => {
    const { email, utilisateurId } = await compte("impasse-sortie", [
      { societeId: SOCIETE_A, role: Role.adv },
      { societeId: SOCIETE_B, role: Role.adv },
    ]);
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);

    // `basculerSociete` fonctionne : le verrou n'est pas là. Ce qui manque est
    // l'ÉCRAN qui laisse désigner la société — un test peut passer
    // l'identifiant en dur, un utilisateur ne le peut pas (D61).
    const bascule = await basculerSociete(
      {
        utilisateurId,
        jetonSession: session!.jetonSession,
        societeId: SOCIETE_B,
        societeIdSource: null,
        secondFacteurValide: false,
      },
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);

    const apres = await etatArrivee(entetes, auth, clientApp());
    expect(apres.issue).toBe("arrivee");
  });
});

/** Le nom d'une société, lu sous son propre contexte — la seule façon. */
async function nomDeLaSociete(societeId: string): Promise<string> {
  const societe = await avecContexteRls(
    clientApp(),
    { societeId, role: null },
    (tx) =>
      tx.societe.findFirst({
        where: { id: societeId },
        select: { raison_sociale: true },
      }),
  );
  return societe!.raison_sociale;
}
