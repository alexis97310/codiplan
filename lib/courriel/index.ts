import { configurationCourriel } from "./configuration";
import type { Courriel, Envoi } from "./message";

export {
  configurationCourriel,
  VARIABLE_CLE,
  VARIABLE_EXPEDITEUR,
  type Configuration,
} from "./configuration";
export {
  estAdressable,
  type Courriel,
  type Envoi,
  type Expediteur,
} from "./message";
export { NOM_RESEND } from "./resend";

/**
 * ENVOYER — le seul appel que le reste du produit connaît.
 *
 * Il ne lève jamais. Un canal non configuré, un prestataire muet, une adresse
 * inadressable : tous rendent `parti: false` avec leur motif, et **le motif est
 * fait pour être montré à quelqu'un**, pas pour être journalisé.
 *
 * *Pourquoi ne pas lever :* un envoi est presque toujours l'accessoire d'un
 * geste qui, lui, a réussi — un compte créé, un lien engendré. Lever ferait
 * remonter l'échec du canal jusqu'à annuler le geste, ou obligerait chaque
 * appelant à un `try` qu'il finirait par écrire vide. **La somme force à
 * regarder sans forcer à défaire.**
 */
export async function envoyerCourriel(
  courriel: Courriel,
  environnement: Record<string, string | undefined> = process.env,
): Promise<Envoi> {
  const configuration = configurationCourriel(environnement);
  if (!configuration.configure) {
    return { parti: false, motif: configuration.manque };
  }
  return configuration.expediteur.envoyer(courriel);
}
