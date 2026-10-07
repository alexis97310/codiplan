import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * LES CARTES SOUS 900 PX (TP-UX3-1-REGISTRE-2, PR-10 de la spécification
 * du 28/09/2026 §2 : « tableaux en cartes sous 900 px »).
 *
 * **Choix du pilote C5 (07/10/2026) : une carte IDENTIQUE pour tous les
 * onglets** — celle de la maquette (`ivCard`,
 * `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html:2740`),
 * SANS action ni case : la sélection multiple et les actions de ligne
 * restent au bureau seulement (≥ 901 px, `components/ui/
 * barre-selection.tsx`). Une carte est donc un simple lien plein vers la
 * fiche — jamais une seconde navigation ajoutée par-dessus, comme
 * `LigneCliquable` le fait déjà pour le tableau.
 *
 * Même convention de seuil que le planning (`max-[900px]:`/`min-[901px]:`,
 * D172, `app/(back-office)/planning/page.tsx:1249`) : le `<Tableau>` du
 * registre se masque sous 900 px (`max-[900px]:hidden`, posé par
 * l'appelant), cette liste se masque au-dessus (`min-[901px]:hidden`, posé
 * ici).
 */
export function ListeCartes({
  children,
  libelle,
}: Readonly<{
  children: React.ReactNode;
  libelle?: string;
}>) {
  return (
    <ul aria-label={libelle} className="min-[901px]:hidden flex flex-col gap-2">
      {children}
    </ul>
  );
}

/** Une carte — tout son contenu est un seul lien plein vers la fiche. */
export function Carte({
  href,
  children,
  className,
}: Readonly<{
  href: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "border-app-bord bg-app-surface flex flex-col gap-1.5 rounded-lg border p-3",
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}
