import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LE DERNIER CHEMIN DE D221, FERMÉ PAR L'AUTRE BOUT (9G8E-NAV-TECHNICIEN-
 * SANS-ENTREES-BUREAU) — 9G8D mesurait qu'un clic sur une entrée de la
 * colonne, pendant sa fenêtre de préchargement, atteignait le contenu
 * interdit sans repasser par le serveur. Ce lot retire les liens eux-mêmes
 * (`lib/navigation/entrees.ts`, `components/navigation/menu-creer.tsx`) : il
 * ne reste au technicien, dans TOUT le chrome du back-office, qu'un seul lien
 * `<Link>` vers une route qui n'est PAS déjà exemptée — « Absence » du menu
 * « + Créer » (`/absences?declarer=1`), et le bouton qui referme son volet
 * (`/absences`, SANS LA RECHERCHE).
 *
 * **CE QUE LE SCÉNARIO CI-DESSOUS MESURE, PRÉCISÉMENT** : fermer ce volet est
 * une navigation DOUCE (`<Link href="/absences">`, `components/ui/volet.tsx`)
 * qui ne change QUE la recherche — même chemin, `/absences`, avant et après.
 * `app/(back-office)/template.tsx` affirme être RECRÉÉ « à chaque navigation,
 * douce ou dure » (9G8D) ; ceci est la mesure qui le vérifie pour le cas le
 * plus étroit possible — aucun changement de SEGMENT, juste la recherche —
 * plutôt que de le supposer. **Mesuré ROUGE avant correction** : la requête
 * RSC déclenchée par le clic atteignait bien le serveur (confirmée par
 * instrumentation réseau), mais Next.js réutilisait le rendu déjà fait du
 * template plutôt que de le rejouer — le SEGMENT de route, lui, n'avait pas
 * changé. `app/(back-office)/absences/page.tsx` porte donc désormais un
 * second filet, propre à cette seule page (c'est la SEULE fermeture de D221
 * qui dépende de la recherche plutôt que du seul chemin), en relisant la même
 * fonction que le template.
 */
test("technicien — fermer le volet de déclaration (recherche seule) renvoie à /terrain", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences?declarer=1");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("link", { name: fr["volet.fermer"] }).click();

  await expect(page).toHaveURL(/\/terrain$/);
});

/**
 * MÊME EXEMPTION, DEPUIS `/arrivee` CETTE FOIS — ET UNE MESURE QUI EN DÉCOULE.
 *
 * `/arrivee` EST elle-même l'exemption de D221 (`CHEMIN_EXEMPTE_DU_GARDE_
 * TECHNICIEN`), donc l'endroit le plus direct où chercher un second chemin
 * ouvert. **Mesuré ici** : `COMPTE_TECHNICIEN_EPREUVE` n'a qu'UNE société
 * (99A-ARRIVEE, voir `tests/e2e/setup/session.ts`), et pour ce cas `/arrivee`
 * ne rend jamais rien au navigateur — `destinationSiSocieteUnique`
 * (`app/(back-office)/arrivee/decision.ts`) redirige AVANT la moindre
 * peinture. Il n'existe donc, pour ce compte, aucun DOM à cliquer sur
 * `/arrivee` — ni le menu « + Créer », ni le lien « Entrer » : la page elle-
 * même ne s'arrête jamais là. Ce que ce scénario prouve malgré cela :
 * l'exemption ne mène, pour ce compte, JAMAIS à un écran du bureau —
 * seulement à `/terrain`.
 */
test("technicien — /arrivee (l'exemption elle-même) ne mène jamais au bureau, seulement à /terrain", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/arrivee");
  await expect(page).toHaveURL(/\/terrain$/);
});
