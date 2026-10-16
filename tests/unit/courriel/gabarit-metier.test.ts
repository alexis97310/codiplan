import { describe, expect, it } from "vitest";

import { echapperHtml, miseEnPageMetier } from "@/lib/courriel/gabarit-metier";

/**
 * LE GABARIT HTML DES COURRIELS MÉTIER (D207, 9EZ-LOGO-SOCIETE-2) — fonction
 * pure, éprouvée sans réseau : l'échappement, le logo présent/absent, le pied.
 */

describe("échapperHtml neutralise les cinq caractères", () => {
  it("transforme & < > \" ' et rien d'autre", () => {
    expect(echapperHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
    expect(echapperHtml("rien à changer ici")).toBe("rien à changer ici");
  });
});

describe("miseEnPageMetier échappe TOUTE valeur insérée", () => {
  it("un nom de client porteur de <script> apparaît comme TEXTE, jamais comme balise", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA" },
      titre: "Votre intervention est annulée",
      paragraphes: [
        "<script>alert(1)</script>",
        'Motif : "></p><img src=x onerror=alert(2)>',
      ],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/<img src=x onerror=/);
    expect(html).toContain("&quot;&gt;&lt;/p&gt;&lt;img");
  });

  it("une raison sociale porteuse de guillemets ne casse pas l'attribut alt", () => {
    const html = miseEnPageMetier({
      societe: {
        raisonSociale: `Société "Test" & Fils`,
        logo: { cid: "logo-societe" },
      },
      titre: "t",
      paragraphes: ["p"],
    });
    expect(html).toContain('alt="Société &quot;Test&quot; &amp; Fils"');
  });
});

describe("le logo — présent ou absent", () => {
  it("avec un logo, une balise img référence SON cid, jamais une URL", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA", logo: { cid: "logo-societe" } },
      titre: "t",
      paragraphes: ["p"],
    });
    expect(html).toContain('src="cid:logo-societe"');
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/src="data:/);
  });

  it("sans logo, aucune balise img — nom de la société seul", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA" },
      titre: "t",
      paragraphes: ["p"],
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("CODIMA");
  });
});

describe("le pied — présent ou absent", () => {
  it("absent, aucune ligne de pied supplémentaire", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA" },
      titre: "t",
      paragraphes: ["p"],
    });
    expect(html).not.toContain("border-top:1px solid #e5e7eb");
  });

  it("présent, les mentions légales apparaissent, échappées", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA" },
      titre: "t",
      paragraphes: ["p"],
      pied: "RCS Nouméa & Cie",
    });
    expect(html).toContain("RCS Nouméa &amp; Cie");
  });
});

describe("pas de ressource distante, aucun script", () => {
  it("ni <style> externe, ni <script>, ni police ni image distante", () => {
    const html = miseEnPageMetier({
      societe: { raisonSociale: "CODIMA", logo: { cid: "logo-societe" } },
      titre: "t",
      paragraphes: ["p1", "p2"],
      pied: "pied",
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/fonts\.googleapis/);
  });
});
