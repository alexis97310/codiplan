import { type Fuseau, versLocal } from "@/lib/calendar/fuseau";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * LE LIBELLÉ DE CHAQUE `EvenementNotification` (9J09, `prisma/schema.prisma`)
 * — une ligne par membre de l'énumération, jamais un texte composé depuis le
 * nom technique (L0-11). `NotificationEnListe.evenement` est une simple
 * chaîne (`lib/notifications/depot.ts`) : un événement qu'une migration
 * future ajouterait sans entrée ici se rend tel quel, plutôt que de faire
 * échouer tout l'écran.
 */
const LIBELLES_EVENEMENT: Partial<Record<string, CleTraduction>> = {
  signature_absente_ou_refusee:
    "notifications.evenement.signature_absente_ou_refusee",
  devis_en_retard: "notifications.evenement.devis_en_retard",
  accord_attendu_en_retard: "notifications.evenement.accord_attendu_en_retard",
  piece_recue: "notifications.evenement.piece_recue",
};

export function libelleEvenement(evenement: string): string {
  const cle = LIBELLES_EVENEMENT[evenement];
  return cle === undefined ? evenement : t(cle);
}

/**
 * « JJ/MM/AAAA à HH:MM », dans le fuseau de la SOCIÉTÉ (L0-08) — même patron
 * que `sousTitreReception` (`app/(back-office)/demandes/presentation.ts`),
 * jamais un second calcul de la même forme.
 */
export function dateNotification(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const deux = (n: number): string => String(n).padStart(2, "0");
  const date = `${deux(local.jour)}/${deux(local.mois)}/${local.annee}`;
  const heure = `${deux(local.heures)}:${deux(local.minutes)}`;
  return `${date}${t("ponctuation.a")}${heure}`;
}
