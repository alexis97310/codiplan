import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  decrireConnexion,
  type DescriptionConnexion,
} from "./lib/decrire-connexion";

/**
 * ÉTAPE « Décrire les connexions (sans secret) » (workflow « DB migrate &
 * seed », juste avant « Contrôle de cloisonnement »).
 *
 * Les runs #80 et #82 (cible production) ont rougi sur « Can't reach database
 * server » au contrôle de cloisonnement, alors que la migration, juste avant,
 * avait joint la même base sans incident. Avant de supposer une différence
 * d'hôte, de rôle ou de point de mutualisation entre `MIGRATION_DATABASE_URL`
 * et `DATABASE_URL`, cette étape les NOMME — hôte, port, base, mutualisation,
 * région, noms des paramètres — sans jamais recopier ni l'utilisateur, ni le
 * mot de passe, ni la valeur d'un paramètre. Voir `scripts/lib/decrire-connexion.ts`.
 *
 * Purement lecture, et aucune connexion à la base : elle n'analyse que le
 * texte des deux URL.
 */

function ligne(nom: string, description: DescriptionConnexion): string {
  if (!description.lisible) {
    return `- ${nom} : URL illisible (vide, absente, ou non analysable).`;
  }
  const region =
    description.region !== null ? `, région \`${description.region}\`` : "";
  const parametres =
    description.parametres.length > 0
      ? description.parametres.join(", ")
      : "aucun";
  return (
    `- ${nom} : hôte \`${description.hote}\` ` +
    `(${description.mutualise ? "mutualisé" : "direct"}${region}), ` +
    `port \`${description.port || "(absent)"}\`, base \`${description.base}\`, ` +
    `paramètres : ${parametres}`
  );
}

function rapport(
  migration: DescriptionConnexion,
  applicative: DescriptionConnexion,
): string {
  const comparaison =
    migration.lisible && applicative.lisible
      ? `Même hôte : ${migration.hote === applicative.hote ? "oui" : "non"}.`
      : "Au moins une des deux URL est illisible : la comparaison d'hôte n'est pas faite.";

  return [
    "### Connexions décrites (sans secret)",
    "",
    ligne("Migration", migration),
    ligne("Applicative", applicative),
    "",
    comparaison,
    "",
  ].join("\n");
}

const invoqueeDirectement =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoqueeDirectement) {
  const migration = decrireConnexion(process.env.URL_MIGRATION);
  const applicative = decrireConnexion(process.env.URL_APPLICATIVE);
  const texte = rapport(migration, applicative);

  process.stdout.write(`${texte}\n`);

  const resume = process.env.GITHUB_STEP_SUMMARY;
  if (resume !== undefined && resume.trim().length > 0) {
    appendFileSync(resume, `${texte}\n`);
  }
}
