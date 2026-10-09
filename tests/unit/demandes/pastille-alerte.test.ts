import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "@prisma/client";

import type { Calendrier } from "@/lib/calendar/calendrier";
import type { LigneDemande } from "@/lib/demandes/depot";

vi.mock("@/lib/calendar/agence", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/calendar/agence")>();
  return { ...reel, chargerCalendrierAgence: vi.fn() };
});

import { chargerCalendrierAgence } from "@/lib/calendar/agence";

import { candidatesAlerte } from "../../../app/(back-office)/demandes/presentation";
import { pastilleATraiterAllumee } from "../../../app/(back-office)/demandes/pastille";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 3 (D188) — LA PASTILLE DES 30
 * MINUTES SUR L'ONGLET « À TRAITER », SOUS UNE BORNE MESURÉE.
 *
 * `chargerCalendrierAgence` est ESPIONNÉ, jamais réécrit : la borne tenue
 * est « au plus un appel par établissement CANDIDAT », et seul un espion sur
 * la fonction RÉELLEMENT appelée par `pastilleATraiterAllumee` le prouve.
 */

const MAINTENANT = new Date("2026-10-09T12:00:00.000Z");

/** Un calendrier OUVERT en continu — suffit à rendre `depasse` déterministe. */
const CALENDRIER_OUVERT: Calendrier = {
  code: "TEST",
  fuseau: "UTC",
  territoire: "NC",
  plages: [1, 2, 3, 4, 5, 6, 7].map((jour_semaine) => ({
    jour_semaine,
    debut_minutes: 0,
    fin_minutes: 1440,
  })),
  jours_particuliers: [],
};

let compteur = 0;
function demande(partiel: Partial<LigneDemande>): LigneDemande {
  compteur += 1;
  return {
    id: `demande-${compteur}`,
    numero: null,
    statut: "nouvelle",
    source: "appel",
    urgence: "p3",
    machine_arretee: false,
    description: "test",
    date_souhaitee: null,
    client_id: "client",
    site_id: "site",
    machine_id: null,
    agence_id: "agence-1",
    contact_id: null,
    depose_le: MAINTENANT,
    compteur_accuse_le: MAINTENANT,
    accuse_le: null,
    motif_cloture: null,
    close_le: null,
    ...partiel,
  };
}

/** `minutes` RÉELLES avant `MAINTENANT`. */
function ilYA(minutes: number): Date {
  return new Date(MAINTENANT.getTime() - minutes * 60 * 1000);
}

const TX = {} as Prisma.TransactionClient;

describe("candidatesAlerte — pure, zéro lecture", () => {
  it("une demande reçue il y a 10 minutes n'est pas candidate", () => {
    const d = demande({ compteur_accuse_le: ilYA(10) });
    expect(candidatesAlerte([d], MAINTENANT)).toEqual([]);
  });

  it("une demande qualifiée n'est pas candidate, même en retard", () => {
    // L'alerte du chapitre 16.1 dit « Demande NON QUALIFIÉE » après 30
    // minutes — c'est `statut`, pas `accuse_le`, qui en sort une demande :
    // une demande ACCUSÉE mais pas encore qualifiée reste `nouvelle`
    // (`accuserReception` n'écrit jamais `statut`, `lib/demandes/depot.ts`)
    // et reste donc candidate — c'est voulu, voir `pastilleATraiterAllumee`.
    const qualifiee = demande({
      statut: "qualifiee",
      compteur_accuse_le: ilYA(45),
    });
    expect(candidatesAlerte([qualifiee], MAINTENANT)).toEqual([]);
  });

  it("une demande `nouvelle` en retard RÉEL de plus de 30 minutes est candidate", () => {
    const d = demande({ compteur_accuse_le: ilYA(45) });
    expect(candidatesAlerte([d], MAINTENANT)).toEqual([d]);
  });
});

describe("pastilleATraiterAllumee — bornée à un appel par établissement candidat", () => {
  it("aucune candidate : aucun appel de calendrier", async () => {
    vi.mocked(chargerCalendrierAgence).mockClear();
    const demandes = [demande({ compteur_accuse_le: ilYA(5) })];
    const allumee = await pastilleATraiterAllumee(
      TX,
      "societe-1",
      demandes,
      MAINTENANT,
    );
    expect(allumee).toBe(false);
    expect(chargerCalendrierAgence).not.toHaveBeenCalled();
  });

  it("deux candidates de la MÊME agence : UNE seule charge de calendrier", async () => {
    vi.mocked(chargerCalendrierAgence)
      .mockClear()
      .mockResolvedValue(CALENDRIER_OUVERT);
    const demandes = [
      demande({ agence_id: "agence-1", compteur_accuse_le: ilYA(40) }),
      demande({ agence_id: "agence-1", compteur_accuse_le: ilYA(50) }),
    ];
    await pastilleATraiterAllumee(TX, "societe-1", demandes, MAINTENANT);
    expect(chargerCalendrierAgence).toHaveBeenCalledTimes(1);
  });

  it("deux établissements candidats distincts : UN appel chacun, jamais plus", async () => {
    vi.mocked(chargerCalendrierAgence)
      .mockClear()
      .mockResolvedValue(CALENDRIER_OUVERT);
    const demandes = [
      demande({ agence_id: "agence-1", compteur_accuse_le: ilYA(40) }),
      demande({ agence_id: "agence-2", compteur_accuse_le: ilYA(40) }),
    ];
    await pastilleATraiterAllumee(TX, "societe-1", demandes, MAINTENANT);
    expect(chargerCalendrierAgence).toHaveBeenCalledTimes(2);
  });

  it("une demande en retard, agence ouverte en continu : la pastille s'allume", async () => {
    vi.mocked(chargerCalendrierAgence)
      .mockClear()
      .mockResolvedValue(CALENDRIER_OUVERT);
    const demandes = [demande({ compteur_accuse_le: ilYA(45) })];
    const allumee = await pastilleATraiterAllumee(
      TX,
      "societe-1",
      demandes,
      MAINTENANT,
    );
    expect(allumee).toBe(true);
  });

  it("établissement sans calendrier (`null`) : jamais de pastille — inconnu n'est pas ouvert (I7)", async () => {
    vi.mocked(chargerCalendrierAgence).mockClear().mockResolvedValue(null);
    const demandes = [demande({ compteur_accuse_le: ilYA(45) })];
    const allumee = await pastilleATraiterAllumee(
      TX,
      "societe-1",
      demandes,
      MAINTENANT,
    );
    expect(allumee).toBe(false);
  });
});
