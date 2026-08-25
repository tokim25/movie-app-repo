const DEFAULT_CLIENT_ID = "987776124251-t4skn7ia6qd1r88ftass906jinm98v1q.apps.googleusercontent.com";
const REFRESH_COOKIE = "gsync_rt";
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days, refreshed on every use

export function clientId(){
  return process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
}

export function clientSecret(){
  return process.env.GOOGLE_CLIENT_SECRET || "";
}

export function getCookie(req, name){
  const header = req.headers.cookie;
  if(!header) return null;
  for(const part of header.split(";")){
    const idx = part.indexOf("=");
    if(idx === -1) continue;
    if(part.slice(0, idx).trim() === name){
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function getRefreshCookie(req){
  return getCookie(req, REFRESH_COOKIE);
}

export function setRefreshCookie(res, token){
  res.setHeader(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFRESH_COOKIE_MAX_AGE}`
  );
}

export function clearRefreshCookie(res){
  res.setHeader("Set-Cookie", `${REFRESH_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export async function googleTokenRequest(params){
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
