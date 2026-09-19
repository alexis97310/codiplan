import { RepliDeChargement } from "@/components/ui/repli-de-chargement";

/**
 * LE REPLI DE `/tableau-de-bord` (AV-11).
 *
 * L'écran agrège plusieurs lectures indépendantes (absences, demandes en
 * attente, planning du jour, VGP à prévoir) : un délai y est réel, pas
 * hypothétique. Posé À CÔTÉ de `page.tsx`, jamais au niveau de
 * `(back-office)/layout.tsx` : la barre de navigation reste rendue par la
 * mise en page, au-dessus de cette frontière, qui ne couvre donc que le
 * contenu de CET écran — jamais l'application entière (voir
 * `components/ui/repli-de-chargement.tsx`).
 */
export default function Chargement() {
  return <RepliDeChargement />;
}
