import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";

import { clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * TABLEAU-1 (23/09/2026) — LA TUILE « VGP À PRÉVOIR » ET LE REGISTRE `/vgp`
 * COMPTENT LE MÊME PARC, MÊME AU-DELÀ DE LA BORNE D'AFFICHAGE.
 *
 * ## LE CONSTAT, MESURÉ EN PRODUCTION LE 23/09/2026
 *
 * `/tableau-de-bord` affichait 81 échéances dépassées, `/vgp` en affichait 78
 * — un écart de trois machines sur un total de 84 à prévoir. `compterAPrevoir`
 * (la tuile) lit tout le parc cloisonné, sans aucun plafond ; `/vgp` composait
 * son résumé (`resumerLeRegistre`) à partir des lignes déjà bornées à 200
 * pour L'AFFICHAGE de sa table — la même faute qu'AT-07 avait fermée pour
 * `/parc`. Une société dont les machines soumises dépassent cette borne voit
 * donc son résumé SOUS-COMPTÉ.
 *
 * ## CE QUE CE FICHIER ÉPROUVE
 *
 * Un parc de 205 machines soumises, toutes en retard — au-delà des 200
 * lignes que `/vgp` affichait, et très en dessous des 2000 de son nouveau
 * plafond de résumé. Rejoué en deux temps : la lecture BORNÉE À
 * L'AFFICHAGE (l'ANCIEN geste de `/vgp`) sous-compte ; la lecture bornée au
 * plafond du RÉSUMÉ (le correctif) retrouve exactement ce que la tuile du
 * tableau de bord compte déjà.
 *
 * ## POURQUOI CE FICHIER PASSE PAR `DATABASE_URL`, PAS PAR `clientApp()`
 *
 * `compterAPrevoir` et `listerLeRegistre` (`lib/vgp/registre.ts`) n'acceptent
 * AUCUN client explicite, à la différence de `dernieresInformations` ou
 * `enregistrerVerification` : elles passent TOUJOURS par le client global de
 * `lib/db/client.ts`, sous le rôle applicatif restreint. Prisma ne s'y
 * connecte qu'à la PREMIÈRE requête (connexion différée) : poser
 * `DATABASE_URL` sur la base jetable, sous ce rôle, AVANT de charger le
 * module — et avant toute autre requête sous le client partagé — est donc la
 * seule façon de les éprouver ici, même geste que `sante-migrations.test.ts`.
 */

const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { compterAPrevoir, listerLeRegistre, resumerLeRegistre } =
  await import("@/lib/vgp/registre");

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const AUJOURD_HUI = instantDuJour(jourDe(maintenant(FUSEAU_SOCIETE_A).local));
const HORIZON_JOURS = 30;

/** L'ANCIENNE borne de `/vgp`, rejouée comme TÉMOIN (mot pour mot, d9c9446). */
const LIGNES_AFFICHEES_AVANT_CORRECTIF = 200;
/** Le plafond du RÉSUMÉ posé par le correctif (`app/(back-office)/vgp/page.tsx`). */
const LIGNES_RESUME_MAXIMALES_APRES_CORRECTIF = 2000;

/** Au-delà de la borne d'affichage, en dessous du plafond du résumé. */
const TOTAL_MACHINES = 205;

let familleId: string | undefined;
let modeleId: string | undefined;
const machineIds: string[] = [];

afterAll(async () => {
  if (machineIds.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "vgp_verification" WHERE "machine_id" = ANY($1::uuid[])`,
      machineIds,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "machine" WHERE "id" = ANY($1::uuid[])`,
      machineIds,
    );
  }
  if (modeleId !== undefined) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "modele_materiel" WHERE "id" = $1::uuid`,
      modeleId,
    );
  }
  if (familleId !== undefined) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      familleId,
    );
  }
  // La CONNEXION DÉJÀ ÉTABLIE du client partagé (`lib/db/client.ts`) ne se
  // reconnecte pas au changement de la variable — restaurée par hygiène pour
  // les scripts qui la lisent directement, pas pour ce module lui-même.
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

/** Une famille SOUMISE, jetable — jamais posée sur une fixture partagée. */
async function familleSoumiseJetable(): Promise<string> {
  const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "famille_materiel"
       (id, societe_id, code, libelle, actif, assujettissement_vgp, vgp_periodicite_mois, vgp_reference_texte)
     VALUES (gen_random_uuid(), $1::uuid,
             'PAG-' || substr(gen_random_uuid()::text, 1, 8),
             'Famille de pagination (TABLEAU-1)', true,
             'soumis', 1, 'texte de test')
     RETURNING "id"`,
    SOCIETE_A,
  );
  if (ligne === undefined) {
    throw new Error("la famille de pagination n'a pas été créée");
  }
  return ligne.id;
}

