// The access code (npm run phone starts the server locked; the link it prints ends in ?code=…). The server keeps a
// cookie, but a phone that opened the link in its camera's preview browser can lose it, so the page also keeps the
// code itself and sends it with every request: a header on fetches, a query parameter on audio it streams.
const KEY = "ti.code";

const code = (() => {
  try {
    const fromUrl = new URLSearchParams(location.search).get("code");
    if (fromUrl) localStorage.setItem(KEY, fromUrl);
    return fromUrl || localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
})();

export const accessHeaders = (): Record<string, string> => (code ? { "X-Access-Code": code } : {});

/** For URLs the browser fetches itself (an <audio> src), which can't carry a header. */
export const withAccess = (params: Record<string, string>): Record<string, string> => (code ? { ...params, ac: code } : params);
