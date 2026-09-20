import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  SCENE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES MONTANTS DE VENTE, VUS PAR DEUX RÔLES (D37, arbitrage 3.8).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * Les scénarios unitaires prouvent que `accesAuxMontants` dit ce que la matrice
 * dit. **Ils ne peuvent pas prouver qu'un ÉCRAN le lit** — et c'était
 * exactement le défaut : la règle était écrite, la matrice juste, son scénario
 * vert, et *aucun écran ne l'appelait*. Une couche sans appelant est verte pour
 * toujours.
 *
 * ## LA PAIRE, ET C'EST ELLE QUI COMPTE
 *
 * La MÊME intervention, à la MÊME seconde, ouverte par deux identités. L'une
 * voit le total hors taxes, l'autre le motif à sa place. *Un seul des deux
 * scénarios ne prouverait rien* : celui du refus passerait sur un écran qui
 * n'affiche jamais de montant à personne — ce qui n'a été demandé par personne
 * —, et celui de la direction passerait sur un écran qui les affiche à tous,
 * c'est-à-dire sur le défaut lui-même (§9, 11/09 : à côté du cas qui doit
 * rougir, le cas qui doit rester vert POUR SA PROPRE RAISON).
 *
 * ## CE QU'IL N'ÉPROUVE PAS, ET C'EST ÉCRIT
 *
 * Il ne prouve **aucun contrôle d'accès** : ce qui est masqué ici est un
 * affichage, et la base ne distingue pas les deux rôles sur ces colonnes. Le
 * module le dit de lui-même ; ce fichier ne prétend pas plus.
 */
test.describe.configure({ mode: "serial" });

/**
 * LE SECOND FACTEUR, PARCE QUE `admin_societe` EST UN RÔLE SENSIBLE.
 *
 * *Mesuré plutôt que supposé* : la connexion de ce compte ne mène pas à
 * l'arrivée mais à `/enrolement` — le §2 impose la MFA sur les rôles sensibles,
 * et `admin_societe` en administre les comptes. `ouvrirLaSessionSensible`
 * (`tests/e2e/setup/session.ts`) traverse cet enrôlement plutôt que de le
 * contourner, et partage sa clé avec `tests/e2e/equipe.spec.ts` — la MÊME
 * identité `admin_societe` du semis, ouverte par les deux fichiers dans la
 * MÊME exécution (Lot E2E-1). Voir l'en-tête de cette fonction pour la mesure
 * complète.
 */
test("l'ADV voit le total hors taxes — le cas qui doit rester vert", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.goto(`/interventions/${SCENE.obstacle}`);
  // Le TITRE du bloc est là dans les deux cas : c'est ce qui rend l'écart
  // visible au lieu de le faire disparaître.
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
});

test("`admin_societe` lit le MOTIF à la place des montants — D37", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${SCENE.obstacle}`);
  // Le bloc n'a pas disparu : *un bloc absent se lirait « cette intervention
  // n'a pas de montant » là où il faut lire « ce n'est pas pour vous »*.
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toBeVisible();
  // Et le total n'y est pas — ni son libellé, ni le taux horaire.
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toHaveCount(0);
});
