import {
  FONCTIONS_IDENTITE,
  ROW_SECURITY_ATTENDU,
  SEARCH_PATH_ATTENDU,
  type EtatFonctionIdentite,
} from "../../lib/db/exemption-fonctions-identite";

/**
 * LE CONTRÔLE DE VEILLE — décision d'Alexis du 10/11/2026.
 *
 * La mesure elle-même (`pg_proc`/`pg_roles`) vit dans `lib/db/`, partagée avec
 * `/api/sante` (une lecture, deux rendus — R3-01). Ce module ne porte que le
 * JUGEMENT, sur le modèle de `scripts/lib/privileges-consolidation.ts` : il
 * compare l'état observé à ce que D226 et D233 exigent, et nomme l'écart.
 *
 * Le risque qu'il rend bruyant : si une restauration ou une nouvelle branche
 * change le propriétaire de l'une des deux fonctions, `app_identite_exclusive_
 * a_la_societe` et `app_identite_interne_ailleurs` restent SÛRES — elles
 * LÈVENT plutôt que de filtrer en silence (c'est l'objet de leur `SET
 * row_security = off`) — mais chaque appel applicatif retombe alors sur un
 * refus, sans qu'aucune alarme ne le dise. Ce contrôle fait cette alarme.
 */

export function rapportExemptionFonctionsIdentite(
  etats: readonly EtatFonctionIdentite[],
): string {
  return [
    "Fonctions d'identité SECURITY DEFINER (D226, D233) — propriétaire et réglages observés :",
    ...FONCTIONS_IDENTITE.map((nom) => {
      const etat = etats.find((e) => e.fonction === nom);
      return etat === undefined
        ? `  ${nom.padEnd(40)} : INTROUVABLE`
        : `  ${nom.padEnd(40)} : exempté=${etat.exempte} réglages_surs=${etat.reglagesSurs}`;
    }),
    "",
  ].join("\n");
}

export function ecartsExemptionFonctionsIdentite(
  etats: readonly EtatFonctionIdentite[],
): string[] {
  const ecarts: string[] = [];

  for (const nom of FONCTIONS_IDENTITE) {
    const etat = etats.find((e) => e.fonction === nom);
    if (etat === undefined) {
      ecarts.push(
        `« ${nom} » est introuvable dans le schéma « public » : la migration ` +
          "qui la crée n'est pas jouée, ou son nom a changé. D226/D233 en " +
          "dépendent pour le contrôle d'identité qu'elle porte.",
      );
      continue;
    }
    if (!etat.exempte) {
      ecarts.push(
        `« ${nom} » appartient désormais à un propriétaire qui n'est ni ` +
          "BYPASSRLS ni superutilisateur. Décision d'Alexis du 10/11/2026 : " +
          "la fonction reste SÛRE (elle lève plutôt que de filtrer en " +
          "silence), mais chaque appel applicatif retombe maintenant sur un " +
          "refus, et rien ne le signalait avant ce contrôle.",
      );
    }
    if (!etat.reglagesSurs) {
      ecarts.push(
        `« ${nom} » n'a plus les réglages posés par sa migration : ` +
          `SECURITY DEFINER, search_path = « ${SEARCH_PATH_ATTENDU} », ` +
          `row_security = « ${ROW_SECURITY_ATTENDU} ». C'est précisément ce ` +
          "qui rend le refus fail-closed plutôt que silencieusement filtré.",
      );
    }
  }

  return ecarts;
}
