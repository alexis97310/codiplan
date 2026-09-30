import type { ReactNode } from "react";

import { CLASSES_TON, type TonMessage } from "@/lib/theme/statuts";

/**
 * LES ONZE CLÉS DE RÉUSSITE (CS17, PA-05, 9BR-TP-A4b-MESSAGES) — une liste
 * EXPLICITE, jamais un jugement par sous-chaîne. `tonDuMotif`
 * (`app/(back-office)/imports/types.ts`) déduit « refus » de la présence du
 * mot dans la clé : toute clé sans ce mot — un avertissement, `auth.refus`
 * lui-même une fois retiré de son domaine — sortirait verte à tort. Une
 * future clé de réussite doit être ajoutée ici, sous peine de sortir rouge.
 */
const CLES_REUSSITE: ReadonlySet<string> = new Set([
  "clients.cree",
  "clients.modifie",
  "contacts.cree",
  "contacts.modifie",
  "sites.cree",
  "sites.modifie",
  "agence.creee",
  "agence.modifiee",
  "equipe.info.rattache",
  "machine.creee",
  "machine.modifiee",
]);

export function tonDuMotifDeFiche(cle: string): TonMessage {
  return CLES_REUSSITE.has(cle) ? "succes" : "refus";
}

/**
 * LE BANDEAU DE RETOUR D'UNE FICHE — succès en vert, refus en rouge (CS17,
 * PA-05). Mêmes marges que le bandeau rouge qu'il remplace ; le TEXTE reste à
 * la charge de l'appelant, car un motif comme `sites.cree` ne se traduit pas
 * directement (le mot imposé ne s'écrit pas au dictionnaire, D5/D47).
 */
export function BandeauMotif({
  motif,
  children,
}: Readonly<{ motif: string; children: ReactNode }>) {
  const classes = CLASSES_TON[tonDuMotifDeFiche(motif)];
  return (
    <p
      role="status"
      data-motif={motif}
      className={`${classes} rounded-md border px-3.5 py-2.5 text-13 font-bold`}
    >
      {children}
    </p>
  );
}
