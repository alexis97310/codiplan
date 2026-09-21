import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerAgence } from "@/lib/agences/depot";
import { schemaCreationAgence } from "@/lib/agences/saisie";

import { champ } from "../../../interventions/actions";

/**
 * CRÉER UNE AGENCE ET SON CALENDRIER D'OUVERTURE (AGENCE-1).
 *
 * `parametrer_societe` est la capacité de
 * `app/api/parametres/plages/ajouter/route.ts` — le seul autre chemin
 * d'écriture du même domaine, et il n'y en a pas de seconde à inventer.
 *
 * **Le refus retourne sur le formulaire, pas sur la liste** : un refus qui
 * renvoie ailleurs fait perdre la saisie (même règle qu'à
 * `app/api/sites/creer/route.ts`). Le succès mène au réglage des horaires du
 * calendrier neuf : c'est l'écran qui dit qu'il est vide, et celui d'où
 * repartir pour l'ouvrir.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const versLeFormulaire = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/agences/nouvelle?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return versLeFormulaire("auth.refus");
  }

  const formulaire = await requete.formData();
  const fuseau = champ(formulaire, "fuseau_horaire");
  const saisie = schemaCreationAgence.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    territoire: champ(formulaire, "territoire") ?? "",
    // Le champ VIDE est une valeur pleine (D5) : « hérite du fuseau de la
    // société », distincte de « pas encore saisi ».
    fuseau_horaire: fuseau,
  });
  if (!saisie.success) {
    return versLeFormulaire("agence.refus.saisie");
  }

  const resultat = await creerAgence(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`agence.refus.${resultat.motif}`);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location:
        resultat.fiche.calendrier_id === null
          ? `/parametres/agences?motif=${encodeURIComponent("agence.creee")}`
          : `/parametres/agences/${resultat.fiche.calendrier_id}?motif=${encodeURIComponent("agence.creee")}`,
    },
  });
}
