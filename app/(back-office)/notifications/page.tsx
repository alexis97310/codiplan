import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { EtatVide } from "@/components/ui/etat-vide";
import { obtenirSession } from "@/lib/auth/session";
import { type Fuseau, lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import {
  listerNotifications,
  type NotificationEnListe,
} from "@/lib/notifications/depot";

import { dateNotification, libelleEvenement } from "./presentation";

export const metadata: Metadata = { title: t("notifications.titre") };

/**
 * L'ÉCRAN DES NOTIFICATIONS INTERNES (9J10-NOTIFICATIONS-ECRAN), AU-DESSUS DE
 * `lib/notifications/depot.ts` (9J09, D229).
 *
 * **Aucune capacité dédiée à L'ÉCRAN lui-même** — même patron que
 * `/demandes` (D133) : `listerNotifications` a déjà filtré, LIGNE PAR LIGNE,
 * par la capacité que CHAQUE notification porte (`capacite_requise`,
 * `niveau()`) ; un second filtre ici serait une seconde lecture du même
 * critère (§9, 01/09). Un compte sans aucune capacité notifiable voit
 * simplement une liste vide — l'entrée de menu qui mène ici disparaît déjà
 * pour lui (`components/navigation/barre.tsx`, `sansNotificationsVides`),
 * mais l'URL elle-même reste ouverte à toute session active, comme
 * `/demandes`.
 */
export default async function PageNotifications() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const [notifications, societe] = await Promise.all([
    listerNotifications(session.contexte),
    avecContexteApplicatif(session.contexte, (tx) =>
      tx.societe.findFirst({ select: { fuseau_horaire: true } }),
    ),
  ]);
  const fuseau = lireFuseau(societe?.fuseau_horaire);
  const nonLues = notifications.filter(
    (notification) => notification.lueLe === null,
  ).length;

  return (
    <Page
      chemin="/notifications"
      titre={t("notifications.titre")}
      sousTitre={t("notifications.sous_titre")}
    >
      <p className="text-13 font-bold" role="status">
        {nonLues === 0
          ? t("notifications.toutes_lues")
          : `${nonLues}${
              nonLues === 1
                ? t("notifications.non_lues_suffixe_une")
                : t("notifications.non_lues_suffixe")
            }`}
      </p>

      {notifications.length === 0 ? (
        <EtatVide titre={t("notifications.vide_titre")} icone="bell">
          {t("notifications.vide_texte")}
        </EtatVide>
      ) : (
        <Carte>
          <ul className="divide-app-bord flex flex-col divide-y">
            {notifications.map((notification) => (
              <LigneNotification
                key={notification.id}
                notification={notification}
                fuseau={fuseau}
              />
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}

function LigneNotification({
  notification,
  fuseau,
}: {
  readonly notification: NotificationEnListe;
  readonly fuseau: Fuseau;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-13 font-bold">
          {libelleEvenement(notification.evenement)}
          {notification.lueLe === null ? (
            <Badge ton="bleu">{t("notifications.non_lue")}</Badge>
          ) : null}
        </span>
        <span className="text-app-encre-faible text-12 font-bold">
          {t("notifications.recue_prefixe")}{" "}
          {dateNotification(notification.creeLe, fuseau)}
        </span>
      </div>
      {notification.lueLe === null ? (
        <form action="/api/notifications/marquer-lue" method="post">
          <input type="hidden" name="id" value={notification.id} />
          <Button type="submit" variant="outline" size="sm">
            {t("notifications.marquer_lue")}
          </Button>
        </form>
      ) : null}
    </li>
  );
}
