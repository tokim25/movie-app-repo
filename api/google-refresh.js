import { clientId, clientSecret, getRefreshCookie, googleTokenRequest, setRefreshCookie, clearRefreshCookie } from "./_google.js";

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const secret = clientSecret();
  if(!secret){
    res.status(500).json({ error: "server_not_configured" });
    return;
  }

  const refreshToken = getRefreshCookie(req);
  if(!refreshToken){
    res.status(401).json({ error: "no_refresh_token" });
    return;
  }

  try{
    const { ok, data } = await googleTokenRequest({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: secret,
      grant_type: "refresh_token"
    });

    if(!ok || !data.access_token){
      // Refresh token is no longer valid (revoked, or unused for 6+ months) — drop it
      // so the client falls back to a real reconnect instead of retrying forever.
      clearRefreshCookie(res);
      res.status(401).json({ error: (data && data.error) || "refresh_failed" });
      return;
    }

    // Google usually doesn't rotate the refresh token on a plain refresh call,
    // but re-set it (and push the expiry back out) whenever it does.
    if(data.refresh_token) setRefreshCookie(res, data.refresh_token);

    res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in || 3600 });
  }catch(e){
    res.status(500).json({ error: "refresh_error" });
  }
}
