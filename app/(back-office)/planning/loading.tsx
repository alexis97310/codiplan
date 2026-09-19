import { RepliDeChargement } from "@/components/ui/repli-de-chargement";

/**
 * LE REPLI DE `/planning` (AV-11).
 *
 * C'était l'un des DEUX écrans mesurés bloqués en production par l'ancien
 * `app/loading.tsx` (17/09/2026, avec `/tableau-de-bord`) — parce que cette
 * frontière-là couvrait l'application entière, barre comprise. Celle-ci est
 * posée À CÔTÉ de `page.tsx`, sous `(back-office)/layout.tsx` : la barre
 * reste rendue par la mise en page, au-dessus de cette frontière, qui ne
 * couvre donc que la grille — jamais la coque (voir
 * `components/ui/repli-de-chargement.tsx`).
 */
export default function Chargement() {
  return <RepliDeChargement />;
}
