import type { ReactNode } from "react";

import { Icone, type NomIcone } from "@/components/ui/icone";
import { CLASSES_TON, type TonMessage } from "@/lib/theme/statuts";
import { cn } from "@/lib/utils";

/**
 * LE MESSAGE — `.msg` de la maquette du 28/09 (`alertBox()`, :1836-1839,
 * :335-343), pour un bandeau de compte rendu (succès, avertissement, refus).
 *
 * ## Les valeurs, lues et non approchées
 *
 * `.msg{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;
 * border-radius:12px;border:1px solid;font-size:var(--fs-md);line-height:
 * 1.45;margin-bottom:16px}` (:336) — rayon 12 px est `--radius-md` (D124),
 * `--fs-md` vaut 14 px (:37). `.msg b{display:block}` (:337) : le titre est
 * seul sur sa ligne. `.msg .alert-act{margin-left:auto;white-space:nowrap}`
 * (:341) : l'action, à droite.
 *
 * **Les couleurs viennent de `CLASSES_TON`, jamais des hexadécimaux de
 * `.msg.info`/`.msg.warn`** (:339-340, `#eef7ff`/`#fff7e5`) — ce fichier
 * n'a que trois tons (`TonMessage`, `lib/theme/statuts.ts`), pas quatre : la
 * maquette porte un ton « information » que ce composant n'a pas (voir la
 * note de `TonMessage`). `.msg.danger`/`.msg.ok` (:338, :342), eux, lisent
 * déjà `--red-2`/`--red-line`/`--red-ink` et `--green-2`/`--green-line`/
 * `--green-ink` — les mêmes familles que `CLASSES_TON`.
 *
 * ## L'icône ET LE RÔLE ARIA suivent le TON, jamais un second choix
 *
 * `alertBox()` associe une icône par ton — `ok`→`check-circle`,
 * `warn`→`alert`, `danger`→`alert-circle` (:1837) — et un rôle ARIA :
 * `role="alert"` pour `danger` SEUL, `role="status"` pour les deux autres
 * (:1838). Un refus interrompt une lecteur d'écran ; un succès ou un
 * avertissement l'informe sans l'interrompre.
 */
const ICONE_PAR_TON: Record<TonMessage, NomIcone> = {
  succes: "check-circle",
  avertissement: "alert",
  refus: "alert-circle",
};

export function Message({
  ton,
  titre,
  action,
  children,
}: Readonly<{
  ton: TonMessage;
  titre: string;
  action?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <div
      role={ton === "refus" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-[10px] rounded-md border px-[14px] py-[12px] text-14 leading-[1.45]",
        CLASSES_TON[ton],
      )}
    >
      <Icone nom={ICONE_PAR_TON[ton]} className="mt-[1px]" />
      <div className="flex-1">
        <b className="block">{titre}</b>
        {children}
      </div>
      {action === undefined ? null : (
        <div className="ml-auto whitespace-nowrap">{action}</div>
      )}
    </div>
  );
}
