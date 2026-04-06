import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKbxqZBW6NovbiJAFJGyZIQZfYIxGvbN8",
    authDomain: "byhs1-4.firebaseapp.com",
    projectId: "byhs1-4",
    storageBucket: "byhs1-4.firebasestorage.app",
    messagingSenderId: "734684323543",
    appId: "1:734684323543:web:fb7bd8c10e6cfcacabda92"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "kr.craft1016@gmail.com"; 
const dataDoc = doc(db, "classData", "main");

let mealStore = { 1: "정보 없음", 2: "정보 없음", 3: "정보 없음" };
const linkify = (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-500 font-bold underline">$1</a>') : "";

// --- 탭 시스템 ---
const switchTab = (tabId) => {
    ['exam', 'pl', 'meal', 'board'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).className = 'flex-1 py-4 font-bold text-gray-400 transition-all text-[13px]';
    });
    document.getElementById(`content-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).className = 'flex-1 py-4 font-bold tab-active transition-all text-[13px]';
    if(tabId === 'meal') getMeal();
};

document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-pl').onclick = () => switchTab('pl');
document.getElementById('tab-meal').onclick = () => switchTab('meal');
document.getElementById('tab-board').onclick = () => switchTab('board');

// --- 관리자 입력창 동기화 ---
async function refreshAdminInputs() {
    const snap = await getDoc(dataDoc);
    if (snap.exists()) {
        const data = snap.data();
        const fields = {
            'input-date': data.examDate,
            'input-assessments': data.rawAssessments,
            'input-ranges': data.rawRanges,
            'input-notice': data.notice,
            'input-pl': data.plSchedule
        };
        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        }
    }
}

// --- 급식 시스템 ---
async function getMeal() {
    const container = document.getElementById('meal-display-container');
    try {
        const now = new Date();
        const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const key = "3366de199e3b43ccb46803dcdceb0a92";
        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${key}&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;
        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "급식 정보가 없습니다.";
        });
        const hourMin = now.getHours() * 100 + now.getMinutes();
        showMeal(hourMin < 830 ? 1 : (hourMin < 1330 ? 2 : 3));
    } catch (e) { container.innerHTML = "급식 서버 로드 실패"; }
}

function showMeal(type) {
    const container = document.getElementById('meal-display-container');
    const cfg = { 1: ['orange', '아침'], 2: ['emerald', '점심'], 3: ['indigo', '저녁'] }[type];
    [1,2,3].forEach(t => {
        const btn = document.getElementById(`btn-meal-${t}`);
        if(btn) btn.className = t === type ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg[0]}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
    });
    container.innerHTML = `<div class="w-full bg-${cfg[0]}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs text-${cfg[0]}-400 font-black mb-2">${cfg[1]}</p><p class="text-lg font-extrabold break-keep">${mealStore[type]}</p></div>`;
}
[1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).onclick = () => showMeal(t));

// --- 실시간 데이터 렌더링 ---
onSnapshot(dataDoc, (snap) => {
    const data = snap.exists() ? snap.data() : { 
        examDate: "2026-05-01", 
        notice: "공지사항이 없습니다.", 
        plSchedule: "일정이 없습니다.",
        rawAssessments: "", rawRanges: ""
    };

    // D-Day
    const diff = new Date(data.examDate) - new Date();
    document.getElementById('exam-dday').innerText = diff > 0 ? `D-${Math.ceil(diff/(1000*60*60*24))}` : "종료";
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    // PL 리그
    const plEl = document.getElementById('pl-main-content');
    const plRaw = data.plSchedule || "";
    const plMatch = plRaw.match(/(\d{1,2})[./](\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if(plMatch) {
        const gameDate = new Date(new Date().getFullYear(), parseInt(plMatch[1])-1, parseInt(plMatch[2]), parseInt(plMatch[3]), parseInt(plMatch[4]));
        const tDiff = gameDate - new Date();
        if(tDiff > 0) {
            const h = Math.floor(tDiff/(1000*60*60));
            plEl.innerHTML = `<div class="animate-fadeIn"><span class="bg-cyan-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-pulse uppercase">Next Match</span><h3 class="text-5xl font-black mt-6 mb-4 text-white">${h > 24 ? 'D-'+Math.floor(h/24) : h+'시간 전'}</h3><p class="text-slate-400 font-medium">${linkify(plRaw)}</p></div>`;
        } else {
            plEl.innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-3xl border border-slate-700 text-left animate-fadeIn"><p class="text-cyan-400 font-bold text-xs mb-2 italic">Match Info</p><p class="text-xl font-bold">${linkify(plRaw)}</p></div>`;
        }
    } else { plEl.innerHTML = `<p class="text-slate-500">${linkify(plRaw || "등록된 일정이 없습니다.")}</p>`; }

    // 수행평가
    const list = document.getElementById('assessment-list');
    list.innerHTML = "";
    const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
    rows.forEach(r => {
        const [subj, cont, date] = r.split('|');
        list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${subj}</td><td class="p-4 text-gray-600">${linkify(cont)}</td><td class="p-4 text-right font-bold text-slate-400">${date}</td></tr>`;
    });

    // 시험범위
    const rCont = document.getElementById('range-cards');
    rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').forEach(l => {
        if(l.includes(':')) {
            const [t, d] = l.split(':');
            rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-indigo-50 animate-fadeIn"><h3 class="font-bold text-indigo-700 text-lg mb-2">${t}</h3><p class="text-slate-600 text-sm">${linkify(d)}</p></div>`;
        }
    });
});

// --- 인증 및 관리자 기능 ---
onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('loginBtn');
    if (user && user.email === ADMIN_EMAIL) {
        adminPanel.classList.remove('hidden');
        loginBtn.innerText = "LOGOUT";
        await refreshAdminInputs();
    } else {
        adminPanel.classList.add('hidden');
        loginBtn.innerText = "ADMIN";
    }
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});

document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("서버에 저장할까요?")) return;
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value
    }, { merge: true });
    alert("저장 성공!");
};
