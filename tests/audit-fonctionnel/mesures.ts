import type { Page } from "@playwright/test";

/**
 * L'INSTRUMENTATION PARTAGÉE DE L'AUDIT FONCTIONNEL (9F5-AUDIT-FONCTIONNEL-PARCOURS).
 *
 * Posée une fois par page, jamais par navigation : les écouteurs Playwright
 * (`console`, `pageerror`, `response`, `requestfailed`) restent actifs tout du
 * long, et `demarrerReleve` vide seulement les tampons avant chaque nouvelle
 * navigation — sans quoi les erreurs d'une page s'attribueraient à la suivante.
 */

export type ReponseEnEchec = { readonly url: string; readonly statut: number };
export type RequeteEnEchec = { readonly url: string; readonly erreur: string };

export type MesurePage = {
  readonly url: string;
  readonly statutNavigation: number | null;
  readonly dureeNavigationMs: number;
  readonly erreursConsole: readonly string[];
  readonly erreursPage: readonly string[];
  readonly reponsesEnEchec: readonly ReponseEnEchec[];
  readonly requetesEnEchec: readonly RequeteEnEchec[];
  readonly imagesCassees: readonly string[];
  readonly boutonsSansNomAccessible: number;
  readonly champsSansLabel: number;
};

export type Instrumentation = {
  /** Vide les tampons — à appeler juste avant chaque `page.goto`. */
  demarrerReleve(): void;
  /** Lit les tampons et le DOM — à appeler juste après chaque navigation. */
  releve(
    url: string,
    debutMs: number,
    statutNavigation: number | null,
  ): Promise<MesurePage>;
};

export function instrumenter(page: Page): Instrumentation {
  let erreursConsole: string[] = [];
  let erreursPage: string[] = [];
  let reponsesEnEchec: ReponseEnEchec[] = [];
  let requetesEnEchec: RequeteEnEchec[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      erreursConsole.push(message.text());
    }
  });
  page.on("pageerror", (erreur) => {
    erreursPage.push(String(erreur));
  });
  page.on("response", (reponse) => {
    if (reponse.status() >= 400) {
      reponsesEnEchec.push({ url: reponse.url(), statut: reponse.status() });
    }
  });
  page.on("requestfailed", (requete) => {
    requetesEnEchec.push({
      url: requete.url(),
      erreur: requete.failure()?.errorText ?? "erreur inconnue",
    });
  });

  return {
    demarrerReleve(): void {
      erreursConsole = [];
      erreursPage = [];
      reponsesEnEchec = [];
      requetesEnEchec = [];
    },
    async releve(url, debutMs, statutNavigation): Promise<MesurePage> {
      const dureeNavigationMs = Date.now() - debutMs;
      const diagnosticDom = await page.evaluate(() => {
        function nomAccessible(element: Element): string {
          const aria = element.getAttribute("aria-label");
          if (aria !== null && aria.trim().length > 0) {
            return aria.trim();
          }
          const texte = (element.textContent ?? "").trim();
          if (texte.length > 0) {
            return texte;
          }
          const titre = element.getAttribute("title");
          return titre !== null ? titre.trim() : "";
        }

        const images = Array.from(document.querySelectorAll("img"));
        const imagesCassees = images
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.src);

        const interactifs = Array.from(
          document.querySelectorAll('button, a[href], [role="button"]'),
        );
        const boutonsSansNomAccessible = interactifs.filter(
          (element) => nomAccessible(element).length === 0,
        ).length;

        const champs = Array.from(
          document.querySelectorAll("input, select, textarea"),
        ).filter((element) => element.getAttribute("type") !== "hidden");
        const champsSansLabel = champs.filter((element) => {
          if (
            element.getAttribute("aria-label") !== null ||
            element.getAttribute("aria-labelledby") !== null
          ) {
            return false;
          }
          const id = element.getAttribute("id");
          if (
            id !== null &&
            document.querySelector(`label[for="${id}"]`) !== null
          ) {
            return false;
          }
          return element.closest("label") === null;
        }).length;

        return { imagesCassees, boutonsSansNomAccessible, champsSansLabel };
      });

      return {
        url,
        statutNavigation,
        dureeNavigationMs,
        erreursConsole: [...erreursConsole],
        erreursPage: [...erreursPage],
        reponsesEnEchec: [...reponsesEnEchec],
        requetesEnEchec: [...requetesEnEchec],
        imagesCassees: diagnosticDom.imagesCassees,
        boutonsSansNomAccessible: diagnosticDom.boutonsSansNomAccessible,
        champsSansLabel: diagnosticDom.champsSansLabel,
      };
    },
  };
}
