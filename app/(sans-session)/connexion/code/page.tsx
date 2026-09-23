import type { Metadata } from "next";

import { headers } from "next/headers";

import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("connexion.code") };

/**
 * PRÉSENTATION DU SECOND FACTEUR À LA CONNEXION (ticket L1-02f).
 *
 * Ce que cette page NE dit pas est aussi important que ce qu'elle dit : elle
 * n'apprend rien du compte, et son refus est le même que tous les autres (D35).
 * On n'y arrive qu'avec le bon mot de passe, ce qui ne renseigne aucun tiers.
 */
export default async function PageCodeSecondFacteur({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Lire les en-têtes rend le rendu dynamique : cette page dépend du cookie de
  // défi que la connexion vient de poser, elle ne peut pas être figée.
  await headers();
  const motif = (await searchParams).motif;
  return (
    <Formulaire
      action="/api/session/code"
      titre={t("connexion.code")}
      accroche={t("connexion.code.accroche")}
      valider={t("connexion.code.valider")}
    >
      <Message motif={typeof motif === "string" ? motif : undefined} />
      <Champ
        nom="code"
        type="text"
        libelle={t("connexion.code")}
        motif="[0-9]{6}"
      />
    </Formulaire>
  );
}
