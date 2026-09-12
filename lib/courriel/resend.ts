import {
  estAdressable,
  type Courriel,
  type Envoi,
  type Expediteur,
} from "./message";

/**
 * LE TRANSPORT — trente lignes de `fetch`, pas deux cents kilo-octets.
 *
 * Le §2 du `CLAUDE.md` impose Resend, et son interface d'envoi est **un `POST`
 * en HTTPS avec trois champs**. Installer le paquet officiel aurait ajouté une
 * dépendance pour composer une requête que `fetch` compose déjà : *« Ajouter
 * une dépendance est une décision, pas un réflexe. En cas de doute, écrire les
 * 30 lignes plutôt qu'ajouter 200 Ko. »*
 *
 * **Ce fichier est le SEUL endroit du dépôt qui connaisse un prestataire.** Le
 * jour où l'on en change, c'est ce fichier qu'on remplace, et rien d'autre —
 * c'est ce que l'interface étroite achète.
 *
 * ## LES DEUX SILENCES QU'IL REFUSE
 *
 * **Un refus du prestataire n'est pas une exception qu'on laisse remonter**, et
 * ce n'est pas non plus un succès : c'est un `Envoi` qui dit `parti: false`
 * avec son motif. Un appelant ne peut pas l'ignorer par distraction, le type
 * étant une somme.
 *
 * **Et une réponse illisible n'est pas un envoi réussi.** Un `2xx` dont le corps
 * ne porte aucune référence signifie qu'on ne sait pas ce qui s'est passé, et
 * *« je ne sais pas » et « c'est parti » ne se corrigent pas au même endroit*.
 */

export const NOM_RESEND = "Resend";

const POINT_DENVOI = "https://api.resend.com/emails";

/**
 * Le délai au-delà duquel on cesse d'attendre.
 *
 * **Un envoi qui pend indéfiniment bloque le geste qui l'a demandé**, et ce
 * geste est parfois un script d'amorçage joué par quelqu'un qui attend devant
 * son écran. Dix secondes est large pour un appel d'API et court pour une
 * attente humaine. *Ce n'est pas une valeur métier — aucun chapitre 10 ne la
 * fixe — c'est une borne d'infrastructure, écrite ici pour être révisée en
 * connaissance de cause plutôt que devinée* (la règle du 23/08).
 */
export const DELAI_ENVOI_MS = 10_000;

/** L'expéditeur, fermé sur sa clé et son adresse — qu'il ne rend jamais. */
export function expediteurResend(cle: string, adresse: string): Expediteur {
  return {
    nom: NOM_RESEND,
    async envoyer(courriel: Courriel): Promise<Envoi> {
      if (!estAdressable(courriel.destinataire)) {
        return {
          parti: false,
          motif:
            "L'adresse du destinataire n'est pas adressable. RIEN N'A ÉTÉ " +
            "ENVOYÉ.",
        };
      }

      let reponse: Response;
      try {
        reponse = await fetch(POINT_DENVOI, {
          method: "POST",
          headers: {
            // La clé ne sort JAMAIS d'ici : ni dans un message de refus, ni
            // dans une trace. Un secret imprimé dans un journal d'exécution
            // d'un dépôt PUBLIC est un secret perdu (I9, D50).
            Authorization: `Bearer ${cle}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: adresse,
            to: [courriel.destinataire],
            subject: courriel.sujet,
            text: courriel.texte,
          }),
          signal: AbortSignal.timeout(DELAI_ENVOI_MS),
        });
      } catch (erreur: unknown) {
        const cause = erreur instanceof Error ? erreur.message : String(erreur);
        return {
          parti: false,
          motif: `${NOM_RESEND} n'a pas répondu (${cause}). RIEN N'A ÉTÉ ENVOYÉ.`,
        };
      }

      if (!reponse.ok) {
        // LE CORPS DU REFUS N'EST PAS RECOPIÉ. Un message de prestataire peut
        // porter l'adresse d'expédition, un identifiant de compte, un
        // fragment de clé — et il finirait dans le résumé d'une exécution
        // publique. Le CODE suffit à savoir où chercher (D50).
        return {
          parti: false,
          motif:
            `${NOM_RESEND} a refusé l'envoi (code ${reponse.status}). ` +
            "Vérifier la clé et l'adresse d'expédition : une adresse dont le " +
            "domaine n'est pas vérifié chez le prestataire est le refus le " +
            "plus fréquent. RIEN N'A ÉTÉ ENVOYÉ.",
        };
      }

      const corps: unknown = await reponse.json().catch(() => null);
      const reference =
        typeof corps === "object" && corps !== null && "id" in corps
          ? String((corps as { id: unknown }).id)
          : "";

      if (reference.length === 0) {
        return {
          parti: false,
          motif:
            `${NOM_RESEND} a répondu ${reponse.status} sans référence d'envoi. ` +
            "On ne sait donc pas si le message est parti — et « je ne sais " +
            "pas » ne se corrige pas comme « c'est parti ».",
        };
      }

      return { parti: true, reference };
    },
  };
}
