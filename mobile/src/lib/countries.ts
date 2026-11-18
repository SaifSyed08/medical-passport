// Countries the medicine converter offers on either side: the web app's list (interpreter/src/lib/langs.ts
// COUNTRIES, where its checked medicine table lives) plus every study-abroad destination.
import { DESTINATIONS } from "@shared/tessera";

const WEB_APP: [string, string][] = [
  ["US", "United States"], ["NP", "Nepal"], ["MX", "Mexico"], ["JP", "Japan"], ["GB", "United Kingdom"], ["IN", "India"],
  ["PK", "Pakistan"], ["ES", "Spain"], ["FR", "France"], ["DE", "Germany"], ["IT", "Italy"], ["BR", "Brazil"], ["CN", "China"],
  ["KR", "South Korea"], ["CA", "Canada"], ["PH", "Philippines"], ["VN", "Vietnam"], ["TR", "Turkey"], ["AU", "Australia"],
];

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = (() => {
  const byCode = new Map<string, string>(WEB_APP);
  for (const d of DESTINATIONS) if (!byCode.has(d.code)) byCode.set(d.code, d.name.replace(/\s*\(.*\)$/, ""));
  return [...byCode].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
})();

export const countryName = (code: string | null | undefined) => COUNTRIES.find(c => c.code === code)?.name ?? code ?? "";
