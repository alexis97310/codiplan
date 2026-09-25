"use client";

import { useRouter } from "next/navigation";

/**
 * ── LA LIGNE ENTIÈRE OUVRE LA FICHE (88-REGISTRE-5, constat 16) ──────────
 *
 * *Mesuré le 25/09/2026 (audit d'ergonomie) sur `app/(back-office)/
 * interventions/page.tsx` : seule la référence — un lien de 40 px, coupé sur
 * deux lignes à 1280 px — ouvrait la fiche ; le reste de la ligne, 60 px de
 * haut, restait inerte.*
 *
 * **Le lien de la référence RESTE un `<a>` à part entière** — la seule
 * manière d'ouvrir la fiche au clavier ou depuis un lecteur d'écran, ce
 * qu'un `onClick` posé sur un `<tr>` ne sait faire ni l'un ni l'autre. Un
 * clic qui atteint CE lien (ou tout autre lien porté par la ligne) n'est
 * donc jamais reconduit vers `router.push` : la navigation native du lien
 * suffit déjà, et la doubler ferait deux navigations vers la même page.
 */
export function LigneCliquable({
  href,
  children,
}: Readonly<{
  readonly href: string;
  readonly children: React.ReactNode;
}>) {
  const router = useRouter();
  return (
    <tr
      onClick={(evenement: React.MouseEvent<HTMLTableRowElement>) => {
        const cible = evenement.target as HTMLElement;
        if (cible.closest("a") !== null) {
          return;
        }
        router.push(href);
      }}
      className="hover:bg-app-surface-creuse cursor-pointer"
    >
      {children}
    </tr>
  );
}
