import type { NextConfig } from "next";

/**
 * L'INTERVENTION A CHANGÉ D'ADRESSE (N-01, 16/09/2026).
 *
 * `/planning/{id}` devient `/interventions/{id}`, `/planning/nouvelle` devient
 * `/interventions/nouvelle` : un objet, un écran canonique, une URL qui le
 * nomme — jamais celle de l'écran par lequel on l'a atteint la première fois.
 *
 * **CETTE REDIRECTION EST TRANSITOIRE.** Les anciennes adresses ont été
 * ouvertes, captées dans des restitutions, et l'application de démonstration
 * tourne dessus : les faire répondre 404 casserait ce qui les a déjà
 * enregistrées. *Une redirection sans date de péremption écrite devient un
 * second chemin permanent vers le même écran* — la faute que ce ticket
 * répare —, d'où la date ci-dessous plutôt qu'un silence.
 *
 * **SE FERME au premier lot qui touche `app/(back-office)/planning/` après le
 * 16/03/2027** (six mois) : retirer les deux entrées ci-dessous, et vérifier
 * qu'aucune restitution ni aucun lien externe connu ne vise encore
 * `/planning/{id}` ou `/planning/nouvelle`.
 */
const nextConfig: NextConfig = {
  // `next/image` n'est utilisé nulle part dans le dépôt (vérifié — aucune
  // occurrence dans app/, components/, lib/) : l'optimiseur d'images intégré
  // ne sert à rien ici, mais Next.js trace quand même `sharp`/`libvips` dans
  // le paquet serveur tant qu'il n'est pas désactivé — 16,3 Mo sur les 45 Mo
  // du paquet unique mesurés localement (`.next/*.nft.json`), pour une
  // fonctionnalité qu'aucun écran n'appelle.
  images: {
    unoptimized: true,
  },
  // `images.unoptimized` seul ne suffit pas : Next.js trace `sharp`/`libvips`
  // dans le paquet serveur indépendamment de ce réglage (mesuré — 16,3 Mo
  // inchangés après le seul `unoptimized`). Exclusion explicite, vérifiée par
  // mesure du paquet avant/après.
  outputFileTracingExcludes: {
    "*": ["node_modules/@img/**", "node_modules/sharp/**"],
  },
  async redirects() {
    return [
      {
        source: "/planning/nouvelle",
        destination: "/interventions/nouvelle",
        permanent: true,
      },
      {
        source: "/planning/:id",
        destination: "/interventions/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
