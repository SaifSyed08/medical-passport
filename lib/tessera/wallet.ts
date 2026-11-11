// Apple Wallet groundwork. No signing happens here; see docs/WALLET_PLAN.md.
import type { Card } from "@/shared/tessera";

/**
 * Everything a future pass may carry. This is the whole allowed surface: the card URL as a QR,
 * the patient's name, branding and short clinician instructions. Never allergies, conditions,
 * medications or date of birth.
 */
export type PassContent = {
  serialNumber: string;
  organizationName: "Tessera";
  description: string;
  patientName: string;
  qrMessage: string;
  instructions: string;
  voided: boolean;
};
export const PASS_FIELDS = ["serialNumber", "organizationName", "description", "patientName", "qrMessage", "instructions", "voided"] as const;

export const CLINICIAN_INSTRUCTIONS =
  "Clinicians: scan the QR code to request access. You'll confirm the patient's identity and your own authorization. Demo only, not for clinical use.";

export function buildPassContent(card: Pick<Card, "serialNumber" | "cardUrl" | "status">, patientName: string): PassContent {
  return {
    serialNumber: card.serialNumber,
    organizationName: "Tessera",
    description: "Tessera medical card (demo)",
    patientName,
    qrMessage: card.cardUrl,
    instructions: CLINICIAN_INSTRUCTIONS,
    voided: card.status !== "active",
  };
}

export interface PassIssuer {
  /** Returns a signed .pkpass archive for the given pass content. */
  issue(content: PassContent): Promise<Uint8Array<ArrayBuffer>>;
}

export class WalletNotEnabledError extends Error {
  constructor() {
    super("Apple Wallet is not enabled for this demo yet.");
    this.name = "WalletNotEnabledError";
  }
}

/** Placeholder until pass signing exists. Wire a real issuer here; callers depend only on PassIssuer. */
export class NullPassIssuer implements PassIssuer {
  async issue(): Promise<Uint8Array<ArrayBuffer>> {
    throw new WalletNotEnabledError();
  }
}

export const passIssuer: PassIssuer = new NullPassIssuer();
