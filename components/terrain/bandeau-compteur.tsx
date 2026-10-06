import Link from "next/link";

import { type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { heureLocale } from "./presentation";

/** « Compteur en marche depuis 09:00 — Client X », composé hors du JSX (L0-11). */
export function texteDuBandeau(
  client: string,
  depuis: Date,
  fuseau: Fuseau,
): string {
  return `${t("terrain.compteur.bandeau_prefixe")} ${heureLocale(depuis, fuseau)}${t("ponctuation.separateur")}${client}`;
}

/**
 * LE BANDEAU « COMPTEUR EN COURS » (9DI-TP-TER1-JOURNEE-FICHE, QE-11, D161).
 *
 * Rendu en tête de Ma journée ET de la fiche d'une AUTRE intervention que
 * celle où le compteur tourne — jamais sur la fiche où il tourne lui-même,
 * qui porte déjà `terrain.compteur.tourne_depuis` à sa place habituelle. Un
 * lien plutôt qu'un simple texte : *un bandeau qui ne mène pas à ce qu'il
 * annonce force un aller-retour par Ma journée.*
 */
export function BandeauCompteurEnCours({
  interventionId,
  client,
  depuis,
  fuseau,
}: Readonly<{
  readonly interventionId: string;
  readonly client: string;
  readonly depuis: Date;
  readonly fuseau: Fuseau;
}>) {
  return (
    <Link
      href={`/terrain/${interventionId}`}
      className={`border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-16 font-bold ${CLASSES_LIEN}`}
    >
      <span>{texteDuBandeau(client, depuis, fuseau)}</span>
    </Link>
  );
}
