"use client";

import Link from "next/link";

import { type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { CompteurVivant } from "./compteur-vivant";
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
  minutesFermees = 0,
  instantServeur = null,
}: Readonly<{
  readonly interventionId: string;
  readonly client: string;
  readonly depuis: Date;
  readonly fuseau: Fuseau;
  /** LES MINUTES DÉJÀ FERMÉES DE CETTE INTERVENTION (point 7,
   * 9G5-TERRAIN-ERGONOMIE) — sans elles, ce bandeau ne comptait que le
   * segment ouvert DEPUIS `depuis`, tandis que la fiche de la même
   * intervention (`/terrain/[id]`) ajoute les segments déjà fermés : la
   * MÊME intervention affichait deux durées différentes selon l'écran.
   * Défaut à 0, le même que `CompteurVivant` : un appelant qui ne les
   * connaît pas encore (aucun aujourd'hui) n'est pas pour autant en faute. */
  readonly minutesFermees?: number;
  /** LA DURÉE QUI DÉFILE (point 1, 9F4H5-TERRAIN-VIVANT) — l'heure du
   * SERVEUR au moment du rendu, pour corriger l'horloge de l'appareil (voir
   * le docblock de `lib/terrain/compteur-vivant.ts`). L'ANNONCE LUE PAR UN
   * LECTEUR D'ÉCRAN RESTE `texteDuBandeau`, sans la seconde qui défile :
   * une annonce qui se répète chaque seconde serait inaudible.
   * Optionnelle (défaut `null`, aucune correction) : un appelant qui ne
   * connaît pas encore l'heure serveur n'est pas pour autant en faute. */
  readonly instantServeur?: Date | null;
}>) {
  return (
    <Link
      href={`/terrain/${interventionId}`}
      aria-label={texteDuBandeau(client, depuis, fuseau)}
      className={`border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-16 font-bold ${CLASSES_LIEN}`}
    >
      <span>
        {t("terrain.compteur.bandeau_prefixe")} {heureLocale(depuis, fuseau)}
        {t("ponctuation.parenthese_ouvrante")}
        <CompteurVivant
          depart={depuis}
          minutesFermees={minutesFermees}
          instantServeur={instantServeur}
        />
        {t("ponctuation.parenthese_fermante")}
        {t("ponctuation.separateur")}
        {client}
      </span>
    </Link>
  );
}
