import { Message } from "@/components/ui/message";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { type TonMessage } from "@/lib/theme/statuts";

/**
 * LE BANDEAU DES ÉTAPES SANS SESSION (D188, partie 5) — `components/ui/
 * message.tsx`, jamais une seconde forme : les quatre motifs qui arrivent
 * sur `/connexion` (`auth.refus`, `auth.indisponible`, `premier_acces.
 * abouti`, `connexion.apres_enrolement`) gardent leur texte d'aujourd'hui
 * (`t(motif)`) — seul le TON change selon le motif, décidé ICI, dans la
 * page qui l'affiche, jamais dans une route (inchangées).
 *
 * **Tout motif absent de la liste de succès retombe sur le ton « refus »**
 * — jamais une exception : un paramètre d'URL forgé (L1-02f) ne doit
 * jamais faire planter l'écran, seulement afficher un ton prudent.
 */
const MOTIFS_SUCCES: ReadonlySet<string> = new Set([
  "premier_acces.abouti",
  "connexion.apres_enrolement",
]);

export function tonDuMotifDAcces(motif: string): TonMessage {
  return MOTIFS_SUCCES.has(motif) ? "succes" : "refus";
}

export function MessageAcces({ motif }: Readonly<{ motif?: string }>) {
  if (motif === undefined || !estCleTraduction(motif)) {
    return null;
  }
  return <Message ton={tonDuMotifDAcces(motif)} titre={t(motif)} />;
}
