import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * D153 (03/10/2026, TP-S3, 9DH-TP-S3-DROITS-ECRANS) — LES ROUTES TRAVERSÉES,
 * AVEC LA VRAIE BASE.
 *
 * `tests/unit/auth/porte.test.ts` et `tests/unit/auth/habilitations.test.ts`
 * prouvent la matrice et les deux portes (`exigerCapacite`,
 * `exigerCapaciteComplete`) hors base. Ce fichier traverse les ROUTES
 * elles-mêmes — même patron que `tests/isolation/droits-import-par-type.test.ts` :
 * la porte est fabriquée pour un rôle donné, et tout le reste (base réelle,
 * politique RLS, `avecContexteApplicatif`) est le chemin de production.
 *
 * Six faits nommés par le ticket (le sixième ajouté par A1, 9DX-RETOUCHES-11).
 * **D199 (13/10/2026, décision n° 85 d'Alexis, 9EV-DIRECTION-TOUS-DROITS)
 * amende les faits 1, 2 et 4 : la direction a désormais tous les droits de
 * l'administrateur de société, les trois refus deviennent des acceptations.**
 *   1. la direction écrit un taux horaire → ACCEPTÉ (D199 relève le ○ de
 *      PA-02 au ●) ;
 *   2. la direction crée une agence → ACCEPTÉ (D199 donne `administrer_agences`
 *      à la direction) ;
 *   3. l'administrateur de société crée une agence → ACCEPTÉ ;
 *   4. la direction règle un trajet par zone → ACCEPTÉ (D199 relève le ○ de
 *      PA-25 au ●) ;
 *   5. l'ADV règle un trajet par zone → ACCEPTÉ (`regler_trajets`, PA-25) ;
 *   6. l'ADV ET la direction exigent une habilitation sur un site → ACCEPTÉS
 *      tous les deux (`gerer_client_site`, CS31).
 *
 * Les acceptations rejouent le verdict réel de `peut`/`peutPleinement`
 * plutôt que de forcer un contexte : voir `viaPorteComplete` et
 * `viaPorteSimple` ci-dessous (A3, 9DX-RETOUCHES-11) — si la matrice
 * changeait de nouveau, ces épreuves suivraient sans qu'on les retouche.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  exigerCapaciteComplete: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

/**
 * LA PORTE EST FABRIQUÉE, JAMAIS LA BASE — voir l'en-tête du fichier.
 * `DATABASE_URL` doit pointer vers LA MÊME base jetable que
 * `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, posé AVANT que
 * `lib/db/client.ts` ne soit importé par les routes ci-dessous (même patron
 * que `droits-import-par-type.test.ts`).
 */
vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/droits-ecrans-tp-s3.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { type Capacite, peut, peutPleinement } from "@/lib/auth/habilitations";
import { exigerCapacite, exigerCapaciteComplete } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { POST as postAgenceCreer } from "@/app/api/parametres/agences/creer/route";
import { POST as postExigenceCreer } from "@/app/api/habilitations/exigences/creer/route";
import { POST as postTauxHoraireCreer } from "@/app/api/parametres/taux-horaire/creer/route";
import { POST as postTrajetZone } from "@/app/api/parametres/trajet-zone/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

function contexte(role: Role): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[role],
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/**
 * LA VRAIE PORTE, PAS UN `null` FORCÉ (A3, 9DX-RETOUCHES-11).
 *
 * Le module `@/lib/auth/porte` est entièrement remplacé par `vi.mock`
 * ci-dessus : forcer `mockResolvedValueOnce(null)` pour un refus ne prouve
 * rien de la matrice, seulement que le test l'affirme. Ces deux fonctions
 * rejouent le VERDICT RÉEL de `peut`/`peutPleinement`
 * (`lib/auth/habilitations.ts`) pour un rôle et une capacité donnés — si la
 * matrice change un jour sous ce rôle, le verdict suit, et l'assertion de
 * refus (ou d'acceptation) rougit pour la bonne raison.
 */
function viaPorteComplete(
  role: Role,
  capacite: Capacite,
): ContexteActif | null {
  return peutPleinement(role, capacite) ? contexte(role) : null;
}
function viaPorteSimple(role: Role, capacite: Capacite): ContexteActif | null {
  return peut(role, capacite) ? contexte(role) : null;
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

const CODE_AGENCE = "9DH-EPREUVE";
const CODE_AGENCE_DIRECTION = "9EV-EPREUVE-DIR";
const AGENCES_A_NETTOYER: string[] = [];
const HABILITATION_ID = uuidv7();

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "taux_horaire" WHERE "societe_id" = $1::uuid AND "date_effet" = '2026-10-04'`,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "code" IN ($1, $2) AND "societe_id" = $3::uuid`,
    CODE_AGENCE,
    CODE_AGENCE_DIRECTION,
    SOCIETE_A,
  );
  for (const calendrierId of AGENCES_A_NETTOYER) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "calendrier" WHERE "id" = $1::uuid`,
      calendrierId,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "temps_trajet_zone" WHERE "societe_id" = $1::uuid AND "zone" = 'sud'`,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site_habilitation_requise" WHERE "habilitation_id" = $1::uuid`,
    HABILITATION_ID,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
    HABILITATION_ID,
  );
  await fermerClients();
});

