import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createOTP } from "@better-auth/utils/otp";
import { maintenant } from "@/lib/calendar/fuseau";
import { chromium, type Browser, type Page } from "@playwright/test";

/**
 * LES CAPTURES D'ÉCRAN, PRISES PAR UN SCRIPT PLUTÔT QU'À LA MAIN.
 *
 * ## Pourquoi ce script existe
 *
 * Les captures du 09/09/2026 ont été prises à la main. **Une prise de vue
 * manuelle ne se rejoue pas** : elle vieillit sans le dire, et la seule chose
 * qui l'ancre est l'empreinte de commit écrite dans le README — que personne ne
 * regarde tant qu'on n'a pas de doute. *C'est la même famille que le §9 du
 * 31/08 : le silence a exactement la forme du succès.*
 *
 * Ici, la prise de vue est **une commande**. L'empreinte du commit est lue dans
 * `git rev-parse HEAD` au moment de la prise, jamais de mémoire ; l'horodatage
 * est lu à l'horloge ; et le README est RÉÉCRIT par le script, si bien qu'il ne
 * peut pas mentir sur ce qu'il décrit.
 *
 * ## Ce qu'il ne fait pas, et qui reste à la main
 *
 * Il ne prépare pas la base ni le compte : cela demande une base jetable, un
 * seed, et un mot de passe choisi. La procédure est dans le README qu'il écrit,
 * et le script REFUSE plutôt que de photographier des pages de connexion à la
 * place des écrans demandés — *une capture d'écran d'un écran de connexion
 * rangée sous le nom « planning » est pire qu'une capture absente.*
 *
 * Usage :
 *   BASE=http://127.0.0.1:3100 COURRIEL=… MOT_DE_PASSE=… \
 *     pnpm exec tsx scripts/captures.mts
 */

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const COURRIEL = process.env.COURRIEL ?? "";
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? "";
/**
 * Le secret TOTP d'un compte DÉJÀ enrôlé, quand la prise de vue rejoue sur une
 * base qui en porte un. Vide, le script active le second facteur lui-même et
 * lit la clé sur l'écran — *c'est le chemin d'un humain, et c'est celui-là
 * qu'on veut éprouver.*
 */
const SECRET_TOTP = process.env.SECRET_TOTP ?? "";

/**
 * La clé retenue lors de l'activation, pour la durée de la prise de vue.
 *
 * *Elle n'est écrite nulle part* : ni fichier, ni README, ni journal — c'est un
 * secret d'un compte, fût-il de démonstration (I9). Le script l'imprime en fin
 * de course pour qu'une prise de vue ULTÉRIEURE puisse la lui repasser par
 * `SECRET_TOTP`, et c'est le seul endroit où elle apparaît.
 */
let cleActivee = "";
const SORTIE = join(process.cwd(), "docs/captures");

/** Les deux largeurs : poste de travail et téléphone. */
const LARGEURS = [
  { nom: "1280", largeur: 1280, hauteur: 900, quoi: "poste de travail" },
  { nom: "390", largeur: 390, hauteur: 844, quoi: "téléphone" },
] as const;

/** Les deux thèmes. Le viewer en a un troisième — « système » — qui n'en est pas un. */
const THEMES = [
  { nom: "clair", schema: "light" as const },
  { nom: "sombre", schema: "dark" as const },
];

type Ecran = {
  /** Le nom du fichier, sans thème ni largeur. */
  readonly nom: string;
  readonly chemin: string;
  readonly quoi: string;
  /** Faut-il être connecté pour l'atteindre ? */
  readonly authentifie: boolean;
  /** Un texte qui doit être présent : le script REFUSE si l'écran n'est pas le bon. */
  readonly temoin: string;
  /** Pourquoi cet écran peut légitimement être refusé, quand c'est structurel. */
  readonly refusConnu?: string;
  /**
   * L'écran N'EXISTE QUE TANT QUE LE SECOND FACTEUR N'EST PAS ACTIVÉ.
   *
   * Il ne se photographie donc pas dans la boucle ordinaire, qui tourne sous
   * une session déjà enrôlée : il se photographie AVANT, dans sa propre passe.
   * *Le refus du 10/09 disait « il faudrait une seconde identité » — c'était
   * une impossibilité affirmée sans son coût (§9, 08/09). Il n'en faut pas :
   * il faut prendre la photo plus tôt.*
   */
  readonly avantEnrolement?: boolean;
};

