import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * 9L24-ROUTES-SANS-CAPACITE — CHAQUE ROUTE, APPELÉE SANS SA CAPACITÉ, REFUSE
 * — ET N'ÉCRIT RIEN.
 *
 * Mesuré sur `81894e0` : la garde de rôle de CHAQUE route n'était prouvée que
 * par LECTURE DE TEXTE (`tests/unit/auth/porte.test.ts`, qui lit le source et
 * reconnaît `exigerCapacite(...)` par une expression régulière, jamais ne
 * l'exécute) — 74 routes sur 126 n'étaient atteintes par AUCUN test unitaire
 * ni d'isolation.
 *
 * Ce fichier EXÉCUTE chaque route de `ROUTE_CAPACITE`
 * (`tests/unit/auth/route-capacite.ts`, la SOURCE UNIQUE — mesurée contre le
 * disque par `porte.test.ts`, jamais recopiée ici) sous un contexte qui N'A
 * PAS la capacité qu'elle exige : la porte (`@/lib/auth/porte`) est
 * entièrement remplacée, et rend toujours `null`, quelle que soit la
 * capacité demandée — exactement le cas du ticket, « un rôle sans la
 * capacité ». Pour CHAQUE route : AUCUNE ligne n'est écrite — mesuré par le
 * compte global de `journal_audit`, qui journalise déjà TOUTE écriture sur
 * le périmètre audité (I8, par déclencheur PostgreSQL) : une route qui
 * écrirait malgré le refus y laisserait une trace, quelle que soit la table
 * qu'elle touche — jamais besoin de connaître, route par route, laquelle
 * elle est. La forme de la réponse de refus, elle, DIVERGE légitimement
 * d'une route à l'autre (redirection 303, JSON `403`/`404`, ou JSON `200`
 * `{ ok: false }` pour les routes « API » du terrain) — jamais un code HTTP
 * unique à exiger ici ; seule une panne (`>= 500`, exception non rattrapée)
 * est signalée comme telle.
 *
 * Une route qui existe dans `ROUTE_CAPACITE` mais plus sur le disque fait
 * déjà échouer son `import()` ci-dessous ; une route qui existe sur le disque
 * mais pas dans `ROUTE_CAPACITE` reste hors de la portée de CE fichier —
 * c'est `porte.test.ts` qui tient cette direction-là (« toute route appelle
 * `exigerCapacite`, ou figure dans les exemptions »).
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue(null),
  exigerCapaciteComplete: vi.fn().mockResolvedValue(null),
  // 9L28 — `exigerSessionActive` est la SEULE autre porte de ce module
  // qu'une route puisse appeler : `app/api/documents/[id]/octets/route.ts`
  // l'utilise en second essai (le portail n'a aucune capacité), et elle doit
  // rendre `null` ici pour la même raison que les deux ci-dessus — sans
  // quoi ce second essai relirait `headers()` hors de toute requête Next.
  exigerSessionActive: vi.fn().mockResolvedValue(null),
  motifDuRefus: vi.fn().mockResolvedValue("9L24-SANS-CAPACITE-REFUS"),
}));

/**
 * LA PORTE EST FABRIQUÉE, JAMAIS LA BASE — même patron que
 * `droits-ecrans-tp-s3.test.ts`. `DATABASE_URL` doit pointer vers LA MÊME
 * base jetable que `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, posé
 * AVANT que `lib/db/client.ts` ne soit importé par l'une des 118 routes
 * ci-dessous.
 */
vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9l24-routes-sans-capacite.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { uuidv7 } from "@/lib/db/uuid";

import { ROUTE_CAPACITE } from "../unit/auth/route-capacite";
import { clientOwner, fermerClients } from "./setup/db";

afterAll(fermerClients);

const CHEMINS = Object.keys(ROUTE_CAPACITE);

const METHODES = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Methode = (typeof METHODES)[number];

/** Le verbe HTTP RÉEL du module — jamais supposé `POST` (9 routes sont des `GET`). */
function methodeDuModule(
  module_: Record<string, unknown>,
): Methode | undefined {
  return METHODES.find((m) => typeof module_[m] === "function");
}

/** Chaque segment `[xxx]` du chemin reçoit un UUID factice — jamais réutilisé après le refus. */
function paramsFactices(chemin: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const correspondance of chemin.matchAll(/\[([^\]]+)\]/g)) {
    params[correspondance[1] as string] = uuidv7();
  }
  return params;
}

async function compteJournalAudit(): Promise<number> {
  return clientOwner().journalAudit.count();
}

describe("9L24 — population", () => {
  it("TÉMOIN — la table vient de route-capacite.ts, et n'est pas vide", () => {
    expect(CHEMINS.length).toBeGreaterThan(100);
  });
});

describe("9L24 — chaque route, appelée sans sa capacité, refuse et n'écrit rien", () => {
  it.each(CHEMINS)("%s", async (chemin) => {
    const specifier = `@/${chemin.replace(/\.ts$/, "")}`;
    const module_: Record<string, unknown> = await import(
      /* @vite-ignore */ specifier
    );
    const methode = methodeDuModule(module_);
    if (methode === undefined) {
      throw new Error(
        `${chemin} ne porte aucun des verbes ${METHODES.join(", ")}`,
      );
    }
    const gestionnaire = module_[methode] as (
      requete: Request,
      contexte: { params: Promise<Record<string, string>> },
    ) => Promise<Response>;

    const avant = await compteJournalAudit();

    const requete = new Request("http://localhost/9l24-sans-capacite", {
      method: methode,
      ...(methode === "GET" ? {} : { body: new FormData() }),
    });
    const reponse = await gestionnaire(requete, {
      params: Promise.resolve(paramsFactices(chemin)),
    });

    expect(reponse, `${chemin} n'a rendu aucune Response`).toBeInstanceOf(
      Response,
    );
    expect(
      reponse.status,
      `${chemin} a répondu ${reponse.status} — une panne (exception non rattrapée), pas un refus`,
    ).toBeLessThan(500);

    const apres = await compteJournalAudit();
    expect(
      apres,
      `${chemin} a écrit ${apres - avant} ligne(s) de journal d'audit malgré le refus`,
    ).toBe(avant);
  });
});
