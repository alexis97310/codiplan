import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * L'échelle typographique maison (`--text-12` … `--text-28`, `app/globals.css`)
 * crée des classes `text-12` … `text-28` que tailwind-merge, sans cette
 * configuration, range dans le groupe couleur (`text-{couleur}`, qui accepte
 * toute valeur) au lieu du groupe taille de police — une classe de couleur
 * passée avant `text-12` dans un même `cn(...)` était alors retirée à tort.
 */
const twMergeConfigure = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["12", "13", "14", "15", "16", "18", "24", "28"] }],
    },
  },
});

/** Fusionne des classes Tailwind — point d'entrée attendu par shadcn/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMergeConfigure(clsx(inputs));
}
