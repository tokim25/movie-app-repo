import { get, put } from "@vercel/blob";

const BLOB_PATH = "push-subscriptions.json";
const MAX_SUBSCRIPTIONS = 50;

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

function isValidSubscription(sub){
  return Boolean(sub && typeof sub.endpoint === "string" && sub.endpoint && sub.keys && typeof sub.keys.p256dh === "string" && typeof sub.keys.auth === "string");
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const subscription = req.body && req.body.subscription;
  if(!isValidSubscription(subscription)){
    res.status(400).json({ error: "invalid_subscription" });
    return;
  }

  try{
    const subscriptions = await loadSubscriptions();
    const deduped = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
    deduped.push(subscription);
    while(deduped.length > MAX_SUBSCRIPTIONS) deduped.shift();
    await saveSubscriptions(deduped);
    res.status(200).json({ ok: true });
  }catch(e){
    res.status(502).json({ error: "subscribe_failed" });
  }
}
