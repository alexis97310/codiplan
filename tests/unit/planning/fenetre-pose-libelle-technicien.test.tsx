import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FenetrePose } from "@/components/planning/fenetre-pose";
import { t } from "@/lib/i18n/fr";

/**
 * LE LIBELLÉ SOUS « TECHNICIEN », QUAND LA SONDE « ABSENT » SE TROMPE SUR UN
 * JOUR FERMÉ CONFIRMABLE (9F3B point 3, revue de 9F3-POSE-HORS-OUVERTURE-
 * CONFIRMEE).
 *
 * *Le défaut mesuré* : la sonde `absent` (voir l'entête de `fenetre-pose.tsx`)
 * n'a pas d'heure à regarder — elle se trompe sur un jour FERMÉ exactement
 * comme sur une VRAIE absence. Une fois une heure choisie et le verdict
 * confirmable chargé, le libellé affichait quand même « Absent ce jour-là »,
 * à côté de la case « Cochez la confirmation » — trompeur, puisqu'il n'y a
 * aucune absence à constater.
 */

const TECHNICIENS = [{ id: "tech-1", nom: "Jean" }];

/**
 * AUCUN CRÉNEAU, QUELLE QUE SOIT LA DURÉE SONDÉE (la sonde ET le choix de
 * durée reçoivent tous deux `{ creneaux: [] }`) — ce que `verdicts` rend une
 * fois l'heure choisie dépend du scénario.
 */
function fetchAvecVerdicts(verdicts: readonly unknown[]): typeof fetch {
  return vi.fn(async (url: string) => {
    const contientHeure = String(url).includes("heure=");
    return {
      ok: true,
      json: async () => (contientHeure ? { verdicts } : { creneaux: [] }),
    } as Response;
  }) as unknown as typeof fetch;
}

function rendre(verdicts: readonly unknown[]) {
  vi.stubGlobal("fetch", fetchAvecVerdicts(verdicts));
  return render(
    <FenetrePose
      interventionId="int-1"
      libelle="Client Témoin · Panne · Urgent"
      dureeMinInitiale={null}
      technicienIdInitial="tech-1"
      jour="2026-09-14"
      fuseau="Pacific/Noumea"
      techniciens={TECHNICIENS}
      onFermer={vi.fn()}
      onConfirmer={vi.fn()}
    />,
  );
}

async function choisirDureeEtHeure(): Promise<void> {
  fireEvent.click(
    screen.getByRole("button", {
      name: t("planning.pose.duree_60"),
      hidden: true,
    }),
  );
  await waitFor(() =>
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some((appel: unknown[]) =>
        String(appel[0]).includes("duree=60"),
      ),
    ).toBe(true),
  );
  fireEvent.change(
    screen.getByLabelText(t("planning.pose.heure_autre"), {
      selector: "input",
    }),
    { target: { value: "09:00" } },
  );
}

function etatAffiche(container: HTMLElement): string | null {
  return (
    container
      .querySelector('[data-fenetre-pose="int-1"]')
      ?.querySelector("[data-etat-technicien]")
      ?.getAttribute("data-etat-technicien") ?? null
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("le libellé sous « Technicien », une fois l'heure choisie (9F3B point 3)", () => {
  it("JOUR FERMÉ CONFIRMABLE — la sonde dit « absent », mais le verdict est confirmable : le nouveau libellé, jamais « Absent ce jour-là »", async () => {
    const { container } = rendre([
      {
        cle: "intervention.refus.jour_ferme",
        bloquant: false,
        confirmable: true,
      },
    ]);
    await choisirDureeEtHeure();

    await waitFor(() =>
      expect(etatAffiche(container)).toBe("jour_ferme_confirmable"),
    );
    expect(
      screen.getByText(t("planning.pose.jour_ferme_confirmable")),
    ).toBeInTheDocument();
    expect(screen.queryByText(t("planning.pose.technicien_absent"))).toBeNull();
  });

  it("TÉMOIN — une VRAIE absence (refus bloquant, jamais confirmable) garde « Absent ce jour-là »", async () => {
    const { container } = rendre([
      { cle: "intervention.refus.absence", bloquant: true },
    ]);
    await choisirDureeEtHeure();

    await waitFor(() => expect(etatAffiche(container)).toBe("absent"));
    expect(
      screen.getByText(t("planning.pose.technicien_absent")),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(t("planning.pose.jour_ferme_confirmable")),
    ).toBeNull();
  });

  /**
   * D123 D'ALEXIS (19/10/2026, 9F5C) — LE SECOND MOTIF, MÊME DÉFAUT MESURÉ.
   *
   * Avant ce lot, la case cochée pour UN jour déjà passé envoyait toujours
   * `confirmer_hors_ouverture` — jamais `confirmer_date_passee`, le seul
   * champ que le serveur lit pour ce motif (`verdictDatePassee`,
   * `lib/interventions/pose.ts`) : « Planifier » semblait aboutir du côté de
   * l'écran, mais la route refusait encore, en silence pour qui ne lit pas le
   * réseau.
   */
  it("DATE PASSÉE CONFIRMABLE — même défaut, second motif : le libellé et la case dédiés, jamais ceux du jour fermé", async () => {
    const { container } = rendre([
      {
        cle: "intervention.refus.date_passee",
        bloquant: false,
        confirmable: true,
      },
    ]);
    await choisirDureeEtHeure();

    await waitFor(() =>
      expect(etatAffiche(container)).toBe("date_passee_confirmable"),
    );
    expect(
      screen.getByText(t("planning.pose.date_passee_confirmable")),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(t("planning.pose.jour_ferme_confirmable")),
    ).toBeNull();
    expect(
      screen.getByLabelText(t("intervention.confirmer_date_passee")),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(t("intervention.confirmer_hors_ouverture")),
    ).toBeNull();
  });

  it("DATE PASSÉE CONFIRMABLE, COCHÉE : « Planifier » appelle `onConfirmer` avec `confirmerDatePassee: true`, jamais `confirmerHorsOuverture`", async () => {
    const onConfirmer = vi.fn();
    vi.stubGlobal(
      "fetch",
      fetchAvecVerdicts([
        {
          cle: "intervention.refus.date_passee",
          bloquant: false,
          confirmable: true,
        },
      ]),
    );
    render(
      <FenetrePose
        interventionId="int-1"
        libelle="Client Témoin · Panne · Urgent"
        dureeMinInitiale={null}
        technicienIdInitial="tech-1"
        jour="2026-09-14"
        fuseau="Pacific/Noumea"
        techniciens={TECHNICIENS}
        onFermer={vi.fn()}
        onConfirmer={onConfirmer}
      />,
    );
    await choisirDureeEtHeure();
    await waitFor(() =>
      expect(
        screen.getByLabelText(t("intervention.confirmer_date_passee")),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByLabelText(t("intervention.confirmer_date_passee")),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: t("planning.pose.confirmer"),
        hidden: true,
      }),
    );

    expect(onConfirmer).toHaveBeenCalledTimes(1);
    const main = onConfirmer.mock.calls[0]?.[0];
    expect(main.confirmerDatePassee).toBe(true);
    expect(main.confirmerHorsOuverture).toBe(false);
  });
});
