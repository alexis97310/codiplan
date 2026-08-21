import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  estJourOuvre,
  estOuvert,
  joursOuvres,
  lireCleJour,
  minutesOuvrees,
  semaineIso,
  versInstant,
  versLocal,
} from "@/lib/calendar";

import { calendrierDeDemonstration } from "./calendriers-de-demonstration";

/**
 * L'affichage suit le fuseau de l'AGENCE, jamais celui de l'appareil
 * (ticket L0-08, point 2 — « point critique pour l'application technicien »).
 *
 * **Le défaut que ce scénario interdit.** Un technicien part en formation à
 * Sydney, ou son téléphone bascule seul en changeant de réseau. Si le planning
 * se lit avec le fuseau de l'appareil, tous ses créneaux se décalent : une
 * intervention posée à 8 h à Ducos s'affiche à 9 h, et il arrive avec une heure
 * de retard sur un site minier à deux heures de route. Rien dans l'application
 * ne le signale — c'est un défaut silencieux, et c'est pourquoi il se prouve.
 *
 * **Comment il se prouve.** `process.env.TZ` déplace réellement le fuseau du
 * processus Node, comme un téléphone qui change de zone. Le scénario mesure
 * d'abord que le déplacement a bien eu lieu — sans quoi il ne prouverait rien —
 * puis vérifie que pas une seule réponse du module n'a bougé.
 *
 * Le module n'appelle jamais `getHours()`, `getDay()` ni aucun accesseur local
 * de `Date` : c'est ce qui rend le résultat indépendant de l'appareil, et le
 * gardien `sans-date-courante-implicite.test.ts` l'impose au reste du dépôt.
 */

const DUCOS = calendrierDeDemonstration("CODIMA-NC", "DUCOS");

/** Fuseaux d'appareil éprouvés : de l'autre côté du globe, et à contretemps. */
const APPAREILS = ["America/New_York", "Asia/Tokyo", "UTC"];

const VENDREDI_21 = "2026-08-21";
const SAMEDI_22 = "2026-08-22";
const LUNDI_17 = "2026-08-17";
const DIMANCHE_23 = "2026-08-23";

/** Instant du vendredi 21 août 2026, 8 h à Ducos. */
const VENDREDI_HUIT_HEURES = versInstant(
  { ...lireCleJour(VENDREDI_21), heures: 8, minutes: 0, secondes: 0 },
  DUCOS.fuseau,
);

/** Toutes les réponses du module qui doivent rester identiques. */
function releve(): Record<string, unknown> {
  return {
    local: versLocal(VENDREDI_HUIT_HEURES, DUCOS.fuseau),
    ouvert: estOuvert(DUCOS, VENDREDI_HUIT_HEURES),
    samediOuvre: estJourOuvre(DUCOS, lireCleJour(SAMEDI_22)),
    dimancheOuvre: estJourOuvre(DUCOS, lireCleJour(DIMANCHE_23)),
    joursOuvresDeLaSemaine: joursOuvres(
      DUCOS,
      lireCleJour(LUNDI_17),
      lireCleJour(DIMANCHE_23),
    ),
    minutesDeLaJournee: minutesOuvrees(
      DUCOS,
      versInstant(
        { ...lireCleJour(VENDREDI_21), heures: 0, minutes: 0, secondes: 0 },
        DUCOS.fuseau,
      ),
      versInstant(
        { ...lireCleJour(SAMEDI_22), heures: 0, minutes: 0, secondes: 0 },
        DUCOS.fuseau,
      ),
    ),
    semaine: semaineIso(lireCleJour(VENDREDI_21)),
  };
}

const FUSEAU_INITIAL = process.env.TZ;

describe("un technicien en déplacement voit le planning de son agence", () => {
  let reference: Record<string, unknown>;

  beforeAll(() => {
    process.env.TZ = "Pacific/Noumea";
    reference = releve();
  });

  afterAll(() => {
    if (FUSEAU_INITIAL === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = FUSEAU_INITIAL;
    }
  });

  it("le relevé de référence est bien celui de Ducos", () => {
    expect(reference).toMatchObject({
      ouvert: true,
      samediOuvre: true,
      dimancheOuvre: false,
      joursOuvresDeLaSemaine: 6,
      minutesDeLaJournee: 8 * 60,
    });
    expect(reference.local).toMatchObject({ heures: 8, minutes: 0 });
  });

  for (const appareil of APPAREILS) {
    describe(`appareil réglé sur ${appareil}`, () => {
      it("le fuseau de l'appareil a RÉELLEMENT changé — sinon le scénario ne prouve rien", () => {
        process.env.TZ = "Pacific/Noumea";
        const aNoumea = new Date(VENDREDI_HUIT_HEURES.getTime()).getHours();
        process.env.TZ = appareil;
        const ailleurs = new Date(VENDREDI_HUIT_HEURES.getTime()).getHours();

        expect(
          ailleurs,
          `${appareil} lit la même heure que Nouméa : le déplacement n'a pas eu lieu`,
        ).not.toBe(aNoumea);
      });

      it("aucune réponse du module ne bouge", () => {
        process.env.TZ = appareil;
        expect(releve()).toEqual(reference);
      });
    });
  }
});
