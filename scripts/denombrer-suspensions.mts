import {
  clientDenombrement,
  lectureFiable,
  rapport,
  SQL_DENOMBREMENT,
  SQL_TEMOIN,
  type DenombrementSuspensions,
  type TemoinDeLecture,
} from "./lib/suspensions-anterieures";

/**
 * `pnpm suspensions:denombrer` — LE PREMIER GESTE DE R3-02, ET LE SEUL QUE
 * CETTE SESSION FAIT.
 *
 * *Un rattrapage dont on ne connaît pas le volume est un rattrapage dont on ne
 * sait pas s'il coûte une minute ou une semaine.* Ce script rend le volume.
 * **Il ne répare rien** : R3-02 reste BLOQUÉ, parce que le motif d'une
 * suspension est une donnée que seul l'exploitant peut énoncer, ligne par
 * ligne.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */
const prisma = clientDenombrement();

try {
  const [temoinLu] =
    await prisma.$queryRawUnsafe<
      Array<{ role: string; superutilisateur: boolean; forceActif: boolean }>
    >(SQL_TEMOIN);
  if (temoinLu === undefined) {
    throw new Error("Le témoin de lecture n'a rendu aucune ligne.");
  }
  const temoin: TemoinDeLecture = {
    ...temoinLu,
    voit: lectureFiable(temoinLu),
  };

  // LE TÉMOIN AVANT LE COMPTE, et il refuse plutôt que de rendre un zéro
  // creux : *« il n'y a rien à rattraper » et « je ne vois rien » rendent le
  // même zéro* (§9, 07/09 et 30/08).
  if (!temoin.voit) {
    throw new Error(
      `Le dénombrement refuse de compter : le rôle « ${temoin.role} » n'est ` +
        "pas superutilisateur et « intervention » est sous FORCE ROW LEVEL " +
        "SECURITY. Sans contexte de société, il verrait zéro ligne et " +
        "rendrait un zéro qui n'est pas une mesure. Rejouer sous le rôle de " +
        "migration, ou lever FORCE le temps du diagnostic.",
    );
  }

  const [compte] =
    await prisma.$queryRawUnsafe<DenombrementSuspensions[]>(SQL_DENOMBREMENT);
  if (compte === undefined) {
    throw new Error("Le dénombrement n'a rendu aucune ligne.");
  }

  process.stdout.write(rapport(compte, temoin));
} finally {
  await prisma.$disconnect();
}
