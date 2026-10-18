import { PrismaClient } from "@prisma/client";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration, urlApplicative } from "../e2e/setup/base";
import { reperesDeLaScene } from "../e2e/setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../e2e/setup/scene";

/**
 * LES SIX IDENTITÉS DU BALAYAGE PAR RÔLE (9F5-AUDIT-FONCTIONNEL-PARCOURS,
 * point 2) — cinq déjà ouvertes par `tests/e2e/setup/global.ts`, une
 * sixième (`direction`) ouverte par ce fichier, EXACTEMENT comme
 * `tests/e2e/9ev-direction-tous-droits.spec.ts` l'ouvre : la scène partagée
 * ne porte aucune identité `direction` (D199), et ce lot ne la lui ajoute pas
 * — territoire de ce lot, `tests/audit-fonctionnel/` seulement.
 */
export const EMAIL_DIRECTION_AUDIT = "zz9f5-direction@codima.test";
const NOM_DIRECTION_AUDIT = "9F5 Direction (audit fonctionnel)";

export type RoleBalayage = {
  readonly cle: string;
  readonly email: string;
};

export const ROLES_BALAYAGE: readonly RoleBalayage[] = [
  { cle: "adv", email: COMPTE_EPREUVE },
  { cle: "technicien", email: COMPTE_TECHNICIEN_EPREUVE },
  { cle: "admin_societe", email: COMPTE_ADMIN_SOCIETE_EPREUVE },
  { cle: "responsable_materiel", email: COMPTE_RM_EPREUVE },
  { cle: "responsable_sav", email: COMPTE_RS_EPREUVE },
  { cle: "direction", email: EMAIL_DIRECTION_AUDIT },
];

let utilisateurDirectionId = "";

/** Ouvre l'identité `direction` de l'audit — à appeler une seule fois, avant le balayage. */
export async function ouvrirCompteDirectionAudit(): Promise<void> {
  const reperes = await reperesDeLaScene();
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const auth = creerAuth(applicatif, {
      societeId: reperes.societeId,
      role: Role.admin_societe,
    });
    const cree = await auth.api.signUpEmail({
      body: {
        email: EMAIL_DIRECTION_AUDIT,
        password: MOT_DE_PASSE_EPREUVE,
        name: NOM_DIRECTION_AUDIT,
      },
    });
    utilisateurDirectionId = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId: reperes.societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurDirectionId,
          reperes.societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
}

/** Referme l'identité `direction` de l'audit — à appeler une seule fois, après le balayage. */
export async function fermerCompteDirectionAudit(): Promise<void> {
  if (utilisateurDirectionId === "") {
    return;
  }
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: utilisateurDirectionId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurDirectionId },
    });
    await client.utilisateur.delete({ where: { id: utilisateurDirectionId } });
  } finally {
    await client.$disconnect();
    utilisateurDirectionId = "";
  }
}
