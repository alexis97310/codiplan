import { creerSite } from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";

import { champ, contexteCourant } from "../../interventions/actions";

/**
 * CRÉER UN LIEU D'INTERVENTION (L3-16, D75).
 *
 * **Le refus retourne sur le formulaire, pas sur la liste** : *un refus qui
 * renvoie ailleurs fait perdre la saisie*, et c'est la façon la plus sûre
 * d'apprendre à ne plus faire confiance à l'écran.
 *
 * Le succès, lui, mène à la FICHE créée : c'est là qu'on vérifie ce qu'on vient
 * d'écrire, et c'est de là qu'on repart.
 */
export async function POST(requete: Request): Promise<Response> {
  const versLeFormulaire = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: { Location: `/sites/nouveau?motif=${encodeURIComponent(cle)}` },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeFormulaire("auth.refus");
  }

  const formulaire = await requete.formData();
  const trajet = champ(formulaire, "temps_trajet_min");
  const saisie = schemaCreationSite.safeParse({
    client_id: champ(formulaire, "client_id") ?? "",
    agence_id: champ(formulaire, "agence_id") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    commune: champ(formulaire, "commune"),
    zone_geo: champ(formulaire, "zone_geo"),
    // Le champ VIDE est une valeur pleine : « estimation par zone » (D23).
    temps_trajet_min: trajet === null ? null : Number(trajet),
  });
  if (!saisie.success) {
    return versLeFormulaire("site.refus.saisie");
  }

  const resultat = await creerSite(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`site.refus.${resultat.motif}`);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/sites/${resultat.fiche.id}?motif=${encodeURIComponent("sites.cree")}`,
    },
  });
}
