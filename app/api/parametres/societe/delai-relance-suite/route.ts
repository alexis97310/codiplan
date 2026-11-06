import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerDelaiRelanceSuite } from "@/lib/societes/identite";

/**
 * `POST /api/parametres/societe/delai-relance-suite` — ENREGISTRE LE DÉLAI DE
 * RELANCE DES SUITES À DONNER (FLX-2/FLX-3, 9J19-SUITE-A-DONNER-
 * NOTIFICATIONS).
 *
 * Même modèle que `/api/parametres/societe/afficher-montants` : capacité
 * `parametrer_societe` vérifiée à la porte ET dans
 * `enregistrerDelaiRelanceSuite`, refus par motif nommé, jamais par
 * exception. Écran d'origine : `/parametres/societe`.
 *
 * **Champ VIDE = `NULL`, jamais zéro** : un délai de zéro jour relancerait
 * au moment même de la qualification, ce que personne n'a demandé. Vider le
 * champ désactive les deux relances (CLAUDE.md §8 — aucune valeur par
 * défaut), un entier strictement positif les active.
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

/**
 * Bornes de SAISIE, pas une règle métier : `> 0` suit la contrainte en base
 * (`societe_delai_relance_suite_jours_positif`) ; `<= 365` n'est qu'un garde-
 * fou de formulaire contre une faute de frappe (« 3650 » pour « 365 »),
 * jamais une limite que le cahier des charges aurait fixée.
 */
const schemaDelai = z.coerce.number().int().min(1).max(365);

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const brut = formulaire.get("delai_relance_suite_jours");
  const texte = typeof brut === "string" ? brut.trim() : "";

  if (texte === "") {
    const resultat = await enregistrerDelaiRelanceSuite(contexte, null);
    return versLecran(resultat.ok ? undefined : resultat.motif);
  }

  const analyse = schemaDelai.safeParse(texte);
  if (!analyse.success) {
    return versLecran("societe.delai_relance_refus_saisie");
  }

  const resultat = await enregistrerDelaiRelanceSuite(contexte, analyse.data);
  return versLecran(resultat.ok ? undefined : resultat.motif);
}
