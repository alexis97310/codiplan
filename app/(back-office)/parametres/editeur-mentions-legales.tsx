"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

/**
 * LA LIGNE « MENTIONS LÉGALES » DE LA CARTE « IDENTITÉ », DEVENUE MODIFIABLE
 * (9I7A-MENTIONS-LEGALES-MODIFIABLES) — à côté de la ligne, un bouton
 * « Modifier » (visible seulement avec `peutModifier`) ouvre une zone de
 * texte avec compteur, aperçu du pied du bon, et « Enregistrer »/« Annuler ».
 *
 * **Composant client pour le COMPTEUR et l'APERÇU seuls** — l'écriture reste
 * un `<form>` natif qui POSTE `/api/parametres/societe/mentions-legales` et
 * revient sur `/parametres` (même modèle que le logo, `/parametres/societe`) ;
 * aucun `fetch`, aucune route API de lecture ajoutée pour ce composant.
 *
 * **`max` et le compte de caractères viennent du serveur, jamais recopiés** —
 * `max` est `MENTIONS_LEGALES_MAX` (`lib/societes/identite.ts`), passé en
 * props : ce module ne l'importe pas lui-même pour ne pas tirer
 * `avecContexteApplicatif`/Prisma dans le paquet client.
 */
export function EditeurMentionsLegales({
  valeurInitiale,
  max,
  peutModifier,
}: {
  readonly valeurInitiale: string | null;
  readonly max: number;
  readonly peutModifier: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(valeurInitiale ?? "");
  const idChamp = useId();

  if (!ouvert) {
    return (
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-app-encre-faible text-12 font-bold">
            {t("parametres.identite_mentions_legales")}
          </dt>
          <dd className="text-app-encre text-[13px] font-bold">
            {valeurInitiale === null || valeurInitiale.trim() === ""
              ? t("parametres.identite_non_renseigne")
              : valeurInitiale}
          </dd>
        </div>
        {peutModifier ? (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="text-app-bleu-encre shrink-0 text-12 font-bold underline"
          >
            {t("parametres.identite_mentions_legales_modifier")}
          </button>
        ) : null}
      </div>
    );
  }

  const enTrop = texte.length > max;

  return (
    <form
      method="post"
      action="/api/parametres/societe/mentions-legales"
      className="col-span-full flex flex-col gap-2"
    >
      <label
        htmlFor={idChamp}
        className="text-app-encre-faible text-12 font-bold"
      >
        {t("parametres.identite_mentions_legales")}
      </label>
      <textarea
        id={idChamp}
        name="mentions_legales"
        rows={4}
        value={texte}
        onChange={(evenement) => setTexte(evenement.target.value)}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-13 font-bold"
      />
      <p
        className={
          enTrop
            ? "text-app-rouge-encre text-12 font-bold"
            : "text-app-encre-faible text-12 font-bold"
        }
      >
        {texte.length}
        {t("ponctuation.slash")}
        {max} {t("parametres.identite_mentions_legales_compteur_caracteres")}
      </p>
      <p className="text-app-encre-faible text-12 font-bold">
        {t("parametres.identite_mentions_legales_aide")}
      </p>

      {texte.trim() === "" ? null : (
        <div className="flex flex-col gap-1">
          <span className="text-app-encre-faible text-12 font-bold">
            {t("parametres.identite_mentions_legales_apercu_titre")}
          </span>
          <p className="text-app-encre-faible border-app-bord border-t pt-3 text-12 font-bold whitespace-pre-wrap">
            {texte}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="default" size="sm" disabled={enTrop}>
          {t("parametres.identite_mentions_legales_enregistrer")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setTexte(valeurInitiale ?? "");
            setOuvert(false);
          }}
        >
          {t("parametres.identite_mentions_legales_annuler")}
        </Button>
      </div>
    </form>
  );
}
