import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Choix } from "@/app/(back-office)/arrivee/composants";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n/fr";

/**
 * D-04 (LOT AV-11 + D-04, point 2) — LE PLURIEL S'ACCORDE AU NOMBRE RÉEL.
 *
 * ## Ce qui était faux, mesuré sans ambiguïté
 *
 * `arrivee.choix.aide` disait « Vous êtes habilité sur PLUSIEURS sociétés »,
 * et `Choix` (`app/(back-office)/arrivee/page.tsx`) se rend dès que
 * `societes.length > 0` — donc y compris pour une seule. Ce que
 * `tests/isolation/premier-ecran.test.ts` (ligne ~313) constatait déjà en
 * prose, sur la garde du sélecteur, sans que personne n'en tire la
 * conséquence sur CE texte précis.
 *
 * ## Pourquoi ce fichier ne passe pas par une base
 *
 * `Choix` est un composant PUR — aucune lecture, aucune session, aucun
 * contexte cloisonné : seuls `societes` et `active` le gouvernent. Le rendre
 * directement, avec des données forgées, éprouve exactement la même branche
 * que l'écran réel emprunte, sans qu'aucune base ne soit nécessaire pour le
 * constater — la même économie que `tests/unit/app/etats-partages.test.tsx`
 * fait pour `error.tsx` et `not-found.tsx`.
 */

const SOCIETE_A = {
  societeId: "11111111-1111-7111-8111-111111111111",
  role: Role.admin_societe,
  raisonSociale: "CODIMA Nouvelle-Calédonie",
};

const SOCIETE_B = {
  societeId: "22222222-2222-7222-8222-222222222222",
  role: Role.adv,
  raisonSociale: "CODIMA Europe",
};

describe("l'accroche du choix de société s'accorde au nombre réel (D-04)", () => {
  it("une seule société : l'accroche AU SINGULIER, jamais « plusieurs »", () => {
    render(<Choix societes={[SOCIETE_A]} active={null} />);

    expect(screen.getByText(fr["arrivee.choix.aide_une"])).toBeInTheDocument();
    expect(
      screen.queryByText(fr["arrivee.choix.aide"]),
    ).not.toBeInTheDocument();
    // Témoin qu'un texte inventant un pluriel n'apparaît pas non plus.
    expect(screen.queryByText(/plusieurs sociétés/i)).not.toBeInTheDocument();
  });

  it("deux sociétés : l'accroche AU PLURIEL, jamais l'accroche du singulier", () => {
    render(<Choix societes={[SOCIETE_A, SOCIETE_B]} active={null} />);

    expect(screen.getByText(fr["arrivee.choix.aide"])).toBeInTheDocument();
    expect(
      screen.queryByText(fr["arrivee.choix.aide_une"]),
    ).not.toBeInTheDocument();
  });
});
