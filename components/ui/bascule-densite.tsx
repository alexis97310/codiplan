import Link from "next/link";

import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * LA DENSITÉ D'AFFICHAGE — « Confort » / « Compact » (TP-UX3-1-REGISTRE-1,
 * §5.3 de la spécification du 28/09/2026) : deux liens, jamais un bouton qui
 * écrirait un état côté client — l'état vit dans l'URL (`densite=compact`),
 * comme tout le reste de ce registre (AT-07).
 *
 * `hrefConfort`/`hrefCompact` sont composés par l'appelant
 * (`app/(back-office)/interventions/presentation.ts`) : ils portent les
 * MÊMES autres paramètres actifs (onglet, filtres, page) — changer de
 * densité ne doit perdre ni l'un ni l'autre.
 */
export function BasculeDensite({
  hrefConfort,
  hrefCompact,
  actif,
}: Readonly<{
  hrefConfort: string;
  hrefCompact: string;
  actif: "confort" | "compact";
}>) {
  return (
    <nav
      aria-label={t("densite.aria")}
      className="flex items-center gap-1 text-13 font-bold"
    >
      <LienDensite href={hrefConfort} actif={actif === "confort"}>
        {t("densite.confort")}
      </LienDensite>
      <LienDensite href={hrefCompact} actif={actif === "compact"}>
        {t("densite.compact")}
      </LienDensite>
    </nav>
  );
}

function LienDensite({
  href,
  actif,
  children,
}: Readonly<{
  href: string;
  actif: boolean;
  children: React.ReactNode;
}>) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1",
        actif
          ? "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre"
          : "border-app-bord bg-app-surface",
      )}
    >
      {children}
    </Link>
  );
}