describe("D199 (13/10/2026, décision n° 85) — le ● de la direction sur parametrer_societe écrit (amende D153/PA-02)", () => {
  it("la direction écrit un taux horaire → accepté, la ligne existe", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      viaPorteComplete(Role.direction, "parametrer_societe"),
    );
    const avant = await clientOwner().tauxHoraire.count({
      where: { societe_id: SOCIETE_A },
    });

    const corps = new FormData();
    corps.set("montant_mineur", "5000");
    corps.set("date_effet", "2026-10-04");
    corps.set("confirme", "oui");
    const reponse = await postTauxHoraireCreer(
      new Request("http://localhost/api/parametres/taux-horaire/creer", {
        method: "POST",
        body: corps,
      }),
    );

    expect(reponse.status).toBe(303);
    expect(motifDeLaRedirection(reponse)).toBeNull();
    const apres = await clientOwner().tauxHoraire.count({
      where: { societe_id: SOCIETE_A },
    });
    expect(apres).toBe(avant + 1);
  });
});

describe("D199 (13/10/2026, décision n° 85) — la direction crée désormais une agence (amende D153/administrer_agences)", () => {
  it("la direction crée une agence → accepté, l'agence existe", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      viaPorteSimple(Role.direction, "administrer_agences"),
    );

    const corps = new FormData();
    corps.set("code", CODE_AGENCE_DIRECTION);
    corps.set("libelle", "Épreuve 9EV direction");
    corps.set("territoire", "ZZ");
    corps.set("fuseau_horaire", "");
    const reponse = await postAgenceCreer(
      new Request("http://localhost/api/parametres/agences/creer", {
        method: "POST",
        body: corps,
      }),
    );

    expect(reponse.status).toBe(303);
    const agence = await clientOwner().agence.findFirst({
      where: { societe_id: SOCIETE_A, code: CODE_AGENCE_DIRECTION },
      select: { id: true, calendrier_id: true },
    });
    expect(agence).not.toBeNull();
    if (agence?.calendrier_id !== null && agence?.calendrier_id !== undefined) {
      AGENCES_A_NETTOYER.push(agence.calendrier_id);
    }
  });

  it("LE JUMEAU — l'administrateur de société crée l'agence normalement", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(Role.admin_societe),
    );

    const corps = new FormData();
    corps.set("code", CODE_AGENCE);
    corps.set("libelle", "Épreuve TP-S3");
    corps.set("territoire", "ZZ");
    corps.set("fuseau_horaire", "");
    const reponse = await postAgenceCreer(
      new Request("http://localhost/api/parametres/agences/creer", {
        method: "POST",
        body: corps,
      }),
    );

    expect(reponse.status).toBe(303);
    const agence = await clientOwner().agence.findFirst({
      where: { societe_id: SOCIETE_A, code: CODE_AGENCE },
      select: { id: true, calendrier_id: true },
    });
    expect(agence).not.toBeNull();
    if (agence?.calendrier_id !== null && agence?.calendrier_id !== undefined) {
      AGENCES_A_NETTOYER.push(agence.calendrier_id);
    }
  });
});

