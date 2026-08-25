import { getRefreshCookie, clearRefreshCookie } from "./_google.js";

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const refreshToken = getRefreshCookie(req);
  clearRefreshCookie(res);

  if(refreshToken){
    try{
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken })
      });
    }catch(e){
      // best-effort — the cookie is already cleared either way
    }
  }

  res.status(200).json({ ok: true });
}
