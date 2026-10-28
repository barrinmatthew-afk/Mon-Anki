const PREFIX = "monAnkiStudySeconds:";
const SUBJECT_PREFIX = "monAnkiStudyBySubject:";
const DEVICE_KEY = "monAnkiStudyDeviceId";
const deviceId = localStorage.getItem(DEVICE_KEY) || ("device-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
localStorage.setItem(DEVICE_KEY, deviceId);
const $ = id => document.getElementById(id);
const timerElement = $("study-timer");
const statsPage = Boolean($("study-history"));
let lastTick = Date.now(), lastSync = 0, cloudStats = [], firebase = null;

function dateKey(date = new Date()) {
    return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
}
function key(date = dateKey()) { return PREFIX + date; }
function subjectKey(date = dateKey()) { return SUBJECT_PREFIX + date; }
function localSeconds(date = dateKey()) { return Math.max(0, Number(localStorage.getItem(key(date))) || 0); }
function readSubjects(date = dateKey()) {
    try { return JSON.parse(localStorage.getItem(subjectKey(date)) || "{}") || {}; }
    catch { return {}; }
}
function currentSubject() {
    const deckName = localStorage.getItem("selectedDeck") || "Non classé";
    return deckName.split("::")[0].trim() || "Non classé";
}
function addStudySeconds(seconds) {
    const today = dateKey();
    localStorage.setItem(key(today), String(localSeconds(today) + seconds));
    const subjects = readSubjects(today);
    const name = currentSubject();
    subjects[name] = Math.max(0, Number(subjects[name]) || 0) + seconds;
    localStorage.setItem(subjectKey(today), JSON.stringify(subjects));
}
function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60);
    if(h) return h + " h " + String(m).padStart(2,"0") + " min";
    if(m) return m + " min";
    return seconds + " s";
}
function renderTimer() {
    if(timerElement) timerElement.textContent = "Temps étudié aujourd’hui : " + formatTime(localSeconds());
}
async function syncCloud() {
    if(!firebase || !navigator.onLine) return;
    try {
        await firebase.saveStudyTime(dateKey(), deviceId, localSeconds(), readSubjects());
        if(statsPage) {
            cloudStats = await firebase.loadStudyTimeStats() || [];
            renderHistory();
        }
        lastSync = Date.now();
    } catch(error) { console.warn("Synchronisation du temps d’étude reportée.", error); }
}
async function setup() {
    try {
        firebase = await import("./firebase.js");
        await firebase.waitForAuth();
        await syncCloud();
        if(statsPage) {
            cloudStats = await firebase.loadStudyTimeStats() || [];
            renderHistory();
        }
    } catch(error) { console.warn("Statistiques cloud indisponibles ; conservation locale.", error); }
}
function combineStats() {
    const days = new Map();
    cloudStats.forEach(item => {
        if (!item.date) return;
        const entry = days.get(item.date) || { seconds: 0, subjects: {} };
        entry.seconds += Math.max(0, Number(item.seconds) || 0);
        Object.entries(item.subjectSeconds || {}).forEach(([name, seconds]) => {
            entry.subjects[name] = (entry.subjects[name] || 0) + Math.max(0, Number(seconds) || 0);
        });
        days.set(item.date, entry);
    });
    const today = dateKey();
    const entry = days.get(today) || { seconds: 0, subjects: {} };
    entry.seconds = Math.max(entry.seconds, localSeconds());
    const localSubjects = readSubjects(today);
    Object.entries(localSubjects).forEach(([name, seconds]) => {
        entry.subjects[name] = Math.max(entry.subjects[name] || 0, Number(seconds) || 0);
    });
    days.set(today, entry);
    return days;
}
function renderHistory() {
    const list = $("study-history");
    if(!list) return;
    const days = combineStats(), today = dateKey(), values = [];
    for(let i=0;i<30;i++) {
        const d = new Date(); d.setDate(d.getDate()-i);
        const k = dateKey(d), entry = days.get(k) || { seconds: 0, subjects: {} };
        values.push({ date:k, seconds:entry.seconds, subjects:entry.subjects });
    }
    const studied = values.filter(v=>v.seconds>0);
    const avg = studied.length ? studied.reduce((s,v)=>s+v.seconds,0)/studied.length : 0;
    $("study-today").textContent = formatTime((days.get(today)||{}).seconds || 0);
    $("study-average").textContent = formatTime(avg) + " / jour";
    renderSubjectChart(values);
    list.innerHTML = "";
    values.forEach(item => {
        const row = document.createElement("div"); row.className = "history-row";
        const label = document.createElement("span");
        label.textContent = item.date===today ? "Aujourd’hui" : new Date(item.date+"T12:00:00").toLocaleDateString("fr-BE",{weekday:"short",day:"2-digit",month:"2-digit"});
        const amount = document.createElement("strong"); amount.textContent = formatTime(item.seconds);
        row.append(label,amount);
        if(item.seconds > 0) {
            const segments = document.createElement("div"); segments.className = "history-stacked";
            const totalBySubject = Object.values(item.subjects).reduce((s,n)=>s+n,0);
            if(totalBySubject > 0) Object.entries(item.subjects).forEach(([name,seconds])=>{
                const seg = document.createElement("span");
                seg.style.width = (seconds/totalBySubject*100)+"%";
                seg.style.background = subjectColor(name);
                seg.title = name + " : " + formatTime(seconds);
                segments.appendChild(seg);
            });
            row.appendChild(segments);
        }
        list.appendChild(row);
    });
    $("study-sync-note").textContent = "Le temps est classé par matière selon le deck étudié (le nom avant « :: »). Pour additionner téléphone et PC, connecte-toi au même compte Google sur les deux appareils.";
}
function subjectColor(name) {
    const palette = ["#2563eb","#0f766e","#c2410c","#7c3aed","#be185d","#4d7c0f","#0369a1","#a16207","#475569","#0e7490","#9333ea","#b91c1c"];
    let hash=0; for(const c of name) hash=(hash*31+c.charCodeAt(0))>>>0;
    return palette[hash%palette.length];
}
function renderSubjectChart(values) {
    const chart = $("subject-chart"), legend = $("subject-legend");
    if(!chart || !legend) return;
    const totals = {};
    values.forEach(day=>Object.entries(day.subjects).forEach(([name,seconds])=>totals[name]=(totals[name]||0)+seconds));
    const entries = Object.entries(totals).filter(([,seconds])=>seconds>0).sort((a,b)=>b[1]-a[1]);
    chart.replaceChildren(); legend.replaceChildren();
    if(!entries.length) {
        chart.textContent = "Pas encore de données par matière. Lance une session de révision pour commencer.";
        return;
    }
    const max = entries[0][1];
    entries.forEach(([name,seconds])=>{
        const row = document.createElement("div"); row.className="subject-row";
        const label = document.createElement("div"); label.className="subject-label"; label.textContent=name;
        const barTrack = document.createElement("div"); barTrack.className="subject-track";
        const bar = document.createElement("div"); bar.className="subject-bar";
        bar.style.width=Math.max(2,seconds/max*100)+"%"; bar.style.background=subjectColor(name);
        barTrack.appendChild(bar);
        const amount = document.createElement("strong"); amount.textContent=formatTime(seconds);
        row.append(label,barTrack,amount); chart.appendChild(row);
        const key = document.createElement("span"); key.className="subject-key";
        const dot = document.createElement("i"); dot.style.background=subjectColor(name);
        const text = document.createElement("span"); text.textContent=name;
        key.append(dot,text); legend.appendChild(key);
    });
}
if(statsPage) { $("refresh-study-stats").addEventListener("click", async()=>{ await syncCloud(); renderHistory(); }); renderHistory(); }
renderTimer();
setup();
setInterval(()=>{
    const now=Date.now();
    if(!statsPage && !document.hidden) {
        const elapsed=Math.min(5,Math.max(0,(now-lastTick)/1000));
        addStudySeconds(elapsed); renderTimer();
        if(now-lastSync>=15000) void syncCloud();
    }
    lastTick=now;
},1000);
document.addEventListener("visibilitychange",()=>{lastTick=Date.now(); if(document.hidden){if(!statsPage) void syncCloud();} else {renderTimer(); if(statsPage) void syncCloud();}});
window.addEventListener("pagehide",()=>void syncCloud());
window.addEventListener("online",()=>void syncCloud());
