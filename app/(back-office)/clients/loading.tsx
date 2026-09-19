import { RepliDeChargement } from "@/components/ui/repli-de-chargement";

/**
 * LE REPLI DE `/clients` (AV-11).
 *
 * Posé À CÔTÉ de `page.tsx`, jamais au niveau de `(back-office)/layout.tsx` :
 * la barre de navigation reste rendue par la mise en page, au-dessus de
 * cette frontière, qui ne couvre donc que la liste — jamais l'application
 * entière (voir `components/ui/repli-de-chargement.tsx`).
 */
export default function Chargement() {
  return <RepliDeChargement />;
}