const ECRANS: readonly Ecran[] = [
  {
    nom: "accueil",
    chemin: "/",
    quoi: "La page d'accueil.",
    authentifie: false,
    temoin: "CODIPLAN",
  },
  {
    nom: "connexion",
    chemin: "/connexion",
    quoi: "La page de connexion.",
    authentifie: false,
    temoin: "Connexion",
  },
  {
    nom: "sante",
    chemin: "/sante",
    quoi: "L'état de l'installation, **sans compte**.",
    authentifie: false,
    temoin: "installation",
  },
  {
    // **L'écran où atterrit un compte à rôle sensible**, et c'est une garantie
    // et non un obstacle : un rôle qui exige un second facteur ne va nulle part
    // avant de l'avoir activé. C'est ce qui fait que `/arrivee` est REFUSÉE
    // ci-dessous plutôt que photographiée — le script le dit au lieu de
    // photographier autre chose sous ce nom.
    nom: "enrolement",
    chemin: "/enrolement",
    quoi: "L'activation du second facteur, où atterrit un rôle sensible avant tout le reste.",
    authentifie: true,
    temoin: "second facteur",
    avantEnrolement: true,
    refusConnu:
      "Cet écran se photographie AVANT l'activation du second facteur, dans " +
      "sa propre passe : la session enrôlée qui sert au reste de la prise de " +
      "vue ne le voit plus. S'il est refusé, la cause est donc que LE COMPTE " +
      "PORTE DÉJÀ un second facteur — repartir d'une base fraîchement semée " +
      "(`pnpm db:seed`), la clé d'un enrôlement passé n'étant pas rejouable.",
  },
  {
    nom: "arrivee",
    chemin: "/arrivee",
    quoi: "La page d'arrivée — qui vous êtes, pour quelle société.",
    authentifie: true,
    temoin: "société",
  },
  {
    nom: "planning",
    chemin: "/planning",
    quoi: "Le planning : la charge par technicien, la file d'attente et les interventions posées.",
    authentifie: true,
    temoin: "Planning",
  },
  {
    nom: "intervention-creation",
    chemin: "/planning/nouvelle",
    quoi: "La création d'une intervention depuis le planning.",
    authentifie: true,
    temoin: "intervention",
  },
];

function empreinte(): { court: string; long: string } {
  const long = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  return { court: long.slice(0, 7), long };
}

/**
 * Se connecte, et REFUSE si la connexion n'a pas abouti.
 *
 * *Une session qui échoue en silence ferait photographier six fois la page de
 * connexion sous six noms différents* — un rapport faux, et exactement le
 * genre de faux qu'un lecteur ne peut pas détecter.
 */
/**
 * ACTIVE LE SECOND FACTEUR SI L'ÉCRAN LE RÉCLAME.
 *
 * **Ce n'est pas un contournement de la sécurité, c'est le chemin réel.** Un
 * rôle sensible n'atteint aucun écran avant d'avoir activé son second facteur
 * (D58), et une prise de vue qui n'en tiendrait pas compte photographierait
 * douze fois la page d'enrôlement sous douze noms différents — *c'est ce qui
 * est arrivé le 10/09, et c'est l'image qui l'a montré, pas l'assertion.*
 *
 * La clé est lue SUR L'ÉCRAN, là où un humain la lirait ; le code à six
 * chiffres est calculé avec la même bibliothèque que la vérification.
 */
