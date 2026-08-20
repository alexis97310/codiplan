import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { basculerSociete } from "@/lib/auth/societe-active";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * Better Auth, branché sur les tables du schéma (ticket L0-06, point 2).
 *
 * Ces scénarios existent pour une raison précise : la configuration de
 * `lib/auth/config.ts` est une **table de correspondance** entre le vocabulaire
 * de Better Auth et celui du schéma. Une correspondance ne se relit pas, elle
 * s'exécute — un champ oublié ne se voit qu'à la première inscription. Le
 * parcours complet est donc joué ici contre la vraie base, sous le rôle
 * applicatif réel.
 */
const auth = creerAuth(clientApp());

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

async function inscrire(email: string, nom: string): Promise<string> {
  const resultat = await auth.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: nom },
  });
  return resultat.user.id;
}

describe("inscription", () => {
  afterAll(fermerClients);

  it("crée un `utilisateur`, et non une table `user` parallèle", async () => {
    const email = "inscription@iso.test";
    const id = await inscrire(email, "Nouvel arrivant");

    const utilisateur = await clientApp().utilisateur.findUniqueOrThrow({
      where: { email },
    });

    expect(utilisateur.id).toBe(id);
    expect(utilisateur.nom).toBe("Nouvel arrivant");
    expect(utilisateur.email_verifie).toBe(false);
    expect(utilisateur.mfa_actif).toBe(false);
    expect(utilisateur.actif).toBe(true);
    expect(utilisateur.cree_le).toBeInstanceOf(Date);
  });

  it("attribue un UUID v7 comme clé technique (I10)", async () => {
    const id = await inscrire("uuid@iso.test", "Compte UUID");

    // Version 7 : le premier caractère du troisième groupe.
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("range le mot de passe dans `compte`, jamais sur `utilisateur`", async () => {
    const id = await inscrire("motdepasse@iso.test", "Compte mot de passe");

    const comptes = await clientApp().compte.findMany({
      where: { utilisateur_id: id },
    });

    expect(comptes).toHaveLength(1);
    expect(comptes[0]?.fournisseur_id).toBe("credential");
    expect(comptes[0]?.mot_de_passe).toBeTruthy();
    // Un hash, pas le mot de passe.
    expect(comptes[0]?.mot_de_passe).not.toContain(MOT_DE_PASSE);
  });
});

describe("connexion et session serveur", () => {
  afterAll(fermerClients);

  it("ouvre une session en base, sans société active", async () => {
    const email = "connexion@iso.test";
    const id = await inscrire(email, "Compte connexion");

    // L'inscription ouvre déjà une session : on compte donc l'écart, plutôt
    // que de figer un total qui dépendrait de ce comportement.
    const avant = await clientApp().session.count({
      where: { utilisateur_id: id },
    });

    await auth.api.signInEmail({ body: { email, password: MOT_DE_PASSE } });

    const sessions = await clientApp().session.findMany({
      where: { utilisateur_id: id },
      orderBy: { cree_le: "desc" },
    });

    expect(sessions).toHaveLength(avant + 1);
    const session = sessions[0]!;
    expect(session.token).toBeTruthy();
    expect(session.expire_le.getTime()).toBeGreaterThan(Date.now());
    // Une session fraîche ne porte aucune société : elle ne lit donc rien.
    expect(session.societe_id_active).toBeNull();
    expect(session.role_actif).toBeNull();
    expect(session.second_facteur_valide).toBe(false);
  });

  it("refuse un mot de passe faux", async () => {
    const email = "mauvais-mot-de-passe@iso.test";
    await inscrire(email, "Compte refus");

    await expect(
      auth.api.signInEmail({ body: { email, password: "pas-le-bon-mot" } }),
    ).rejects.toThrow();
  });

  it("la session ouverte alimente ensuite `app.societe_id` par la bascule", async () => {
    const email = "bascule-auth@iso.test";
    const id = await inscrire(email, "Compte bascule");
    // L'habilitation est posée par le harnais, sous le rôle propriétaire :
    // administrer les habilitations n'est pas le sujet de ce scénario, et le
    // rôle applicatif ne peut de toute façon pas écrire hors contexte.
    await clientOwner().utilisateurSociete.create({
      data: {
        id: "aaaaaaaa-0000-7000-8000-000000000731",
        utilisateur_id: id,
        societe_id: SOCIETE_A,
        role: Role.adv,
      },
    });

    await auth.api.signInEmail({ body: { email, password: MOT_DE_PASSE } });
    const session = await clientApp().session.findFirstOrThrow({
      where: { utilisateur_id: id },
    });

    const resultat = await basculerSociete(
      {
        utilisateurId: id,
        sessionId: session.id,
        societeId: SOCIETE_A,
        societeIdSource: null,
        secondFacteurValide: session.second_facteur_valide,
      },
      clientApp(),
    );

    expect(resultat.accepte).toBe(true);
    const apres = await clientApp().session.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(apres.societe_id_active).toBe(SOCIETE_A);
    expect(apres.role_actif).toBe(Role.adv);
  });
});

describe("second facteur", () => {
  afterAll(fermerClients);

  it("un compte à second facteur actif n'obtient PAS de session sur le seul mot de passe", async () => {
    const email = "second-facteur@iso.test";
    const id = await inscrire(email, "Compte second facteur");

    // `mfa_actif` EST le `twoFactorEnabled` du greffon : l'activer suffit à ce
    // que la connexion s'arrête au premier facteur.
    await clientApp().utilisateur.update({
      where: { id },
      data: { mfa_actif: true },
    });

    // L'inscription a déjà ouvert une session, avant l'activation : on repart
    // d'une ardoise vierge pour que le décompte qui suit ne dise qu'une chose.
    await clientApp().session.deleteMany({ where: { utilisateur_id: id } });

    const resultat = await auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
    });

    expect(resultat).toMatchObject({ twoFactorRedirect: true });
    await expect(
      clientApp().session.findMany({ where: { utilisateur_id: id } }),
    ).resolves.toHaveLength(0);
  });
});