async function modeleJetable(idFamille: string): Promise<string> {
  const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "modele_materiel" (id, societe_id, famille_id, marque, reference)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'Marque de test', 'REF-PAGINATION')
     RETURNING "id"`,
    SOCIETE_A,
    idFamille,
  );
  if (ligne === undefined) {
    throw new Error("le modèle de pagination n'a pas été créé");
  }
  return ligne.id;
}

/** `TOTAL_MACHINES` machines soumises, chacune vérifiée il y a trois mois — en retard. */
async function semerLeParcEnRetard(idModele: string): Promise<string[]> {
  const dateVerification = new Date(AUJOURD_HUI);
  dateVerification.setUTCMonth(dateVerification.getUTCMonth() - 3);
  const jour = dateVerification.toISOString().slice(0, 10);

  const valeurs = Array.from(
    { length: TOTAL_MACHINES },
    (_, i) =>
      `(gen_random_uuid(), '${SOCIETE_A}'::uuid, '${idModele}'::uuid, '${CLIENT_A1}'::uuid, '${SITE_A1_S1}'::uuid, 'SN-PAGINATION-${i}', 'QR-PAGINATION-TABLEAU-1-${i}', now())`,
  ).join(",\n");
  const machines = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "machine" (id, societe_id, modele_id, client_id, site_id, numero_serie, qr_token, modifie_le)
     VALUES ${valeurs}
     RETURNING "id"`,
  );
  const ids = machines.map((m) => m.id);

  const verifications = ids
    .map(
      (id) =>
        `(gen_random_uuid(), '${SOCIETE_A}'::uuid, '${id}'::uuid, '${jour}'::date, 'APAVE', 'rapport_organisme', now())`,
    )
    .join(",\n");
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "vgp_verification" (id, societe_id, machine_id, date_verification, organisme, origine, modifie_le)
     VALUES ${verifications}`,
  );

  return ids;
}

describe("un parc dont les machines soumises dépassent la borne d'affichage de /vgp (TABLEAU-1)", () => {
  it("amorçage — 205 machines soumises, toutes en retard", async () => {
    familleId = await familleSoumiseJetable();
    modeleId = await modeleJetable(familleId);
    machineIds.push(...(await semerLeParcEnRetard(modeleId)));
    expect(machineIds).toHaveLength(TOTAL_MACHINES);
  });

  it("TÉMOIN — la tuile du tableau de bord (`compterAPrevoir`) compte les 205, sans aucun plafond", async () => {
    const compte = await compterAPrevoir(SESSION, AUJOURD_HUI, HORIZON_JOURS);
    expect(compte.depassees).toBeGreaterThanOrEqual(TOTAL_MACHINES);
  });

  it("AVANT LE CORRECTIF — le résumé du registre, calculé sur la lecture bornée à l'AFFICHAGE (200), sous-compte", async () => {
    const lignesAffichees = await listerLeRegistre(
      SESSION,
      AUJOURD_HUI,
      LIGNES_AFFICHEES_AVANT_CORRECTIF,
    );
    const resume = resumerLeRegistre(lignesAffichees);
    // Le plafond d'affichage (200) est strictement inférieur au parc semé
    // (205) : la lecture bornée ne peut PAS voir tout le parc en retard.
    expect(resume.echeanceDepassee).toBeLessThan(TOTAL_MACHINES);
  });

  it("APRÈS LE CORRECTIF — le résumé calculé sur le plafond du RÉSUMÉ retrouve EXACTEMENT le compte de la tuile", async () => {
    const [toutesLesLignes, compte] = await Promise.all([
      listerLeRegistre(
        SESSION,
        AUJOURD_HUI,
        LIGNES_RESUME_MAXIMALES_APRES_CORRECTIF,
      ),
      compterAPrevoir(SESSION, AUJOURD_HUI, HORIZON_JOURS),
    ]);
    const resume = resumerLeRegistre(toutesLesLignes);
    // LE COMPTE DE LA TUILE = LE COMPTE DU REGISTRE — la même mesure, la
    // même source, plus aucun écart de pagination.
    expect(resume.echeanceDepassee).toBe(compte.depassees);
  });
});
