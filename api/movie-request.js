const REQUEST_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf6gLu-Z9LO-ZnPQ70yuOmYC8_9O1Jk7Kwsk0BF-FepiWH8tQ/formResponse";
const REQUEST_TITLE_FIELD = "entry.1104459577";
const MAX_TITLE_LENGTH = 120;

function normalizeTitle(value){
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const title = normalizeTitle(req.body && req.body.title);
  if(!title){
    res.status(400).json({ error: "missing_title" });
    return;
  }

  try{
    const upstream = await fetch(REQUEST_FORM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ [REQUEST_TITLE_FIELD]: title })
    });

    if(!upstream.ok){
      res.status(502).json({ error: "request_failed" });
      return;
    }

    res.status(200).json({ ok: true });
  }catch(e){
    res.status(502).json({ error: "request_failed" });
  }
}
