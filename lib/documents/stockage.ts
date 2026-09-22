import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * LE STOCKAGE D'OBJETS — un appelant, enfin, pour `document.objet_cle` (BON-2).
 *
 * ## Ce que ce module N'EST PAS
 *
 * `docs/arbitrages.md` (L0-09, L8-05) dit que le stockage S3-compatible de
 * l'hébergeur est la cible retenue (CLAUDE.md §2), et que **personne ne l'a
 * construit faute d'appelant** — une interface sans appelant est la maladie
 * que ce dépôt soigne systématiquement plutôt que d'anticiper. La saisie
 * terrain d'une photo (BON-2) est cet appelant.
 *
 * **Ce module n'est PAS ce choix construit.** Aucun identifiant, aucune
 * dépendance S3 ne sont configurés dans ce dépôt (`.env.example` n'en porte
 * aucun), et en ajouter un ici serait inventer une décision d'infrastructure
 * hors du territoire de ce ticket (CLAUDE.md §8 — service externe payant). Ce
 * qui est construit est l'INTERFACE que `document.objet_cle` attend déjà —
 * une clé opaque, des octets ailleurs — avec un dos-d'âne LOCAL, exactement
 * comme `DATABASE_URL` pointe une base Postgres locale en développement quand
 * la production en pointe une hébergée. **Condition de réouverture, écrite
 * plutôt que devinée** : le jour où l'hébergeur fournit ses identifiants
 * S3-compatibles, seul ce fichier change — aucun appelant ne connaît la forme
 * de la clé qu'il reçoit.
 *
 * ## Pourquoi pas dans le dépôt (I9)
 *
 * Les octets vivent sous `.donnees-locales/`, ignoré par git (voir
 * `.gitignore`) : I9 interdit toute photo réelle dans le dépôt, et un objet
 * écrit par un scénario de test ou une session de développement n'y entre
 * jamais.
 */

const RACINE = join(process.cwd(), ".donnees-locales", "objets");

export type ObjetStocke = {
  readonly objetCle: string;
  readonly empreinte: string;
  readonly tailleOctets: number;
};

/** Un nom de fichier, sans quoi que ce soit qui traverserait un répertoire. */
function nomSurCle(cle: string): string {
  return cle.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * ENREGISTRE des octets et rend leur clé — l'empreinte SHA-256, comme
 * `document.empreinte` l'exige déjà (L8-01), préfixée pour éviter toute
 * collision de nom sur le disque.
 */
export async function enregistrerObjet(
  octets: Buffer,
  nomFichier: string,
): Promise<ObjetStocke> {
  const empreinte = createHash("sha256").update(octets).digest("hex");
  const objetCle = `${empreinte}-${nomSurCle(nomFichier)}`;
  const chemin = join(RACINE, objetCle);
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, octets);
  return { objetCle, empreinte, tailleOctets: octets.byteLength };
}

/** LIT les octets d'un objet déjà enregistré, par sa clé. */
export async function lireObjet(objetCle: string): Promise<Buffer> {
  return readFile(join(RACINE, nomSurCle(objetCle)));
}
