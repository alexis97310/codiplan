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
  /**
   * LES EN-TÊTES DE SÉCURITÉ HTTP (décision d'Alexis du 10/11/2026,
   * 9L08-EN-TETES-SECURITE).
   *
   * Mesuré sur `81894e0` : aucun des trois fichiers qui auraient pu les
   * porter (`next.config.ts`, `vercel.json`, `middleware.ts`) n'en posait.
   * Ici et nulle part ailleurs — `middleware.ts` garde son seul emploi
   * documenté (porter le chemin), et un en-tête posé là-bas aurait exigé de
   * le recopier pour chaque réponse plutôt que de le déclarer une fois.
   *
   * ## La politique de contenu — chaque source mesurée, aucune supposée
   *
   * - `script-src`/`style-src` portent `'unsafe-inline'` : le routeur
   *   d'applications (App Router) sert ses données de flux (`self.__next_f`)
   *   par des balises `<script>` sans attribut `src`, et des composants
   *   posent un `style` en ligne calculé (couleur de société, largeur de
   *   colonne) — mesuré sur une page construite (`pnpm build` puis
   *   `pnpm start`), aucune balise ne porte de jeton (`nonce`) à substituer.
   * - `img-src` porte `blob:` : l'aperçu d'une photo réduite côté terrain
   *   (`components/interventions/photos-terrain.tsx`) s'affiche par
   *   `URL.createObjectURL`, jamais par une adresse réseau.
   * - `img-src` porte aussi `data:` (9L08AA, 16/11/2026) : la signature du bon
   *   est stockée et relue en `data:image/png;base64,...`
   *   (`lib/interventions/depot-rapport-terrain.ts`), affichée telle quelle
   *   dans trois écrans (bon bureau, fiche, bon portail) — pas un artefact de
   *   test, un chemin normal de l'application.
   * - Aucune police, aucune image, aucun script ne vient d'un domaine tiers
   *   (polices locales, `next/font/local` ; photos et signatures servies par
   *   `/api/documents/[id]/octets`, same-origin) : `connect-src`, `font-src`
   *   restent à `'self'` seul.
   * - `frame-ancestors 'none'` : aucun écran n'est destiné à être encadré.
   *   `object-src 'none'` : aucune balise `<object>`/`<embed>` dans le dépôt.
   */
  async headers() {
    const politiqueDeContenu = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: politiqueDeContenu },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Mesuré : la caméra ne sert qu'au lecteur de QR code
          // (`components/machines/scanner-qr.tsx`, `getUserMedia`). La
          // capture de photo terrain passe par `<input capture>`, hors de
          // cette politique (elle ouvre l'appareil photo du système, pas le
          // flux `getUserMedia` de la page).
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Le jeton de premier accès vit dans l'URL (voir
        // `app/(sans-session)/premier-acces/page.tsx`) : aucun en-tête
        // `Referer` ne doit le porter hors de cet écran, pas même vers une
        // ressource de même origine chargée depuis cette page.
        source: "/premier-acces",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
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
      // UNE SEULE PAGE « TARIFS » (9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE,
      // décisions n° 97 et n° 98 d'Alexis, 13/10/2026) — les deux anciennes
      // listes n'ont plus d'écran. `/parametres/forfaits/:id`, la fiche de
      // modification, N'EST PAS visée : `source` ne matche que le chemin
      // exact, jamais ses sous-chemins.
      {
        source: "/parametres/taux-horaire",
        destination: "/parametres/tarifs",
        permanent: true,
      },
      {
        source: "/parametres/forfaits",
        destination: "/parametres/tarifs",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
