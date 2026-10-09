"use client";

import { useId, useState } from "react";

/**
 * LE CHAMP MOT DE PASSE, AVEC « AFFICHER / MASQUER » (D188, partie 5 ; M:5455).
 *
 * Le `<label>` et son texte restent EXACTEMENT ceux d'aujourd'hui
 * (`connexion.mot_de_passe`) : 40 épreuves font `getByLabel(fr["connexion.
 * mot_de_passe"])` et doivent continuer à trouver CE SEUL champ. Le bouton
 * « Afficher »/« Masquer » est donc posé HORS du `<label>`, sans
 * `aria-label` qui porterait les mots « Mot de passe » — son nom
 * accessible est son propre texte visible.
 *
 * `type="button"` : il ne soumet jamais le formulaire, seulement l'attribut
 * `type` du champ, basculé côté client — aucune requête, aucune route
 * touchée.
 */
export function ChampMotDePasse({
  libelle,
  libelleAfficher,
  libelleMasquer,
}: Readonly<{
  libelle: string;
  libelleAfficher: string;
  libelleMasquer: string;
}>) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {libelle}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name="motDePasse"
          type={visible ? "text" : "password"}
          required
          autoComplete="current-password"
          className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm font-normal"
        />
        <button
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible((precedent) => !precedent)}
          className="text-muted-foreground shrink-0 text-sm underline underline-offset-2"
        >
          {visible ? libelleMasquer : libelleAfficher}
        </button>
      </div>
    </div>
  );
}
