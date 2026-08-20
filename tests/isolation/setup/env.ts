/**
 * Environnement des scénarios d'isolation (L0-06).
 *
 * Better Auth exige un secret de signature. Celui-ci n'est PAS un secret : il
 * est fixe, public, et ne sert qu'à la base jetable des tests. Aucun secret réel
 * n'entre dans le dépôt (I9) ; en production la valeur vient de
 * `BETTER_AUTH_SECRET`, déposée hors dépôt (voir `.env.example`).
 */
process.env.BETTER_AUTH_SECRET ??=
  "secret-de-test-non-confidentiel-pour-la-base-jetable";
