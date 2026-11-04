import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { decomptesDuMenu } from "@/lib/navigation/decomptes";
import { poserNotification } from "@/lib/notifications/depot";

import { clientApp, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE DÉCOMPTE « NOTIFICATIONS » DU MENU (9J10-NOTIFICATIONS-ECRAN), SOUS LE
 * CONTEXTE CLOISONNÉ RÉEL — pas une couverture de plus de `listerNotifications`
 * (déjà éprouvée, en isolation, par `tests/isolation/notification.test.ts`,
 * 9J09) : ce fichier mesure ce que `decomptesDuMenu`
 * (`lib/navigation/decomptes.ts`) EN TIRE, puisque c'est lui — et non le
 * dépôt directement — que `components/navigation/barre.tsx` consulte pour
 * décider si l'entrée de menu « Notifications » reste affichée.
 *
 * **Deux comptes, deux totaux mesurés, jamais « non vide ».** Le piège
 * nommé par `docs/doctrine-arbitrage.md` (§9, 01/09) : une assertion qui se
 * contenterait de « `total > 0` » pour l'un des deux comptes ne prouverait
 * rien si le filtre par capacité de `listerNotifications` cessait de mordre
 * — elle resterait verte par coïncidence. `toEqual({ total: N, urgent:
 * false })`, pour les DEUX comptes, est le seul chiffre qui rougirait si la
 * capacité de la ligne posée cessait d'être jugée.
 */

afterAll(fermerClients);

function session(
  utilisateurId: string,
  societeId: string,
  role: Role,
): ContexteSession {
  return {
    utilisateurId,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/** Rôle ADV : niveau « complet » sur `annuler_intervention` (matrice §5.2). */
const INTERNE_ADV = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);

/** Rôle technicien : AUCUN niveau sur `annuler_intervention` — ni ●, ni ○. */
const INTERNE_TECHNICIEN = session(
  UTILISATEUR_PAR_ROLE[Role.technicien],
  SOCIETE_A,
  Role.technicien,
);

describe("decomptesDuMenu — « notifications », filtré par CAPACITÉ comme listerNotifications", () => {
  it("poser UNE notification augmente le total de l'ADV d'EXACTEMENT un, et laisse celui du technicien inchangé", async () => {
    // LE DELTA, JAMAIS LE TOTAL ABSOLU — la société de ce scénario est
    // partagée entre fichiers de test sous `fullyParallel` (même piège que
    // `docs/doctrine-arbitrage.md`, §9, 01/09, déjà nommé pour le semis
    // partagé) : un total absolu mesuré ici pourrait inclure une ligne posée
    // par un autre fichier, au même instant. Le DELTA que CETTE pose précise
    // produit reste vrai quel que soit ce qui se pose par ailleurs.
    const avantAdv =
      (await decomptesDuMenu(INTERNE_ADV, clientApp()))?.notifications.total ??
      0;
    const avantTechnicien =
      (await decomptesDuMenu(INTERNE_TECHNICIEN, clientApp()))?.notifications
        .total ?? 0;

    await poserNotification(
      INTERNE_ADV,
      "signature_absente_ou_refusee",
      { cible: "intervention", intervention_id: INTERVENTION_A1 },
      "annuler_intervention",
      undefined,
      clientApp(),
    );

    const apresAdv = await decomptesDuMenu(INTERNE_ADV, clientApp());
    const apresTechnicien = await decomptesDuMenu(
      INTERNE_TECHNICIEN,
      clientApp(),
    );

    expect(apresAdv?.notifications).toEqual({
      total: avantAdv + 1,
      urgent: false,
    });
    expect(apresTechnicien?.notifications).toEqual({
      total: avantTechnicien,
      urgent: false,
    });
  });
});
