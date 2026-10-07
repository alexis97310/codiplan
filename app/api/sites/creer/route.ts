import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { creerSite } from "@/lib/sites/depot";
import { schemaCreationSite } from "@/lib/sites/saisie";

import { champ } from "../../interventions/actions";
import { versLeFormulaire } from "./formulaire";

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
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLeFormulaire(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  // CE QUI AVAIT ÉTÉ SOUMIS, capturé AVANT toute validation
  // (9BR-TP-A4b-MESSAGES, CS42).
  const champsResoumis = {
    client: champ(formulaire, "client_id") ?? undefined,
    agence_id: champ(formulaire, "agence_id") ?? undefined,
    libelle: champ(formulaire, "libelle") ?? undefined,
    commune: champ(formulaire, "commune") ?? undefined,
    zone_geo: champ(formulaire, "zone_geo") ?? undefined,
    temps_trajet_min: champ(formulaire, "temps_trajet_min") ?? undefined,
    // LA SAISIE GARDÉE PORTE AUSSI ADRESSE ET CONSIGNES
    // (9EK-TP-UX5-2-CREATIONS-1) — un refus (un libellé vidé, par exemple)
    // ne doit pas faire perdre ce qu'on venait d'écrire.
    adresse: champ(formulaire, "adresse") ?? undefined,
    consignes_acces: champ(formulaire, "consignes_acces") ?? undefined,
  };
  const trajet = champ(formulaire, "temps_trajet_min");
  const adresseLigne = champ(formulaire, "adresse");
  const saisie = schemaCreationSite.safeParse({
    client_id: champ(formulaire, "client_id") ?? "",
    agence_id: champ(formulaire, "agence_id") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    commune: champ(formulaire, "commune"),
    zone_geo: champ(formulaire, "zone_geo"),
    // Le champ VIDE est une valeur pleine : « estimation par zone » (D23).
    temps_trajet_min: trajet === null ? null : Number(trajet),
    // QT-18 (a) — une ligne libre, EN PLUS de la commune (`formatAdresseSite`).
    adresse: adresseLigne === null ? null : { rue: adresseLigne },
    consignes_acces: champ(formulaire, "consignes_acces"),
    // Une case DÉCOCHÉE est absente de `FormData` : `getAll` rend alors un
    // tableau vide, et `includes("1")` vaut `false` — le même contrat que la
    // modification (`app/api/sites/[id]/modifier/route.ts`).
    sous_contrat: formulaire.getAll("sous_contrat").includes("1"),
  });
  if (!saisie.success) {
    // LE CLIENT TAPÉ SANS ÊTRE CHOISI DANS LE SÉLECTEUR (CS40) — le texte
    // libre d'une recherche qui n'a pas été transformée en sélection
    // n'est jamais un UUID, et c'est ALORS que `client_id` échoue au
    // schéma. « Vérifiez les champs numériques » serait vrai et inutile
    // (même raison que `surLeType`/`surLaDescription` de
    // `app/api/interventions/creer/route.ts`) : ce refus nomme le geste
    // qui manque — choisir dans la liste — plutôt que de renvoyer au refus
    // générique de D56.
    const surLeClient = saisie.error.issues.some((probleme) =>
      probleme.path.includes("client_id"),
    );
    return versLeFormulaire(
      surLeClient ? "site.refus.client_non_selectionne" : "site.refus.saisie",
      champsResoumis,
    );
  }

  const resultat = await creerSite(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`site.refus.${resultat.motif}`, champsResoumis);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/sites/${resultat.fiche.id}?motif=${encodeURIComponent("sites.cree")}`,
    },
  });
}
