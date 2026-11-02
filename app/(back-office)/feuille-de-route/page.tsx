import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { RefusAcces } from "@/components/ui/refus-acces";
import { obtenirSession } from "@/lib/auth/session";
import {
  DATE_ETAT_FEUILLE_DE_ROUTE,
  SECTIONS_FEUILLE_DE_ROUTE,
  type StatutFeuilleDeRoute,
} from "@/lib/feuille-de-route/contenu";
import { peutVoirFeuilleDeRoute } from "@/lib/feuille-de-route/acces";
import { t } from "@/lib/i18n/fr";

/**
 * « FEUILLE DE ROUTE » (9IC5-FEUILLE-DE-ROUTE, demande d'Alexis du
 * 02/11/2026) — reste à faire, décisions en attente, livré, dans UN fichier
 * du dépôt (`lib/feuille-de-route/contenu.ts`), jamais une base ni une
 * bibliothèque Markdown.
 *
 * **Réservée à `admin_societe` et `admin_plateforme`** — `direction`, l'ADV
 * et tout autre rôle reçoivent `RefusAcces`, comme les autres pages fermées
 * par rôle (`peutVoirFeuilleDeRoute`, partagée avec l'entrée de menu dans
 * `lib/navigation/entrees.ts`, jamais une seconde lecture du même critère).
 *
 * **Aucune lecture de base.** Le contenu est statique ; cette page ne porte
 * donc pas le garde habituel « société active » (`exigerSocieteActive`) —
 * `admin_plateforme` n'a précisément AUCUNE société active (voir
 * `lib/auth/reinitialisation.ts`), et l'exiger ici lui fermerait une page que
 * la demande d'Alexis lui ouvre explicitement.
 */

const TON_PAR_STATUT: Record<StatutFeuilleDeRoute, TonBadge> = {
  en_cours: "bleu",
  pret: "orange",
  a_ecrire: "gris",
  decision: "orange",
  bloque: "rouge",
  livre: "vert",
};

function libelleStatut(statut: StatutFeuilleDeRoute): string {
  return t(
    `feuille_de_route.statut.${statut}` as `feuille_de_route.statut.${StatutFeuilleDeRoute}`,
  );
}

export default async function PageFeuilleDeRoute() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }

  if (!peutVoirFeuilleDeRoute(session.contexte.role)) {
    return (
      <Page chemin="/feuille-de-route" titre={t("feuille_de_route.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  return (
    <Page
      chemin="/feuille-de-route"
      titre={t("feuille_de_route.titre")}
      sousTitre={`${t("feuille_de_route.etat_au")} ${DATE_ETAT_FEUILLE_DE_ROUTE}`}
    >
      {SECTIONS_FEUILLE_DE_ROUTE.map((section) => (
        <Carte key={section.titre} titre={section.titre}>
          <ul className="flex flex-col gap-2 p-[16px]">
            {section.elements.map((element) => (
              <li
                key={element.titre}
                className="flex items-start gap-2 text-13 font-bold"
              >
                <Badge ton={TON_PAR_STATUT[element.statut]}>
                  {libelleStatut(element.statut)}
                </Badge>
                <span className="flex-1">{element.titre}</span>
              </li>
            ))}
          </ul>
        </Carte>
      ))}
    </Page>
  );
}
