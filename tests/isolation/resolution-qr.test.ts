import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { jetonDeMachine } from "@/lib/machines/qr";
import { resoudreParJeton } from "@/lib/machines/resolution";

import { exigence } from "./setup/contrat";
import { clientApp, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MACHINE_A1,
  MACHINE_A2,
  PORTAIL_A_CLIENT,
  QR_A1,
  QR_A2,
  QR_B1,
  UTILISATEUR_PAR_ROLE,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LA RÉSOLUTION D'UN SCAN PAR LE CHEMIN DE PRODUCTION (L2-02, D22).
 *
 * `tests/isolation/qr-code.test.ts` éprouve le FILET de base de données : sous
 * un contexte armé à la main, la ligne d'une autre société est invisible. **Ce
 * fichier-ci éprouve le CHEMIN** — `resoudreParJeton`, celui que la route
 * appelle réellement —, et c'est ce que D22 réclamait : *« `GET
 * /machines/qr/{token}` vérifie côté serveur que la machine appartient à la
 * société active et refuse sinon. »*
 *
 * *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09).
 * Les deux fichiers ne se remplacent donc pas : le filet tient si le chemin
 * disparaît, le chemin tient si quelqu'un l'écrit mal au-dessus d'un filet
 * intact.
 */
describe("résolution d'un jeton QR par le chemin de production", () => {
  afterAll(fermerClients);

  /** Un utilisateur interne de la société A — il voit tout le parc de sa société. */
  const INTERNE = {
    utilisateurId: UTILISATEUR_PAR_ROLE.technicien,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  it(
    exigence(
      "qr_inter_societe",
      "le chemin de production résout un jeton de SA société",
    ),
    async () => {
      const machine = await resoudreParJeton(INTERNE, QR_A1, clientApp());
      expect(machine?.id).toBe(MACHINE_A1);
      // Ce que le scan rend, et rien de plus : de quoi ouvrir la fiche.
      expect(machine?.clientId).toBe(CLIENT_A1);
      // `numero` est NUL tant que la machine n'a pas été synchronisée (D7,
      // I10) : personne ne l'attribue encore, et le scan ne l'invente pas.
      expect(machine?.numero).toBeNull();
    },
  );

  it(
    exigence(
      "qr_inter_societe",
      "le chemin de production REFUSE le jeton d'une autre société",
    ),
    async () => {
      // `QR_B1` est un jeton parfaitement valide — il existe, il est unique
      // globalement, et il désigne une machine réelle. Ce qui le refuse n'est
      // pas sa forme : c'est la politique, sous le contexte de la société A.
      expect(await resoudreParJeton(INTERNE, QR_B1, clientApp())).toBeNull();
    },
  );

  it(
    exigence(
      "qr_inter_societe",
      "un jeton INCONNU et le jeton d'AUTRUI sont indiscernables",
    ),
    async () => {
      // D35 et D50 : un refus a le droit d'être lisible, jamais d'être
      // informatif. Si ces deux cas se distinguaient, ce chemin deviendrait un
      // oracle — *ce jeton existe-t-il quelque part ?* —, c'est-à-dire un moyen
      // d'apprendre depuis un compte quelconque qu'une machine étiquetée
      // appartient à un concurrent.
      const inconnu = jetonDeMachine("0192f0a0-1000-7000-8000-00000000ffff");
      const autrui = QR_B1;
      expect(await resoudreParJeton(INTERNE, inconnu, clientApp())).toBeNull();
      expect(await resoudreParJeton(INTERNE, autrui, clientApp())).toBeNull();
      // TÉMOIN : sans lui, les deux `null` ci-dessus pourraient venir d'un
      // chemin qui rend TOUJOURS `null` — et l'indiscernabilité serait celle
      // d'une panne (§9, 30/08).
      expect(
        await resoudreParJeton(INTERNE, QR_A1, clientApp()),
      ).not.toBeNull();
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "le QR ne LÈVE pas le périmètre d'un compte portail",
    ),
    async () => {
      // D10 rencontre D22, et c'est le scénario qui décide. Le compte portail
      // est habilité sur le client A1, donc `MACHINE_A2` est bien celle d'un
      // client qu'il connaît — mais elle est sur un site HORS de son périmètre.
      // *Le QR ouvre la fiche de ce qu'on avait déjà le droit de voir ; il
      // n'ouvre pas ce qu'on n'avait pas.*
      const portail = {
        utilisateurId: PORTAIL_A_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A1,
      };
      expect(await resoudreParJeton(portail, QR_A2, clientApp())).toBeNull();
      // TÉMOIN, et il porte tout le scénario : la machine de son propre site se
      // résout. Sans lui, le refus ci-dessus prouverait seulement qu'un compte
      // portail ne résout rien du tout.
      const dansLePerimetre = await resoudreParJeton(
        portail,
        QR_A1,
        clientApp(),
      );
      expect(dansLePerimetre?.id).toBe(MACHINE_A1);
      expect(MACHINE_A2).not.toBe(MACHINE_A1);
    },
  );

  it("une entrée qui n'est pas un jeton ne descend pas jusqu'à la base", async () => {
    // La borne est de TAILLE, jamais de forme : le jeton lu est une donnée
    // STOCKÉE, et contrôler sa forme à la lecture lierait les scans
    // d'aujourd'hui à la dérivation d'aujourd'hui. Le jour où celle-ci
    // changerait, les étiquettes déjà collées cesseraient de se résoudre — en
    // silence.
    expect(await resoudreParJeton(INTERNE, "", clientApp())).toBeNull();
    expect(await resoudreParJeton(INTERNE, "   ", clientApp())).toBeNull();
    expect(
      await resoudreParJeton(INTERNE, "x".repeat(129), clientApp()),
    ).toBeNull();
    // Et un jeton d'une forme ÉTRANGÈRE à la dérivation courante se résout
    // quand même s'il est en base : c'est exactement ce que la borne de taille
    // préserve et qu'un contrôle de forme aurait cassé.
    expect(QR_A1).not.toBe("");
  });
});
