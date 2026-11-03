import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { Page } from "@/components/mise-en-page/page";
import { BoutonInstallerCodiplan } from "@/components/pwa/bouton-installer";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("pwa.etape.titre") };

/**
 * L'ÉTAPE D'INSTALLATION APRÈS LE PREMIER ACCÈS (9I00, demande d'Alexis du
 * 31/10/2026) — posée dans `(apres-session)`, comme `/arrivee` : une session
 * déjà ouverte, aucun chrome.
 *
 * `/arrivee` n'y envoie QUE pour un compte dont le périmètre de planning est
 * « restreint » (un technicien) ET qui vient de choisir son mot de passe
 * (`?suite=installation` reporté depuis `/connexion`) — jamais un rôle de
 * bureau, et jamais à une connexion ordinaire.
 *
 * **Jamais bloquant** : « Plus tard » mène toujours à la destination réelle,
 * reçue en clair dans `?suite=` et jamais recalculée ici — une seconde
 * lecture du même critère que `decision.ts` divergerait en silence (§9).
 * Une valeur absente ou étrangère retombe sur `/terrain`, la seule
 * destination qui amène jusqu'ici.
 */
export default async function PageInstallationApresPremierAcces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }

  // LISTE CLOSE D'UNE SEULE DESTINATION, POUR L'INSTANT — `/arrivee` n'y
  // envoie jamais qu'avec `?suite=/terrain` (seul un périmètre restreint
  // ouvre cette étape) ; une valeur étrangère ou absente retombe sur elle
  // plutôt que d'ouvrir une redirection vers n'importe quelle chaîne.
  const suite = (await searchParams).suite;
  const destination = suite === "/terrain" ? suite : "/terrain";

  return (
    <Page
      chemin="/installation"
      titre={t("pwa.etape.titre")}
      sousTitre={t("pwa.etape.accroche")}
    >
      <div className="flex flex-col gap-4">
        <BoutonInstallerCodiplan />
        <LienPrimaire href={destination}>
          {t("pwa.etape.plus_tard")}
        </LienPrimaire>
      </div>
    </Page>
  );
}
