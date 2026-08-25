import { clientId, clientSecret, googleTokenRequest, setRefreshCookie } from "./_google.js";

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

  const code = req.body && req.body.code;
  if(!code){
    res.status(400).json({ error: "missing_code" });
    return;
  }

  try{
    const { ok, data } = await googleTokenRequest({
      code,
      client_id: clientId(),
      client_secret: secret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code"
    });

    if(!ok || !data.access_token){
      res.status(400).json({ error: (data && data.error) || "exchange_failed" });
      return;
    }

    if(data.refresh_token) setRefreshCookie(res, data.refresh_token);

    res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in || 3600 });
  }catch(e){
    res.status(500).json({ error: "exchange_error" });
  }
}