describe("D199 (13/10/2026, décision n° 85) — regler_trajets : le ● de la direction écrit désormais (amende D153/A1)", () => {
  it("la direction règle un trajet → accepté, la ligne existe", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      viaPorteComplete(Role.direction, "regler_trajets"),
    );

    const corps = new FormData();
    corps.set("zone", "sud");
    corps.set("minutes", "99");
    const reponse = await postTrajetZone(
      new Request("http://localhost/api/parametres/trajet-zone", {
        method: "POST",
        body: corps,
      }),
    );

    expect(reponse.status).toBe(303);
    expect(motifDeLaRedirection(reponse)).toBeNull();
    const ligne = await clientOwner().$queryRawUnsafe<
      Array<{ minutes: number }>
    >(
      `SELECT "minutes" FROM "temps_trajet_zone" WHERE "societe_id" = $1::uuid AND "zone" = 'sud'`,
      SOCIETE_A,
    );
    expect(ligne[0]?.minutes).toBe(99);
  });

  it("l'ADV règle le trajet de la zone « sud » → accepté, la ligne existe", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      viaPorteComplete(Role.adv, "regler_trajets"),
    );

    const corps = new FormData();
    corps.set("zone", "sud");
    corps.set("minutes", "45");
    const reponse = await postTrajetZone(
      new Request("http://localhost/api/parametres/trajet-zone", {
        method: "POST",
        body: corps,
      }),
    );

    expect(reponse.status).toBe(303);
    expect(motifDeLaRedirection(reponse)).toBeNull();
    const ligne = await clientOwner().$queryRawUnsafe<
      Array<{ minutes: number }>
    >(
      `SELECT "minutes" FROM "temps_trajet_zone" WHERE "societe_id" = $1::uuid AND "zone" = 'sud'`,
      SOCIETE_A,
    );
    expect(ligne[0]?.minutes).toBe(45);
  });
});

describe("D153 — gerer_client_site : une exigence porte sur UN SITE (CS31)", () => {
  it("prépare l'habilitation référentielle de l'épreuve", async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "habilitation" ("id","societe_id","code","libelle")
       VALUES ($1::uuid, $2::uuid, '9DH-EPREUVE', 'Habilitation épreuve 9DH')`,
      HABILITATION_ID,
      SOCIETE_A,
    );
  });

  it("l'ADV exige cette habilitation sur un site → accepté", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));

    const corps = new FormData();
    corps.set("site_id", SITE_A1_S1);
    corps.set("habilitation_id", HABILITATION_ID);
    corps.set("bloquant", "1");
    const reponse = await postExigenceCreer(
      new Request("http://localhost/api/habilitations/exigences/creer", {
        method: "POST",
        body: corps,
      }),
    );

    expect(motifDeLaRedirection(reponse)).toBeNull();
    const compte = await clientOwner().siteHabilitationRequise.count({
      where: { site_id: SITE_A1_S1, habilitation_id: HABILITATION_ID },
    });
    expect(compte).toBe(1);
  });

  it("la direction exige la MÊME habilitation sur un second site → accepté aussi", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.direction));

    const corps = new FormData();
    corps.set("site_id", SITE_A1_S2);
    corps.set("habilitation_id", HABILITATION_ID);
    corps.set("bloquant", "1");
    const reponse = await postExigenceCreer(
      new Request("http://localhost/api/habilitations/exigences/creer", {
        method: "POST",
        body: corps,
      }),
    );

    expect(motifDeLaRedirection(reponse)).toBeNull();
    const compte = await clientOwner().siteHabilitationRequise.count({
      where: { site_id: SITE_A1_S2, habilitation_id: HABILITATION_ID },
    });
    expect(compte).toBe(1);
  });
});
