const PREFIX = "monAnkiStudySeconds:";
const DEVICE_KEY = "monAnkiStudyDeviceId";
const deviceId = localStorage.getItem(DEVICE_KEY) || ("device-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
localStorage.setItem(DEVICE_KEY, deviceId);
const $ = id => document.getElementById(id);
const timerElement = $("study-timer");
const statsPage = Boolean($("study-history"));
let lastTick = Date.now(), lastSync = 0, cloudStats = [], firebase = null;
function dateKey(date = new Date()) { return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0"); }
function key(date = dateKey()) { return PREFIX + date; }
function localSeconds(date = dateKey()) { return Math.max(0, Number(localStorage.getItem(key(date))) || 0); }
function formatTime(seconds) { seconds = Math.max(0, Math.floor(seconds || 0)); const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60); if(h) return h + " h " + String(m).padStart(2,"0") + " min"; if(m) return m + " min"; return seconds + " s"; }
function renderTimer() { if(timerElement) timerElement.textContent = "Temps étudié aujourd’hui : " + formatTime(localSeconds()); }
async function syncCloud() { if(!firebase || !navigator.onLine) return; try { await firebase.saveStudyTime(dateKey(), deviceId, localSeconds()); if(statsPage) { cloudStats = await firebase.loadStudyTimeStats() || []; renderHistory(); } lastSync = Date.now(); } catch(error) { console.warn("Synchronisation du temps d’étude reportée.", error); } }
async function setup() { try { firebase = await import("./firebase.js"); await firebase.waitForAuth(); await syncCloud(); if(statsPage) { cloudStats = await firebase.loadStudyTimeStats() || []; renderHistory(); } } catch(error) { console.warn("Statistiques cloud indisponibles ; conservation locale.", error); } }
function renderHistory() { const list = $("study-history"); if(!list) return; const days = new Map(); cloudStats.forEach(item => { if(item.date) days.set(item.date, (days.get(item.date)||0) + Math.max(0, Number(item.seconds)||0)); }); days.set(dateKey(), Math.max(days.get(dateKey())||0, localSeconds())); const today = dateKey(), values=[]; for(let i=0;i<30;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=dateKey(d); values.push({date:k,seconds:days.get(k)||0}); } const studied=values.filter(v=>v.seconds>0), avg=studied.length?studied.reduce((s,v)=>s+v.seconds,0)/studied.length:0; $("study-today").textContent=formatTime(days.get(today)||0); $("study-average").textContent=formatTime(avg)+" / jour"; list.innerHTML=""; values.forEach(item=>{ const row=document.createElement("div"); row.className="history-row"; const label=document.createElement("span"); label.textContent=item.date===today?"Aujourd’hui":new Date(item.date+"T12:00:00").toLocaleDateString("fr-BE",{weekday:"short",day:"2-digit",month:"2-digit"}); const amount=document.createElement("strong"); amount.textContent=formatTime(item.seconds); row.append(label,amount); list.appendChild(row); }); $("study-sync-note").textContent="Connecte-toi au même compte Google sur ton téléphone et ton PC pour additionner les temps des deux appareils."; }
if(statsPage) { $("refresh-study-stats").addEventListener("click", async()=>{ await syncCloud(); renderHistory(); }); renderHistory(); }
renderTimer(); setup();
setInterval(()=>{ const now=Date.now(); if(!statsPage && !document.hidden){ const elapsed=Math.min(5,Math.max(0,(now-lastTick)/1000)); localStorage.setItem(key(),String(Math.floor(localSeconds()+elapsed))); renderTimer(); if(now-lastSync>=15000) void syncCloud(); } lastTick=now; },1000);
document.addEventListener("visibilitychange",()=>{lastTick=Date.now(); if(document.hidden){if(!statsPage) void syncCloud();} else {renderTimer(); if(statsPage) void syncCloud();}});
window.addEventListener("pagehide",()=>void syncCloud()); window.addEventListener("online",()=>void syncCloud());