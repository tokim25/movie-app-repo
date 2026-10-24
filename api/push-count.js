import { get } from "@vercel/blob";

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

// Read-only counterpart to push-notify: answers "how many devices opted in"
// without sending anything. Gated by the same shared secret -- the number
// isn't sensitive, but there's no reason to let anyone poll it either.
export default async function handler(req, res){
  if(req.method !== "GET"){
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if(!process.env.PUSH_NOTIFY_SECRET || providedSecret !== process.env.PUSH_NOTIFY_SECRET){
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const subscriptions = await loadSubscriptions();
  res.status(200).json({ ok: true, subscribers: subscriptions.length });
}