async function activerSecondFacteur(page: Page): Promise<void> {
  if (!page.url().includes("/enrolement")) {
    return;
  }
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  // **L'ÉCRAN MONTRE LA CLÉ EN BASE32**, parce que c'est ce qu'une application
  // d'authentification sait lire ; la vérification, elle, calcule le code sur
  // le secret BRUT. Les deux sont la même chose sous deux graphies, et les
  // confondre rend un code refusé sans que rien ne dise pourquoi — *mesuré :
  // « Ce code n'est pas valide », sur une clé parfaitement juste.*
  const cle = base32VersBrut(affichee);
  if (cle === "") {
    throw new Error(
      "L'écran d'enrôlement n'a pas révélé de clé : la préparation a échoué, " +
        "et aucun code ne peut être calculé.",
    );
  }
  cleActivee = cle;
  await page.fill('input[name="code"]', await codeCourant(cle));
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * ACTIVE UNE SOCIÉTÉ SI LE COMPTE N'EN A PAS.
 *
 * **Un compte habilité sur deux sociétés n'en a aucune d'active à la
 * connexion** — la connexion n'établit que l'identité (D35). Sans ce geste,
 * tout écran cloisonné redirige vers l'arrivée, et la prise de vue
 * photographierait la page d'arrivée sous le nom du planning. *C'est ce qui est
 * arrivé le 10/09, deux fois : d'abord parce que l'écran de choix n'existait
 * pas, ensuite parce que le script ne le CLIQUAIT pas.*
 *
 * Le premier bouton est choisi, et lequel importe peu : ce que la prise de vue
 * doit montrer est un planning garni, et les deux sociétés de démonstration en
 * ont un depuis le 10/09.
 */
async function choisirUneSociete(page: Page): Promise<void> {
  await page.goto(`${BASE}/arrivee`, { waitUntil: "networkidle" });
  const bouton = page
    .locator('form[action="/api/session/societe"] button[type="submit"]')
    .first();
  if ((await bouton.count()) === 0) {
    return;
  }
  await bouton.click();
  await page.waitForLoadState("networkidle");
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** La clé affichée est en base32 ; le secret vérifié est ce qu'elle encode. */
function base32VersBrut(base32: string): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const caractere of base32.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) {
      throw new Error(`Clé affichée illisible : « ${caractere} » hors base32.`);
    }
    bits += index.toString(2).padStart(5, "0");
  }
  let brut = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    brut += String.fromCharCode(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return brut;
}

