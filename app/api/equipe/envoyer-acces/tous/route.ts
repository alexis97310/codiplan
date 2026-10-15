import {
  envoyerLienDAcces,
  etatsAccesDesTechniciens,
  RefusEnvoiAcces,
} from "@/lib/auth/acces-technicien";
import {
  envoyerLienDAccesBureau,
  etatsAccesDesComptes,
  listerComptesDeBureau,
} from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { listerLesTechniciens } from "@/lib/techniciens/depot";

import { versLEquipe } from "@/app/api/techniciens/saisie-recue";

/**
 * « TOUT ENVOYER » — envoie (ou réémet) le lien d'accès de CHAQUE personne
 * qui n'en a pas encore un actif (9EY-EQUIPE-ALERTE-TOUT-ENVOYER, point 1 ;
 * maquette `maquette-toutes-pages.html:4699-4703`).
 *
 * **LA POPULATION EST CALCULÉE ICI, JAMAIS REÇUE DU FORMULAIRE** — même
 * discipline que toute route de ce dossier : un formulaire qui transmettrait
 * sa propre liste pourrait viser n'importe quel identifiant, de n'importe
 * quelle société. Techniciens ACTIFS de la société active, et comptes de
 * bureau de la société active, dont l'accès n'est pas déjà « actif » — même
 * jugement que `affichesApresAcces` de `page.tsx` et que l'alerte qu'elle
 * affiche.
 *
 * **UN ÉCHEC N'ARRÊTE PAS LES AUTRES** — `envoyerLienDAcces`/
 * `envoyerLienDAccesBureau` ne lèvent `RefusEnvoiAcces` que si AUCUN jeton
 * n'a pu être émis (cas très rare, Better Auth muet) ; cette exception seule
 * est comptée comme un échec, jamais relancée — même raisonnement que la
 * création d'un technicien dont l'envoi échoue (solde 174).
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipe(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const depuisVueAOuvrir = formulaire.get("acces_a_ouvrir") !== null;

  const techniciensActifs = (await listerLesTechniciens(contexte)).filter(
    (technicien) => technicien.actif,
  );
  const comptesBureau = await listerComptesDeBureau(contexte);

  const etatsTechniciens = await etatsAccesDesTechniciens(
    contexte,
    techniciensActifs.map((technicien) => technicien.utilisateurId),
  );
  const etatsBureau = await etatsAccesDesComptes(
    contexte,
    comptesBureau.map((compte) => compte.utilisateurId),
  );

  const ciblesTechniciens = techniciensActifs.filter(
    (technicien) =>
      (etatsTechniciens.get(technicien.utilisateurId)?.etat ?? "aucun") !==
      "actif",
  );
  const ciblesBureau = comptesBureau.filter(
    (compte) =>
      (etatsBureau.get(compte.utilisateurId)?.etat ?? "aucun") !== "actif",
  );

  let partis = 0;
  let echecs = 0;

  for (const technicien of ciblesTechniciens) {
    try {
      const resultat = await envoyerLienDAcces(
        contexte,
        technicien.utilisateurId,
      );
      if (resultat.accepte && resultat.envoi.parti) {
        partis += 1;
      } else {
        echecs += 1;
      }
    } catch (erreur: unknown) {
      if (!(erreur instanceof RefusEnvoiAcces)) {
        throw erreur;
      }
      echecs += 1;
    }
  }

  for (const compte of ciblesBureau) {
    try {
      const resultat = await envoyerLienDAccesBureau(
        contexte,
        compte.utilisateurId,
      );
      if (resultat.accepte && resultat.envoi.parti) {
        partis += 1;
      } else {
        echecs += 1;
      }
    } catch (erreur: unknown) {
      if (!(erreur instanceof RefusEnvoiAcces)) {
        throw erreur;
      }
      echecs += 1;
    }
  }

  const suite = new URLSearchParams({
    motif: "equipe.acces.tous_envoyes",
    n: String(partis),
    echecs: String(echecs),
  });
  if (depuisVueAOuvrir) {
    suite.set("acces", "a-ouvrir");
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe?${suite.toString()}` },
  });
}
