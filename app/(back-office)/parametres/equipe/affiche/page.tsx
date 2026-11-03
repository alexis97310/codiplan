import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ImprimerAfficheInstallation } from "@/components/pwa/actions-affiche";
import { Carte } from "@/components/ui/carte";
import { QrCode } from "@/components/ui/qr-code";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("pwa.affiche.titre") };

/**
 * L'AFFICHE À IMPRIMER DE `/installer` (9I00, demande d'Alexis du
 * 31/10/2026) — même garde que `/parametres/equipe` (`administrer_
 * utilisateurs`), puisqu'elle en est une sous-page.
 *
 * AUCUNE donnée personnelle ni de société : le QR encode l'URL ABSOLUE,
 * PUBLIQUE, de `/installer` — lue du `host` de LA REQUÊTE QUI OUVRE CETTE
 * PAGE, jamais d'une variable d'environnement qui daterait du déploiement.
 */
export default async function PageAfficheInstallation() {
  const entetes = await headers();
  const session = await obtenirSession(entetes);
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "administrer_utilisateurs")
  ) {
    return (
      <Page chemin="/parametres/equipe" titre={t("pwa.affiche.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const hote = entetes.get("host") ?? "";
  const protocole = entetes.get("x-forwarded-proto") ?? "http";
  const urlInstaller = `${protocole}://${hote}/installer`;

  return (
    <Page
      chemin="/parametres/equipe"
      titre={t("pwa.affiche.titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("equipe.titre"), href: "/parametres/equipe" },
        { libelle: t("pwa.affiche.titre") },
      ]}
      actions={<ImprimerAfficheInstallation />}
    >
      <Carte className="zone-impression-affiche mx-auto max-w-md">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <h2 className="text-24 font-extrabold">{t("pwa.affiche.titre")}</h2>
          <QrCode
            valeur={urlInstaller}
            taille={240}
            titre={t("pwa.affiche.qr.titre")}
          />
          <p className="text-16 font-bold">{t("pwa.affiche.explication")}</p>
        </div>
      </Carte>
    </Page>
  );
}
