import { copierLienDAcces } from "@/lib/auth/acces-technicien";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { reponseLienCopie } from "@/lib/auth/reponse-lien-copie";

/**
 * `POST /api/equipe/<id>/copier-lien` — COPIE (SANS L'ENVOYER) LE LIEN DE
 * PREMIER ACCÈS D'UN TECHNICIEN (9I6B-LIEN-ACCES-A-COPIER, D170).
 *
 * Même garde que `app/api/equipe/[id]/envoyer-acces/route.ts` —
 * `administrer_utilisateurs`, L'identifiant vient du chemin, jamais du
 * corps. **Rend l'URL en JSON plutôt que de rediriger** : c'est l'écran,
 * côté NAVIGATEUR, qui la pose dans le presse-papiers — elle n'est jamais
 * écrite ici dans une trace, un journal ou une page (`copierLienDAcces`,
 * `lib/auth/acces-technicien.ts`, trace sans le jeton).
 *
 * **`Cache-Control: no-store` sur toute réponse** (B4, relecture de 9I6B) —
 * même motif que `/api/sante` : l'URL qu'elle porte est un secret au porteur,
 * jamais une valeur qu'un cache intermédiaire ou le navigateur devrait
 * pouvoir rejouer.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return reponseLienCopie({ erreur: "acces_refuse" }, { status: 403 });
  }
  const { id } = await params;
  const resultat = await copierLienDAcces(contexte, id);
  if (!resultat.accepte) {
    return reponseLienCopie({ erreur: resultat.motif });
  }
  return reponseLienCopie({ url: resultat.url });
}
