# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary user: a patient carrying a medical card (demo persona: Alex Morgan, born 1994-06-18). They pull health information from several providers, review it, and want one shareable medical-only card, optionally delivered as a physical card. A professional or responder who reads the card (DOB-gated, via link or card number) is a secondary audience; the owner confirmed the patient as primary.

## Product Purpose
A fictional demo of a "Medical Passport": onboarding, eight simulated health providers, fictional record review, swipeable card styles, address entry, and a saved-cards home with disable/delete and delivery preview. Success is a convincing, honest prototype of the concept. It is not a clinical product.

## Positioning
Multilingual emergency access: the responder view of a card works in English, Spanish and French, detects the browser language, and shows local medicine naming for the supported albuterol fixture. Cards are DOB-gated and expire. Unknown edited text is retained, not silently translated.

## Operating Context
Runs as a Next.js-style app on Cloudflare Workers (D1 + R2). Signed-in users get account-scoped cloud cards; anonymous visitors get browser-local cards that do not transfer between devices. Professional access is explicitly simulated.

## Capabilities and Constraints
- Demo only. No real HealthKit/MyChart integration, credential verification, orders, SMS, or generative AI calls (per README). Do not imply otherwise in UI copy.
- DOB gating is a UX demonstration, not secure authentication.
- Responder-facing views omit shipping and SMS details.
- Optional cropped photo stored in R2.
- Address suggestions use the public Photon service; manual entry must remain available.

## Brand Commitments
The visual lineage is inspired by the existing survey's intro typography and transitions (owner-confirmed as a constraint to preserve). Uses the Austin Regional Clinic logo as a referenced asset (README).

## Evidence on Hand
No real testimonials, customers or benchmarks exist; do not fabricate any. All health data is fictional sample data.

## Product Principles
- Honest about being a demo: never dress fictional behavior as clinical fact.
- The responder sees only what a responder needs, in their language.
- The patient stays in control: review before saving, reversible disable, confirmed delete.
- Guest and signed-in experiences should feel the same.

## Accessibility & Inclusion
Multilingual responder content (en/es/fr). No other product-specific accessibility standard has been established.
