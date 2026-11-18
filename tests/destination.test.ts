import { describe, expect, it } from "vitest";
import { withDestination } from "@/lib/tessera/profile";
import { jordanProfile } from "@/lib/tessera/seed-data";

describe("withDestination", () => {
  it("clears the study location when the country changes", () => {
    const p = withDestination(jordanProfile, "MX");
    expect(p.basics).toMatchObject({ destinationCountry: "MX", studyLocation: "", homeCountry: "United States" });
  });

  it("keeps the study location when the same country is picked again", () => {
    expect(withDestination(jordanProfile, "JP").basics.studyLocation).toBe("Tokyo, Japan");
  });
});
