"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Message } from "@/components/ui/message";
import { t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";

import { ligneHomonyme, type Homonyme } from "../presentation";

/**
 * LE CHAMP RAISON SOCIALE, ET L'ALERTE DE DOUBLON POSSIBLE QU'IL PORTE
 * (9EK-TP-UX5-2-CREATIONS-1, CS40).
 *
 * **Ce composant POSSÈDE le champ** — label, `<input>`, et l'alerte —
 * plutôt que de recevoir une valeur et de rendre l'alerte à côté : la
 * raison sociale n'est connue qu'ICI, au clavier, et c'est au même endroit
 * que la recherche d'homonymes doit partir.
 *
 * **Non bloquant** (CS40) : des homonymes réels existent (deux garages du
 * même nom, par exemple), et l'alerte ne fait qu'ouvrir un raccourci vers la
 * fiche existante — la création reste possible.
 *
 * **Échec réseau, refus (403), ou saisie dont la forme normalisée est
 * vide → AUCUNE alerte.** La route elle-même court-circuite déjà le texte
 * vide ; côté client, une réponse qui n'est pas `ok`, ou une requête qui lève,
 * laisse simplement la dernière liste connue vide plutôt que d'afficher une
 * erreur technique à la place d'un avertissement métier.
 *
 * **Recherche aussi AU MONTAGE** quand une valeur est gardée après un refus
 * de saisie (9BR-TP-A4b-MESSAGES) — sans quoi un homonyme resterait invisible
 * tant que le champ n'a pas repris puis reperdu le focus.
 */
export function AlerteHomonymes({
  valeurInitiale,
}: Readonly<{ valeurInitiale?: string }>) {
  const [homonymes, setHomonymes] = useState<readonly Homonyme[]>([]);
  const demandeEnCours = useRef(0);

  async function chercher(raisonSociale: string): Promise<void> {
    const identifiant = ++demandeEnCours.current;
    if (raisonSociale.trim().length === 0) {
      setHomonymes([]);
      return;
    }
    let reponse: Response;
    try {
      reponse = await fetch(
        `/api/clients/homonymes?raison_sociale=${encodeURIComponent(raisonSociale)}`,
      );
    } catch {
      return;
    }
    if (identifiant !== demandeEnCours.current) {
      return;
    }
    if (!reponse.ok) {
      setHomonymes([]);
      return;
    }
    const corps = (await reponse.json()) as { resultats?: Homonyme[] };
    if (identifiant !== demandeEnCours.current) {
      return;
    }
    setHomonymes(corps.resultats ?? []);
  }

  useEffect(() => {
    if (valeurInitiale !== undefined && valeurInitiale.trim().length > 0) {
      void chercher(valeurInitiale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule recherche, au montage (saisie gardée après un refus)
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-13 font-bold">
        {libelleChampObligatoire(t("client.raison_sociale"))}
        <input
          name="raison_sociale"
          defaultValue={valeurInitiale}
          required
          onBlur={(evenement) => void chercher(evenement.target.value)}
          className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
        />
      </label>
      {homonymes.length === 0 ? null : (
        <Message
          ton="avertissement"
          titre={t(
            homonymes.length === 1
              ? "clients.homonymes.titre"
              : "clients.homonymes.titre_pluriel",
          )}
        >
          <ul className="flex flex-col gap-1">
            {homonymes.map((homonyme) => (
              <li key={homonyme.id} className="text-13 font-bold">
                <Link href={`/clients/${homonyme.id}`} className="underline">
                  {homonyme.raison_sociale}
                </Link>
                {t("ponctuation.point_median")}
                {ligneHomonyme(homonyme)}
              </li>
            ))}
          </ul>
          <p className="text-13 font-bold">
            {t(
              homonymes.length === 1
                ? "clients.homonymes.conseil"
                : "clients.homonymes.conseil_pluriel",
            )}
          </p>
        </Message>
      )}
    </div>
  );
}
