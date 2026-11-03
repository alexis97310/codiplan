import { describe, expect, it } from "vitest";

import {
  detecterEtatInstallation,
  detecterPlateforme,
} from "@/lib/pwa/installation";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.113 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const BUREAU_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

describe("detecterEtatInstallation", () => {
  it("rend « deja_installee » dès que le mode autonome est actif, quel que soit l'agent", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: true,
        invitationAndroidDisponible: false,
        userAgent: IPHONE_SAFARI,
      }),
    ).toBe("deja_installee");

    expect(
      detecterEtatInstallation({
        modeAutonome: true,
        invitationAndroidDisponible: true,
        userAgent: ANDROID_CHROME,
      }),
    ).toBe("deja_installee");
  });

  it("rend « android_chrome » quand une invitation a été captée", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: false,
        invitationAndroidDisponible: true,
        userAgent: ANDROID_CHROME,
      }),
    ).toBe("android_chrome");
  });

  it("rend « ios_safari » sur iPhone/iPad Safari, sans invitation possible", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: false,
        invitationAndroidDisponible: false,
        userAgent: IPHONE_SAFARI,
      }),
    ).toBe("ios_safari");
  });

  it("rend « autre » sur iPhone Chrome (CriOS) — Safari seul sait installer", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: false,
        invitationAndroidDisponible: false,
        userAgent: IPHONE_CHROME,
      }),
    ).toBe("autre");
  });

  it("rend « autre » sur un navigateur de bureau sans invitation", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: false,
        invitationAndroidDisponible: false,
        userAgent: BUREAU_CHROME,
      }),
    ).toBe("autre");
  });

  it("rend « autre » sur Android avant que le navigateur n'émette son invitation", () => {
    expect(
      detecterEtatInstallation({
        modeAutonome: false,
        invitationAndroidDisponible: false,
        userAgent: ANDROID_CHROME,
      }),
    ).toBe("autre");
  });
});

describe("detecterPlateforme", () => {
  it("rend « ios » sur iPhone ou iPad, quel que soit le navigateur", () => {
    expect(detecterPlateforme(IPHONE_SAFARI)).toBe("ios");
    expect(detecterPlateforme(IPHONE_CHROME)).toBe("ios");
  });

  it("rend « android » sur un appareil Android", () => {
    expect(detecterPlateforme(ANDROID_CHROME)).toBe("android");
  });

  it("rend « autre » sur un navigateur de bureau", () => {
    expect(detecterPlateforme(BUREAU_CHROME)).toBe("autre");
  });
});