async function seConnecter(page: Page): Promise<void> {
  // **DEUX TOURS, ET LE SECOND N'EST PAS UNE PRÉCAUTION.** L'application
  // DÉCONNECTE volontairement après l'activation d'un second facteur — la
  // session d'avant ne vaut plus, ce qui est le bon geste. Un script qui ne
  // ferait qu'un tour conclurait donc à l'échec sur le chemin nominal d'un
  // compte neuf, et photographierait la page de connexion.
  for (let tour = 1; tour <= 2; tour += 1) {
    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
    // Les champs sont désignés par leur `name`, qui est ce que le formulaire
    // ENVOIE : un libellé se traduit, se reformule, et changerait ce script
    // sans que la fonctionnalité bouge.
    await page.fill('input[name="email"]', COURRIEL);
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    // Le défi de second facteur, quand le compte est déjà enrôlé.
    const secret = SECRET_TOTP === "" ? cleActivee : SECRET_TOTP;
    if (page.url().includes("/connexion/code") && secret !== "") {
      await page.fill('input[name="code"]', await codeCourant(secret));
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
    await activerSecondFacteur(page);

    if (!page.url().includes("/connexion")) {
      await choisirUneSociete(page);
      return;
    }
  }

  const url = page.url();
  throw new Error(
    `La connexion n'a pas abouti : la page est restée sur ${url}. ` +
      (url.includes("/connexion/code")
        ? "Le compte porte DÉJÀ un second facteur et la clé n'est pas connue " +
          "de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une " +
          "base fraîchement semée. "
        : "") +
      "Aucune capture authentifiée ne sera prise — mieux vaut aucune image " +
      "qu'une page de connexion rangée sous le nom d'un autre écran.",
  );
}

async function photographier(
  navigateur: Browser,
  ecran: Ecran,
  theme: (typeof THEMES)[number],
  format: (typeof LARGEURS)[number],
  cookies: Awaited<ReturnType<Browser["newContext"]>> | null,
): Promise<void> {
  const contexte =
    cookies ??
    (await navigateur.newContext({
      viewport: { width: format.largeur, height: format.hauteur },
      colorScheme: theme.schema,
      locale: "fr-FR",
    }));
  const page = await contexte.newPage();
  await page.setViewportSize({ width: format.largeur, height: format.hauteur });
  await page.emulateMedia({ colorScheme: theme.schema });
  await page.goto(`${BASE}${ecran.chemin}`, { waitUntil: "networkidle" });

  // ── LE TÉMOIN SE LIT SUR CE QU'UN HUMAIN VOIT, JAMAIS SUR LE DOM ────────
  //
  // **Mesuré le 10/09/2026, et c'est la capture qui l'a montré.** Avec
  // `textContent("body")`, le témoin « Planning » a été trouvé… dans la charge
  // RSC que Next.js sérialise en fin de page. Les quatre captures du planning
  // ont donc été ACCEPTÉES en montrant l'écran d'enrôlement — *une assertion
  // verte sur une image fausse*, exactement l'espèce que le §9 du 09/09
  // nomme : un défaut invisible à toute assertion et évident sur une image.
  //
  // `innerText` ne rend que le texte RENDU : les `<script>` en sortent.
  const corps = await page.locator("body").innerText();
  if (!corps.toLowerCase().includes(ecran.temoin.toLowerCase())) {
    throw new Error(
      `« ${ecran.nom} » ne porte pas son témoin « ${ecran.temoin} » : ce n'est ` +
        "pas l'écran attendu, et la capture est refusée.",
    );
  }

  await page.screenshot({
    path: join(SORTIE, `${ecran.nom}--${theme.nom}--${format.nom}.png`),
    fullPage: true,
  });
  await page.close();
  if (cookies === null) {
    await contexte.close();
  }
}

/**
 * LA PASSE D'AVANT-ENRÔLEMENT — quatre connexions, et pas une seconde identité.
 *
 * **Ce que le refus du 10/09 disait, et ce que la mesure dit.** Il annonçait
 * qu'un écran d'enrôlement ne pouvait être photographié « qu'avec une seconde
 * identité, jamais enrôlée ». C'était une impossibilité énoncée sans son coût
 * (§9, 08/09) : *il ne faut pas une autre identité, il faut prendre la photo
 * plus tôt.* Un compte devient enrôlé au moment de l'ACTIVATION, jamais à la
 * connexion — se connecter quatre fois avant elle donne les quatre images.
 *
 * La passe s'exécute donc AVANT `seConnecter`, et elle n'active rien. Elle
 * échoue proprement si le compte porte déjà un second facteur : l'écran ne
 * portera pas son témoin, et le refus dira quoi faire.
 *
 * *Le coût est de quatre connexions supplémentaires. Il est payé une fois par
 * prise de vue, et il achète l'écran par lequel passe TOUT compte à rôle
 * sensible — celui qu'on ne pouvait pas montrer.*
 */
async function photographierAvantEnrolement(
  navigateur: Browser,
  ecran: Ecran,
  prises: string[],
  manquants: string[],
): Promise<void> {
  // UNE SEULE CONNEXION POUR LES QUATRE IMAGES, et ce n'est pas une économie
  // de confort. **Mesuré le 11/09/2026 :** quatre connexions coup sur coup,
  // suivies de celles de `seConnecter`, épuisent la limite de débit que Better
  // Auth pose sur `/sign-in/email` ; les connexions suivantes reçoivent un
  // statut hors 200, `tenterConnexion` les traite pour ce qu'elles sont — un
  // refus —, et **les douze captures authentifiées tombent sans que rien ne
  // dise pourquoi**. *Un refus de débit et un mot de passe faux sont
  // indiscernables, par construction (D35) : c'est la bonne règle, et c'est
  // elle qui rend l'épuisement invisible.*
  const ouverture = await navigateur.newContext({ locale: "fr-FR" });
  let etat: Awaited<
    ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
  > | null = null;
  let refus: string | null = null;
  try {
    const page = await ouverture.newPage();
    // Connexion NUE : ni défi de second facteur — le compte n'en a pas
    // encore —, ni activation. C'est tout l'objet de cette passe.
    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', COURRIEL);
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    etat = await ouverture.storageState();
  } catch (erreur) {
    refus = String(erreur).slice(0, 200);
  } finally {
    await ouverture.close();
  }

  for (const theme of THEMES) {
    for (const format of LARGEURS) {
      const nom = `${ecran.nom}--${theme.nom}--${format.nom}`;
      let contexte = null;
      try {
        if (etat === null) {
          throw new Error(`session absente — ${refus ?? "cause inconnue"}`);
        }
        contexte = await navigateur.newContext({
          viewport: { width: format.largeur, height: format.hauteur },
          colorScheme: theme.schema,
          locale: "fr-FR",
          storageState: etat,
        });
        await photographier(navigateur, ecran, theme, format, contexte);
        prises.push(nom);
      } catch (erreur) {
        manquants.push(
          `${nom} : ${String(erreur).slice(0, 200)}` +
            (ecran.refusConnu === undefined ? "" : `\n  ${ecran.refusConnu}`),
        );
      } finally {
        await contexte?.close();
      }
    }
  }
}

async function principal(): Promise<number> {
  mkdirSync(SORTIE, { recursive: true });
  const commit = empreinte();
  // L'HEURE SE LIT AVEC SON FUSEAU, jamais celle de l'appareil (L0-08). Une
  // prise de vue horodatée à l'heure locale d'un exécuteur ne se compare à
  // rien — et le gardien de L0-08 le refuse, à juste titre.
  const quand = maintenant("UTC")
    .instant.toISOString()
    .replace("T", " ")
    .slice(0, 16);

  const navigateur = await chromium.launch();
  const prises: string[] = [];
  const manquants: string[] = [];
  const obsoletes: string[] = [];

  // LA SESSION EST OUVERTE UNE FOIS ET RÉUTILISÉE. Se connecter à chaque
  // capture ferait douze connexions pour six écrans, et douze occasions
  // d'échouer là où une seule suffit à établir le fait.
  let etatSession: Awaited<
    ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
  > | null = null;
  let refusSession: string | null = null;

  // AVANT TOUT LE RESTE : les écrans qui n'existent que tant que le second
  // facteur n'est pas activé. `seConnecter` l'active — l'ordre n'est donc pas
  // une commodité, c'est la condition d'existence de ces images.
  if (COURRIEL !== "" && MOT_DE_PASSE !== "") {
    for (const ecran of ECRANS.filter((e) => e.avantEnrolement === true)) {
      await photographierAvantEnrolement(navigateur, ecran, prises, manquants);
    }
  }

  if (COURRIEL !== "" && MOT_DE_PASSE !== "") {
    const contexte = await navigateur.newContext({ locale: "fr-FR" });
    try {
      const page = await contexte.newPage();
      await seConnecter(page);
      etatSession = await contexte.storageState();
    } catch (erreur) {
      refusSession = String(erreur).slice(0, 200);
    } finally {
      await contexte.close();
    }
  } else {
    refusSession = "aucun COURRIEL / MOT_DE_PASSE fourni.";
  }

  try {
    for (const ecran of ECRANS.filter((e) => e.avantEnrolement !== true)) {
      for (const theme of THEMES) {
        for (const format of LARGEURS) {
          let contexte = null;
          try {
            if (ecran.authentifie) {
              if (etatSession === null) {
                throw new Error(
                  `session absente — ${refusSession ?? "cause inconnue"}`,
                );
              }
              contexte = await navigateur.newContext({
                viewport: { width: format.largeur, height: format.hauteur },
                colorScheme: theme.schema,
                locale: "fr-FR",
                storageState: etatSession,
              });
            }
            await photographier(navigateur, ecran, theme, format, contexte);
            prises.push(`${ecran.nom}--${theme.nom}--${format.nom}.png`);
          } catch (erreur) {
            manquants.push(
              `${ecran.nom}--${theme.nom}--${format.nom} : ${String(erreur).slice(0, 160)}` +
                (ecran.refusConnu === undefined
                  ? ""
                  : `\n  ${ecran.refusConnu}`),
            );
          } finally {
            if (contexte !== null) {
              await contexte.close();
            }
          }
        }
      }
    }
  } finally {
    await navigateur.close();
  }

  // ── LES IMAGES QUE CETTE PRISE N'A PAS PRODUITES SONT RETIRÉES ──────────
  //
  // **Sinon le répertoire ment par accumulation** : une image d'un écran
  // supprimé ou renommé survit, le README ne la décrit plus, et elle se relit
  // comme une preuve de ce que l'application affiche. *C'est la maladie de ce
  // dépôt tout entier — une liste qu'on ajoute et qu'on ne retire jamais.*
  const gardees = new Set(prises);
  for (const fichier of readdirSync(SORTIE)) {
    if (fichier.endsWith(".png") && !gardees.has(fichier)) {
      unlinkSync(join(SORTIE, fichier));
      obsoletes.push(fichier);
    }
  }

  writeFileSync(
    join(SORTIE, "README.md"),
    redigerReadme(commit, quand, prises, manquants, obsoletes),
    "utf8",
  );

  process.stdout.write(
    `${prises.length} capture(s) prise(s), ${manquants.length} refusée(s), ` +
      `${obsoletes.length} retirée(s). ` +
      `Commit photographié : ${commit.court}.\n`,
  );
  if (cleActivee !== "") {
    process.stdout.write(
      "Un second facteur a été ACTIVÉ pendant cette prise de vue. Pour rejouer " +
        "sur la MÊME base sans la resemer, repasser cette clé en " +
        "`SECRET_TOTP` — elle n'est écrite dans aucun fichier :\n" +
        `  ${cleActivee}\n`,
    );
  }
  for (const manquant of manquants) {
    process.stdout.write(`  — ${manquant}\n`);
  }
  // Un refus de capture n'est pas un échec du script : c'est une observation,
  // et elle est ÉCRITE dans le README plutôt que perdue dans un journal.
  return 0;
}

function redigerReadme(
  commit: { court: string; long: string },
  quand: string,
  prises: readonly string[],
  manquants: readonly string[],
  obsoletes: readonly string[],
): string {
  const lignes = [
    "# Captures d'écran — ce que l'application affiche aujourd'hui",
    "",
    "**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.",
    "",
    "| | |",
    "|---|---|",
    `| **Commit photographié** | \`${commit.long}\` (\`${commit.court}\`) — lu dans \`git rev-parse HEAD\` au moment de la prise, jamais de mémoire |`,
    `| **Date de la prise** | ${quand} UTC — lue à l'horloge, jamais déduite |`,
    "| **Base** | un PostgreSQL 16 local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |",
    "| **Compte** | l'identité de démonstration du seed |",
    "",
    "## Ce que le script REFUSE de photographier",
    "",
    "Chaque écran porte un **témoin** : un texte qui doit s'y trouver. Si la page ne le porte pas — parce que la connexion a échoué, parce que l'écran a été renommé, parce qu'une redirection a mené ailleurs — **la capture est refusée et l'absence est écrite ici**. *Une capture d'un écran de connexion rangée sous le nom « planning » est pire qu'une capture absente : elle se relit comme une preuve.*",
    "",
  ];

  if (manquants.length > 0) {
    lignes.push(
      "### Refusées à cette prise",
      "",
      ...manquants.map((m) => `- \`${m}\``),
      "",
    );
  } else {
    lignes.push("*Aucun refus à cette prise.*", "");
  }

  if (obsoletes.length > 0) {
    lignes.push(
      "### Retirées à cette prise",
      "",
      "Ces images ne correspondent plus à aucun écran photographié. **Elles sont supprimées plutôt que laissées** : une image que le README ne décrit plus se relit quand même comme une preuve de ce que l'application affiche.",
      "",
      ...obsoletes.map((o) => `- \`${o}\``),
      "",
    );
  }

  lignes.push(
    "## Les images",
    "",
    "Chaque écran est photographié en **thème clair** et en **thème sombre**, à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.",
    "",
    "| Fichier | Ce qu'on y voit |",
    "|---|---|",
  );
  for (const fichier of prises) {
    const nom = fichier.replace(/--.*/, "");
    const ecran = ECRANS.find((e) => e.nom === nom);
    const theme = fichier.includes("--clair--") ? "clair" : "sombre";
    const format = fichier.includes("--1280.")
      ? "poste de travail"
      : "téléphone";
    lignes.push(
      `| \`${fichier}\` | ${ecran?.quoi ?? nom} — thème ${theme}, ${format}. |`,
    );
  }
  lignes.push("");
  return lignes.join("\n");
}

process.exit(await principal());
