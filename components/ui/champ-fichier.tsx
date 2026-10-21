"use client";

import { useEffect, useId, useRef, useState } from "react";

import { t } from "@/lib/i18n/fr";

/**
 * LE CHAMP FICHIER — bouton stylé et nom de fichier en français (audit du
 * 21/10/2026, 9G9B), plutôt que le bouton natif du navigateur.
 *
 * ## Pourquoi `lang="fr"` (déjà posé sur `<html>`) ne suffit pas
 *
 * Le texte d'un `<input type="file">` natif — « Choose File », « No file
 * chosen » — suit la langue de l'INTERFACE du navigateur, jamais l'attribut
 * `lang` de la page. Mesuré sur `/parametres/societe` et sur la photo
 * terrain (`components/interventions/photos-terrain.tsx`).
 *
 * ## Le VRAI champ reste, seul son rendu change
 *
 * `<input type="file">` garde son `name`, participe à la soumission du
 * formulaire comme n'importe quel champ natif, et continue de fonctionner
 * SANS JavaScript — seule sa présentation est remplacée par un `<label>`
 * (le bouton) et un `<span>` (le nom choisi). Il est rendu `sr-only`, jamais
 * `hidden` ni `display:none` : un `<label htmlFor>` déclenche un champ caché
 * de cette façon dans tous les navigateurs, et il reste atteignable par un
 * lecteur d'écran.
 *
 * ## Le nom affiché suit une RÉINITIALISATION NATIVE DU FORMULAIRE
 *
 * `formulaire.reset()` (photo terrain, après un envoi gardé en file) vide
 * l'`<input>` sans que React ne le sache : ce composant écoute l'évènement
 * natif `reset` du `<form>` ancêtre pour effacer le nom affiché au même
 * moment, plutôt que de laisser le texte affiché mentir sur l'état réel du
 * champ.
 */
export function ChampFichier({
  id,
  nom,
  accept,
  capture,
  required,
  onChange,
}: Readonly<{
  id?: string;
  nom: string;
  accept?: string;
  capture?: "user" | "environment";
  required?: boolean;
  onChange?: (evenement: React.ChangeEvent<HTMLInputElement>) => void;
}>) {
  const idGenere = useId();
  const idReel = id ?? idGenere;
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);

  useEffect(() => {
    const champ = inputRef.current?.form;
    if (champ === null || champ === undefined) {
      return;
    }
    const effacer = (): void => setNomFichier(null);
    champ.addEventListener("reset", effacer);
    return () => champ.removeEventListener("reset", effacer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={idReel}
        className="border-app-bord bg-app-surface hover:bg-app-surface-creuse inline-flex w-fit cursor-pointer items-center rounded-md border px-3 py-1.5 text-13 font-bold"
      >
        {t("ui.champ_fichier.choisir")}
      </label>
      <span className="text-app-encre-faible truncate text-13 font-bold">
        {nomFichier ?? t("ui.champ_fichier.aucun")}
      </span>
      <input
        ref={inputRef}
        id={idReel}
        type="file"
        name={nom}
        accept={accept}
        capture={capture}
        required={required}
        onChange={(evenement) => {
          setNomFichier(evenement.currentTarget.files?.[0]?.name ?? null);
          onChange?.(evenement);
        }}
        className="sr-only"
      />
    </div>
  );
}
