import { listerComptesDeBureau } from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerSessionActive, motifDuRefus } from "@/lib/auth/porte";
import {
  peutReinitialiserSecondFacteur,
  reinitialiserSecondFacteur,
} from "@/lib/auth/reinitialisation";

import { versLEquipeBureau } from "../../saisie-recue";

/**
 * RÉINITIALISER LE SECOND FACTEUR D'UN COMPTE DE BUREAU (téléphone perdu,
 * 9IA, décision d'Alexis du 28/10/2026, réponse « A et B »).
 *
 * **Pas `exigerCapacite("administrer_utilisateurs")`** : cette capacité vaut
 * pour admin_societe ET direction (D199), alors que la décision n'en nomme
 * que DEUX, et différents — admin_societe (B, jamais lui-même) et
 * admin_plateforme (A). `exigerSessionActive` ne vérifie qu'une société et un
 * rôle actifs ; `peutReinitialiserSecondFacteur` juge la portée, comme le
 * veut la doctrine de `lib/auth/porte.ts` pour les gestes à portée réduite.
 *
 * A n'atteint jamais cette route : `admin_plateforme` n'a aucune société
 * active (voir `docs/propositions/9IA-REINITIALISER-SECOND-FACTEUR/
 * mesure.md`), et `exigerSessionActive` refuse donc toujours pour lui. Cette
 * route ne sert donc que B — l'acte lui-même, dans `lib/auth/reinitialisation.ts`,
 * reste prêt pour A dès qu'un chemin d'écran existera.
 *
 * Le refus est le MÊME, nommément, qu'un identifiant inconnu (D50) : rôle
 * sans droit, cible hors société, propre compte, ou compte sans second
 * facteur à réinitialiser rendent tous `equipe.bureau.refus.introuvable`.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const contexte = await exigerSessionActive();
  if (contexte === null) {
    return versLEquipeBureau(await motifDuRefus());
  }
  const { id } = await params;

  const comptes = await listerComptesDeBureau(contexte);
  const cible = comptes.find((compte) => compte.utilisateurId === id);
  if (
    cible === undefined ||
    !cible.mfaActif ||
    !peutReinitialiserSecondFacteur(contexte.role, contexte.utilisateurId, id)
  ) {
    return versLEquipeBureau("equipe.bureau.refus.introuvable");
  }

  await reinitialiserSecondFacteur({
    societeId: contexte.societeId,
    role: contexte.role,
    auteurId: contexte.utilisateurId,
    sujetId: id,
  });

  return versLEquipeBureau("equipe.bureau.second_facteur.reinitialise");
}
