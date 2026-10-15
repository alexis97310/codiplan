import { afterAll, describe, expect, it } from "vitest";

import {
  envoyerLienDAcces,
  envoyerNouveauLienDAcces,
} from "@/lib/auth/acces-technicien";
import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9EXB-EQUIPE-EPREUVES-CAPTURES, point 4 — « NOUVEAU LIEN » (D86) CONTRE UN
 * COMPTE QUI A DÉJÀ CHOISI SON MOT DE PASSE.
 *
 * Point jamais éprouvé par 9EXA : `choisirLePremierMotDePasse` appelle
 * `resetPassword` SANS condition sur l'état antérieur du compte (lecture de
 * `lib/auth/premier-acces.ts`) — plausible que `/premier-acces` accepte un
 * nouveau mot de passe même si un ancien existait déjà, non prouvé avant ce
 * fichier.
 *
 * ## Comment ce fichier retrouve le jeton SANS lire de courriel
 *
 * `envoyerNouveauLienDAcces` ne rend jamais l'URL — elle est émise par une
 * instance Better Auth interne, locale à `lib/auth/lien-d-acces.ts`. Le jeton
 * de réinitialisation de mot de passe est pourtant LISIBLE : Better Auth pose
 * la ligne de `verification` avec `identifiant = "reset-password:<jeton>"` et
 * `valeur = utilisateurId` (mesuré dans
 * `node_modules/better-auth/.../api/routes/password.mjs`). Lire la ligne la
 * plus récente pour CET utilisateur rend donc le jeton réel, sans jamais
 * toucher un canal de courriel — même esprit que la lecture directe de
 * `verification` dans `tests/isolation/categorie-authentification.test.ts`.
 */

afterAll(fermerClients);

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "9EXB-DEJAPOSE-";
const EMAIL = `${PREFIXE.toLowerCase()}technicien@codima.test`;
const ANCIEN_MOT_DE_PASSE = "AncienMotDePasseChoisi1";
const NOUVEAU_MOT_DE_PASSE = "NouveauMotDePasseChoisi1";

/** Lit le jeton de réinitialisation le plus récent émis pour CET utilisateur. */
async function dernierJetonEmis(utilisateurId: string): Promise<string> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    { identifiant: string }[]
  >(
    `SELECT identifiant FROM "verification"
      WHERE valeur = $1 AND identifiant LIKE 'reset-password:%'
      ORDER BY cree_le DESC LIMIT 1`,
    utilisateurId,
  );
  expect(ligne).toBeDefined();
  return (ligne?.identifiant ?? "").slice("reset-password:".length);
}

async function seConnecte(motDePasse: string): Promise<number> {
  const reponse = await dansUnEchangeAuth(() =>
    creerAuth(clientApp()).api.signInEmail({
      body: { email: EMAIL, password: motDePasse },
      asResponse: true,
    }),
  );
  return reponse.status;
}

describe("envoyerNouveauLienDAcces — contre un compte qui a DÉJÀ choisi son mot de passe (point 4)", () => {
  it("le nouveau lien ouvre /premier-acces, qui accepte un NOUVEAU mot de passe ; l'ancien reste valide jusqu'à l'usage du lien", async () => {
    const creation = await creerTechnicien(
      ADMIN_A,
      {
        nom: "Technicien 9EXB déjà posé",
        email: EMAIL,
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    const { utilisateurId } = creation;

    // ── 1. LE PREMIER LIEN, LE PREMIER MOT DE PASSE ────────────────────────
    const premierEnvoi = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(premierEnvoi.accepte).toBe(true);
    const premierJeton = await dernierJetonEmis(utilisateurId);
    const premierChoix = await choisirLePremierMotDePasse(
      {
        jeton: premierJeton,
        motDePasse: ANCIEN_MOT_DE_PASSE,
        confirmation: ANCIEN_MOT_DE_PASSE,
      },
      creerAuth(clientApp()),
    );
    expect(premierChoix.issue).toBe("abouti");
    expect(await seConnecte(ANCIEN_MOT_DE_PASSE)).toBe(200);

    // ── 2. LE CLIQUET DE D65 FERME LE PREMIER ENVOI (témoin) ───────────────
    const refusPremierEnvoi = await envoyerLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(refusPremierEnvoi).toEqual({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });

    // ── 3. LE « NOUVEAU LIEN » (D86), LUI, RÉUSSIT MALGRÉ LE MOT DE PASSE ──
    const nouveauLien = await envoyerNouveauLienDAcces(
      ADMIN_A,
      utilisateurId,
      clientApp(),
      {},
    );
    expect(nouveauLien.accepte).toBe(true);

    // L'ANCIEN MOT DE PASSE FONCTIONNE ENCORE — demander le nouveau lien ne
    // retire rien tant que le lien n'a pas été SUIVI.
    expect(await seConnecte(ANCIEN_MOT_DE_PASSE)).toBe(200);

    // ── 4. LE NOUVEAU JETON, SUR /premier-acces, ACCEPTE UN NOUVEAU MOT DE
    //        PASSE — même si le compte en avait déjà un ────────────────────
    const nouveauJeton = await dernierJetonEmis(utilisateurId);
    const nouveauChoix = await choisirLePremierMotDePasse(
      {
        jeton: nouveauJeton,
        motDePasse: NOUVEAU_MOT_DE_PASSE,
        confirmation: NOUVEAU_MOT_DE_PASSE,
      },
      creerAuth(clientApp()),
    );
    expect(nouveauChoix.issue).toBe("abouti");

    // ── 5. L'USAGE DU LIEN A REMPLACÉ L'ANCIEN MOT DE PASSE ────────────────
    expect(await seConnecte(NOUVEAU_MOT_DE_PASSE)).toBe(200);
    await expect(
      dansUnEchangeAuth(() =>
        creerAuth(clientApp()).api.signInEmail({
          body: { email: EMAIL, password: ANCIEN_MOT_DE_PASSE },
        }),
      ),
    ).rejects.toThrow();

    // ── NETTOYAGE ───────────────────────────────────────────────────────────
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
      utilisateurId,
    );
  });
});
