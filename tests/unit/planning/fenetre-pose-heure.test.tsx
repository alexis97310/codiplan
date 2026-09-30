import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FenetrePose } from "@/components/planning/fenetre-pose";
import { t } from "@/lib/i18n/fr";
import type { EnMain, CibleDeDepot } from "@/components/planning/pose";

/**
 * L'HEURE DE LA CASE PRÉ-REMPLIT LA FENÊTRE DE POSE (décision d'Alexis du
 * 30/09/2026, point 4 ; D147).
 *
 * *Le défaut mesuré sur `main` avant ce ticket* : `FenetrePose` n'a aucune
 * prop d'heure de départ — `heureMinutes` part toujours de `null`, quelle que
 * soit la case sur laquelle une carte de la file a été déposée. Ce fichier
 * éprouve le composant SEUL, sans passer par `Posable` (voir
 * `pose.test.tsx` pour le dépôt lui-même).
 */

const TECHNICIENS = [{ id: "tech-1", nom: "Jean" }];

function fetchAvecCreneauxEtSansHeure(): typeof fetch {
  return vi.fn(async (url: string) => {
    const contientHeure = String(url).includes("heure=");
    return {
      ok: true,
      json: async () =>
        contientHeure
          ? { verdicts: [] }
          : { creneaux: ["2026-09-16T20:00:00.000Z"] },
    } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("`heureMinutesInitiale` — l'heure de la case, pré-remplie (D147)", () => {
  it("`data-heure` porte l'heure de départ, et un choix de durée la GARDE tant qu'elle n'est pas retouchée", async () => {
    vi.stubGlobal("fetch", fetchAvecCreneauxEtSansHeure());
    const onConfirmer = vi.fn();

    const { container } = render(
      <FenetrePose
        interventionId="int-1"
        libelle="Client Témoin · Panne · Urgent"
        dureeMinInitiale={null}
        technicienIdInitial={null}
        jour="2026-09-16"
        fuseau="Pacific/Noumea"
        techniciens={TECHNICIENS}
        heureMinutesInitiale={600}
        onFermer={vi.fn()}
        onConfirmer={onConfirmer}
      />,
    );

    const fenetre = () =>
      container.querySelector('[data-fenetre-pose="int-1"]');
    expect(fenetre()?.getAttribute("data-heure")).toBe("600");

    fireEvent.click(
      screen.getByRole("button", {
        name: t("planning.pose.duree_60"),
        hidden: true,
      }),
    );

    // LA DURÉE VIENT D'ÊTRE CHOISIE — l'heure de la case n'a, elle, jamais
    // été retouchée par l'utilisateur : elle survit au choix de durée
    // (spécification §3.10, « aucune valeur inventée » — mais rien n'impose
    // non plus d'effacer ce que le geste a déjà donné).
    expect(fenetre()?.getAttribute("data-heure")).toBe("600");

    await waitFor(() => {
      const urlsAppelees = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
        (appel: unknown[]) => String(appel[0]),
      );
      expect(
        urlsAppelees.some(
          (url) => url.includes("heure=600") && url.includes("duree=60"),
        ),
      ).toBe(true);
    });

    const urlsAppelees = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (appel: unknown[]) => String(appel[0]),
    );
    expect(urlsAppelees.some((url) => url.includes("/deplacer"))).toBe(false);

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: t("planning.pose.confirmer"),
          hidden: true,
        }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: t("planning.pose.confirmer"),
        hidden: true,
      }),
    );

    expect(onConfirmer).toHaveBeenCalledTimes(1);
    const [main, cible] = onConfirmer.mock.calls[0] as [EnMain, CibleDeDepot];
    expect(cible.minutes).toBe(600);
    expect(main.dureeMin).toBe(60);
  });

  it("TÉMOIN : sans heure de départ, `data-heure` est vide — la puce de durée ne pose aucune heure (comportement d'aujourd'hui)", () => {
    vi.stubGlobal("fetch", fetchAvecCreneauxEtSansHeure());

    const { container } = render(
      <FenetrePose
        interventionId="int-1"
        libelle="Client Témoin · Panne · Urgent"
        dureeMinInitiale={null}
        technicienIdInitial={null}
        jour="2026-09-16"
        fuseau="Pacific/Noumea"
        techniciens={TECHNICIENS}
        onFermer={vi.fn()}
        onConfirmer={vi.fn()}
      />,
    );

    const fenetre = () =>
      container.querySelector('[data-fenetre-pose="int-1"]');
    expect(fenetre()?.getAttribute("data-heure")).toBe("");

    fireEvent.click(
      screen.getByRole("button", {
        name: t("planning.pose.duree_60"),
        hidden: true,
      }),
    );

    expect(fenetre()?.getAttribute("data-heure")).toBe("");
  });

  it("une heure CHOISIE PAR L'UTILISATEUR (« Autre heure »), puis un changement de durée, remet l'heure à vide — comme aujourd'hui", () => {
    vi.stubGlobal("fetch", fetchAvecCreneauxEtSansHeure());

    const { container } = render(
      <FenetrePose
        interventionId="int-1"
        libelle="Client Témoin · Panne · Urgent"
        dureeMinInitiale={60}
        technicienIdInitial={null}
        jour="2026-09-16"
        fuseau="Pacific/Noumea"
        techniciens={TECHNICIENS}
        heureMinutesInitiale={600}
        onFermer={vi.fn()}
        onConfirmer={vi.fn()}
      />,
    );

    const fenetre = () =>
      container.querySelector('[data-fenetre-pose="int-1"]');
    expect(fenetre()?.getAttribute("data-heure")).toBe("600");

    fireEvent.change(screen.getByLabelText(t("planning.pose.heure_autre")), {
      target: { value: "11:00" },
    });
    expect(fenetre()?.getAttribute("data-heure")).toBe("660");

    fireEvent.click(
      screen.getByRole("button", {
        name: t("planning.pose.duree_90"),
        hidden: true,
      }),
    );

    expect(fenetre()?.getAttribute("data-heure")).toBe("");
  });
});
