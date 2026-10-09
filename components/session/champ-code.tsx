"use client";

import { useState } from "react";

const NOMBRE_DE_CASES = 6;

/**
 * LE CODE À SIX CHIFFRES, SIX CASES VISUELLES SUR UN SEUL VRAI CHAMP
 * (D188, partie 6 ; M:5465).
 *
 * SIX `<span>` purement décoratifs (`aria-hidden`) affichent le texte déjà
 * saisi, chiffre par chiffre ; EN DESSOUS (superposé, `opacity-0`), l'unique
 * `<input name="code">` RÉEL reste un champ ordinaire — frappe, collage,
 * suppression, tabulation s'y comportent nativement, et le formulaire se
 * soumet SANS JavaScript si besoin (`value` contrôlé ne retire rien à un
 * navigateur qui n'exécute aucun script : l'attribut `value` posé au
 * rendu serveur reste un `<input>` ordinaire).
 *
 * **Jamais de second champ nommé `code`** dans CE groupe — la case de
 * secours, plus bas sur la page, porte le même nom dans un AUTRE
 * `<form>`, sans conflit.
 */
export function ChampCode({
  libelle,
}: Readonly<{
  libelle: string;
}>) {
  const [valeur, setValeur] = useState("");
  const chiffres = Array.from({ length: NOMBRE_DE_CASES }, (_, index) =>
    valeur.charAt(index),
  );

  return (
    <div className="relative">
      <div aria-hidden="true" className="flex gap-2">
        {chiffres.map((chiffre, index) => (
          <span
            key={index}
            className="border-input bg-background flex h-12 w-10 items-center justify-center rounded-md border text-lg font-bold"
          >
            {chiffre}
          </span>
        ))}
      </div>
      <input
        name="code"
        aria-label={libelle}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={NOMBRE_DE_CASES}
        required
        value={valeur}
        onChange={(evenement) =>
          setValeur(
            evenement.target.value.replace(/\D/g, "").slice(0, NOMBRE_DE_CASES),
          )
        }
        className="absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
