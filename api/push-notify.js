import { get, put } from "@vercel/blob";
import webpush from "web-push";

const BLOB_PATH = "push-subscriptions.json";
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 200;

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

  const authHeader = req.headers.authorization || "";
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if(!process.env.PUSH_NOTIFY_SECRET || providedSecret !== process.env.PUSH_NOTIFY_SECRET){
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const title = String((req.body && req.body.title) || "").trim().slice(0, MAX_TITLE_LENGTH);
  const body = String((req.body && req.body.body) || "").trim().slice(0, MAX_BODY_LENGTH);
  const url = typeof (req.body && req.body.url) === "string" ? req.body.url : "/";
  if(!title){
    res.status(400).json({ error: "missing_title" });
    return;
  }

  webpush.setVapidDetails(
    "mailto:tokim25@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subscriptions = await loadSubscriptions();
  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  const stale = new Set();
  await Promise.all(subscriptions.map(async sub => {
    try{
      await webpush.sendNotification(sub, payload);
      sent++;
    }catch(e){
      if(e && (e.statusCode === 404 || e.statusCode === 410)) stale.add(sub.endpoint);
    }
  }));

  if(stale.size > 0){
    const remaining = subscriptions.filter(s => !stale.has(s.endpoint));
    await saveSubscriptions(remaining);
  }

  res.status(200).json({ ok: true, sent, total: subscriptions.length, removed: stale.size });
}
