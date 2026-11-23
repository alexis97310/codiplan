import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerMajorationHorsOuverturePct } from "@/lib/societes/identite";
import { schemaMajorationHorsOuverturePct } from "@/lib/tarification/majoration";

/**
 * `POST /api/parametres/societe/majoration-hors-ouverture` — ENREGISTRE LE
 * POURCENTAGE DE MAJORATION HORS OUVERTURE (9L33-MAJORATION-REGLAGE-SOCIETE,
 * décisions d'Alexis du 10/11/2026 et du 23/11/2026 ; complète D269).
 *
 * Même modèle que `/api/parametres/societe/delai-relance-suite` : capacité
 * `parametrer_societe` vérifiée à la porte ET dans
 * `enregistrerMajorationHorsOuverturePct`, refus par motif nommé, jamais par
 * exception. Écran d'origine : `/parametres/societe`.
 *
 * **Aucun montant n'est recalculé ici** : seul le réglage change, et il ne
 * s'applique qu'aux clôtures SUIVANTES — une intervention déjà clôturée
 * garde sa `valorisation_figee` (D269/D272).
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

function versLecran(motif?: string): Response {
  const suffixe =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/societe${suffixe}` },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const brut = formulaire.get("majoration_hors_ouverture_pct");
  const texte = typeof brut === "string" ? brut : "";

  const analyse = schemaMajorationHorsOuverturePct.safeParse(texte);
  if (!analyse.success) {
    return versLecran("societe.majoration_refus_saisie");
  }

  const resultat = await enregistrerMajorationHorsOuverturePct(
    contexte,
    analyse.data,
  );
  return versLecran(resultat.ok ? undefined : resultat.motif);
}
