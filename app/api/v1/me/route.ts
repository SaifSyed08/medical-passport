import { DEMO_NOTICE, type Me } from "@/shared/tessera";
import { v1flags, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ traveler }) => {
  const f = v1flags();
  const me: Me = {
    traveler: { id: traveler.id, name: traveler.name, dob: traveler.dob },
    language: traveler.language,
    autoApprove: traveler.autoApprove,
    walletEnabled: f.walletEnabled,
    presenterEnabled: f.presenterEnabled,
    demoNotice: DEMO_NOTICE,
  };
  return v1json(me);
});
