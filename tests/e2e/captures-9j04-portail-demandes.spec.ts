import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9J04-PORTAIL-DEMANDES (CLI-4) — même recette que
 * `captures-9j02a-acces-portail.spec.ts` (mémoire « captures-avant-apres-e2e »).
 *
 * **PREMIÈRE OUVERTURE DE SESSION PORTAIL EN E2E.** Aucun scénario de bout en
 * bout n'avait encore JAMAIS ouvert `/connexion` avec un compte `Role.client` :
 * ce fichier emprunte le même chemin que l'invitation (`inviterClientAuPortail`,
 * 9J02A-REPRISE-9J02), puis le même premier accès que
 * `ouvrirLeCompteDeLEpreuve` (`choisirLePremierMotDePasse`) — jamais un cookie
 * fabriqué, pour la même raison que `tests/e2e/setup/session.ts` donne déjà
 * (*« un harnais qui poserait un cookie fabriqué mesurerait le planning et rien
 * d'autre »*).
 *
 * **AUCUNE FIXTURE DE PARC N'EST CRÉÉE.** Le premier client de la société de
 * l'épreuve porte déjà, par le semis de démonstration
 * (`prisma/seed-data.ts`, `MACHINES_DEMONSTRATION`), au moins deux sites et
 * plusieurs machines — la même donnée que tout autre écran du portail lit
 * déjà. Une fixture écrite ici referait une lecture qu'un autre module tient
 * déjà (§9, 01/09).
 *
 * **IDEMPOTENT SANS SUPPRESSION** : `inviterClientAuPortail` retrouve la MÊME
 * identité par courriel et ne réémet un jeton que si aucun mot de passe
 * n'existe encore (`dejaActif`) — un relancement retrouve le compte déjà
 * ouvert au premier passage et se contente de s'y connecter.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J04 ?? "";
const EMAIL_PORTAIL = "9j04-portail-demandes@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9j04-portail-demandes";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

type SceneDemandes = {
  readonly machineNumeroSerie: string;
  readonly siteLibelle: string;
};

async function preparerLaScene(): Promise<SceneDemandes> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const machine = await admin.machine.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { numero_serie: true },
      orderBy: { numero_serie: "asc" },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { libelle: true },
      orderBy: { libelle: "asc" },
    });

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        client.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.dejaActif) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }

    return {
      machineNumeroSerie: machine.numero_serie,
      siteLibelle: site.libelle,
    };
  } finally {
    await admin.$disconnect();
  }
}

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de chemin. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
  // `/arrivee` N'OFFRE AUCUN LIEN VERS LE PORTAIL POUR UN COMPTE PORTAIL
  // (GAP MESURÉ ICI, nommé en passation, hors territoire de 9J04) :
  // `estContexteActif` — qui décide si `etatArrivee` rend « arrivee » plutôt
  // que « sans_societe », et donc si `Entree` (le lien « Voir votre parc »)
  // s'affiche — refuse TOUJOURS un contexte de rôle `client` tant qu'aucun
  // client n'est désigné (D70, `lib/auth/contexte.ts`), et la session seule
  // ne désigne jamais de client (D70, `lib/auth/session.ts`). Un compte
  // portail reste donc visuellement bloqué sur `/arrivee` après connexion,
  // quel que soit le nombre de sociétés. Ce scénario-ci contourne le même
  // mur que `/portail/page.tsx` contourne déjà pour SA propre lecture — en
  // visitant directement l'URL, seul chemin qu'un compte portail ait
  // aujourd'hui (voir le docblock de `page.tsx`, « AUCUNE ENTRÉE DE MENU
  // N'EST AJOUTÉE »).
  await page.goto("/portail");
  await expect(page).toHaveURL(/\/portail/);
}

let scene: SceneDemandes;

test.beforeAll(async () => {
  scene = await preparerLaScene();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — liste des demandes du portail, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/demandes");
      await expect(
        page.getByRole("heading", { name: fr["portail.demandes.titre"] }),
      ).toBeVisible();
      await capturer(page, "liste-demandes", largeur);
    });

    test(`capture — formulaire avec machine identifiée (CLI-4.1), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/demandes");
      await page
        .locator("summary", {
          hasText: fr["portail.demandes.action.deposer"],
        })
        .click();
      await page
        .getByLabel(fr["portail.demandes.champ.machine"])
        .selectOption({ label: scene.machineNumeroSerie });
      await page
        .getByLabel(fr["portail.demandes.champ.description"])
        .fill("Bruit anormal au démarrage (capture 9J04)");
      await capturer(page, "formulaire-machine-identifiee", largeur);
    });

    test(`capture — formulaire sans machine identifiée (CLI-4.2), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/demandes");
      await page
        .locator("summary", {
          hasText: fr["portail.demandes.action.deposer"],
        })
        .click();
      await page
        .getByLabel(fr["portail.demandes.champ.site"])
        .selectOption({ label: scene.siteLibelle });
      await page
        .getByLabel(fr["portail.demandes.champ.description"])
        .fill("Je ne sais pas quelle machine est concernée (capture 9J04)");
      await capturer(page, "formulaire-sans-machine", largeur);
    });
  });
}
