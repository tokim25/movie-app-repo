import { get, put } from "@vercel/blob";

const BLOB_PATH = "push-subscriptions.json";

async function loadSubscriptions(){
  try{
    const result = await get(BLOB_PATH, { access: "private" });
    if(!result || result.statusCode !== 200) return [];
    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  }catch(e){
    return [];
  }
}

async function saveSubscriptions(list){
  await put(BLOB_PATH, JSON.stringify(list), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true
  });
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const endpoint = req.body && req.body.endpoint;
  if(typeof endpoint !== "string" || !endpoint){
    res.status(400).json({ error: "missing_endpoint" });
    return;
  }

  try{
    const subscriptions = await loadSubscriptions();
    const remaining = subscriptions.filter(s => s.endpoint !== endpoint);
    await saveSubscriptions(remaining);
    res.status(200).json({ ok: true });
  }catch(e){
    res.status(502).json({ error: "unsubscribe_failed" });
  }
}
