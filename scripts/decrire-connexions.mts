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
 * de rôle ou de point de mutualisation entre `MIGRATION_DATABASE_URL` et
 * `DATABASE_URL`, cette étape compare les deux — mutualisation, région,
 * présence d'un port, nombre de paramètres, et si les deux hôtes sont LES
 * MÊMES (comparaison interne, jamais imprimée en clair) — sans jamais
 * recopier l'utilisateur, le mot de passe, la valeur d'un paramètre, ni,
 * depuis 9L22-CI-DURCIE, l'hôte ou le nom de la base eux-mêmes. Voir
 * `scripts/lib/decrire-connexion.ts`.
 *
 * Purement lecture, et aucune connexion à la base : elle n'analyse que le
 * texte des deux URL.
 *
 * ── CE QUE LE RAPPORT N'IMPRIME PLUS (9L22-CI-DURCIE, décision d'Alexis du
 *    10/11/2026) ──────────────────────────────────────────────────────────
 *
 * Ce dépôt est PUBLIC, et ce rapport entre dans le journal d'exécution — lu
 * à chaque migration, y compris sur la cible « production ». Il imprimait
 * l'HÔTE et la BASE de chaque connexion : ni l'un ni l'autre n'est un secret
 * au sens d'un mot de passe, mais les deux identifient l'infrastructure
 * hébergée, et un journal public n'a aucune raison de les porter.
 * `decrireConnexion` continue de les RENDRE — c'est elle que `decrireConnexion.
 * test.ts` éprouve en détail — seul ce que CETTE ÉTAPE imprime change : des
 * totaux et des booléens, jamais une valeur qui identifie la base.
 */

function ligne(nom: string, description: DescriptionConnexion): string {
  if (!description.lisible) {
    return `- ${nom} : URL illisible (vide, absente, ou non analysable).`;
  }
  const region =
    description.region !== null ? `, région \`${description.region}\`` : "";
  return (
    `- ${nom} : lisible, ${description.mutualise ? "mutualisé" : "direct"}${region}, ` +
    `port renseigné : ${description.port ? "oui" : "non"}, ` +
    `${description.parametres.length} paramètre(s) de requête`
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
