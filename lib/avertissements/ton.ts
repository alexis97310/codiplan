import type { CleTraduction } from "@/lib/i18n/fr";
import { type TonMessage } from "@/lib/theme/statuts";

/**
 * LE TON D'UN AVERTISSEMENT DE PLANIFICATION (GR17-M13, audit GR du
 * 26/09/2026, constat M13) — TOUS orange jusqu'ici, y compris les trois
 * confirmations « … a été prévenu par courriel », qui n'annoncent aucun
 * problème.
 *
 * Une confirmation « parti » se distingue d'un échec par un seul trait :
 * la clé se termine par `_parti` sans être un `_non_parti`. Les cinq autres
 * clés du compte-rendu (`_non_parti`, `_sans_destinataire`, `habilitation`)
 * restent au ton `avertissement` — elles disent toutes qu'une chose ne s'est
 * PAS faite comme prévu, même si la planification, elle, a bien eu lieu.
 */
export function tonDeLAvertissement(cle: CleTraduction): TonMessage {
  return cle.endsWith("_parti") && !cle.endsWith("_non_parti")
    ? "succes"
    : "avertissement";
}
