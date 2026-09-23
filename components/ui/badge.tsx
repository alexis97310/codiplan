import { cn } from "@/lib/utils";

/**
 * LA PASTILLE — `.b` de la maquette (AT-04).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` :
 * `.b{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;
 * font-weight:700;white-space:nowrap}`. Un gardien confronte cette règle au
 * texte de ce fichier (`tests/unit/ui/composants-maquette.test.ts`).
 *
 * ## UN TON, JAMAIS UNE COULEUR
 *
 * La maquette décline `.b` en huit couples fond/encre — `.b-p1`…`.b-p4`,
 * `.b-ok`, `.b-att`, `.b-cours`, `.b-plan` — tous bâtis sur les CINQ FAMILLES
 * de `lib/theme/apparence.ts`. Cette pastille ne réécrit aucune de ces huit
 * classes : elle prend le TON (`bleu`, `rouge`, `vert`, `orange`, `gris`) et
 * laisse l'appelant décider ce qu'il signifie — une priorité, un statut, un
 * régime. *Écrire ici une neuvième déclinaison par sens serait la même faute
 * que recopier une couleur* (§9, 01/09) : le jour où une neuvième famille de
 * sens apparaîtra, elle choisira parmi les cinq tons déjà là.
 *
 * **Elle ne remplace pas `CLASSES_STATUT`** (`lib/theme/statuts.ts`), qui
 * gouverne les huit statuts d'intervention de l'annexe D et leur bloc `.ev` en
 * plus de leur pastille : deux écrans qui affichent déjà ce couple continuent
 * de le lire là où il est décidé, sans seconde lecture du même critère.
 */
export type TonBadge = "bleu" | "rouge" | "vert" | "orange" | "gris";

/**
 * Exportée pour `CarteEntite` (PASTILLES-1) : une pastille de compteur peint
 * un ton dans une géométrie DIFFÉRENTE de `.b` (chiffre agrandi, forme
 * `rounded-full`) — recopier ces cinq couples aurait été la même faute que
 * réécrire une couleur (§9, 01/09).
 */
export const CLASSES_TON: Record<TonBadge, string> = {
  bleu: "bg-app-bleu-fond text-app-bleu-encre",
  rouge: "bg-app-rouge-fond text-app-rouge-encre",
  vert: "bg-app-vert-fond text-app-vert-encre",
  orange: "bg-app-orange-fond text-app-orange-encre",
  gris: "bg-app-gris-fond text-app-gris-encre",
};

export function Badge({
  ton,
  children,
}: Readonly<{
  ton: TonBadge;
  children: React.ReactNode;
}>) {
  return (
    <span
      className={cn(
        "inline-block rounded-[20px] px-[8px] py-[2px] text-[11px] font-bold whitespace-nowrap",
        CLASSES_TON[ton],
      )}
    >
      {children}
    </span>
  );
}
