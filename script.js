import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- [A] 로그인/로그아웃 로직 ---
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.onclick = async () => {
        if (auth.currentUser) {
            if (confirm("로그아웃 하시겠습니까?")) await signOut(auth);
        } else {
            try { await signInWithPopup(auth, provider); } 
            catch (e) { alert("로그인 실패: " + e.message); }
        }
    };
}

onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const postInput = document.getElementById('post-input-section');
    const postMsg = document.getElementById('post-login-msg');
    if (user) {
        loginBtn.innerText = "LOGOUT";
        if (postInput) postInput.classList.remove('hidden');
        if (postMsg) postMsg.classList.add('hidden');
        if (user.email === ADMIN_EMAIL) {
            adminPanel.classList.remove('hidden');
            const snap = await getDoc(dataDoc);
            if (snap.exists()) {
                const d = snap.data();
                document.getElementById('input-date').value = d.examDate || "";
                document.getElementById('input-assessments').value = d.rawAssessments || "";
                document.getElementById('input-ranges').value = d.rawRanges || "";
                document.getElementById('input-notice').value = d.notice || "";
                document.getElementById('input-pl').value = d.plSchedule || "";
            }
        }
    } else {
        loginBtn.innerText = "ADMIN";
        if (adminPanel) adminPanel.classList.add('hidden');
        if (postInput) postInput.classList.add('hidden');
        if (postMsg) postMsg.classList.remove('hidden');
    }
});

// --- [B] 가장 빠른 수행평가 계산 ---
function getNearest(raw) {
    const lines = raw.split('\n').filter(l => l.includes('|'));
    if (lines.length === 0) return "--";
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let minDiff = Infinity;
    let nearestSubj = "";
    lines.forEach(line => {
        const [subj, , dateStr] = line.split('|');
        const [m, d] = dateStr.split('.').map(Number);
        const target = new Date(now.getFullYear(), m - 1, d);
        target.setHours(0, 0, 0, 0);
        const diff = target - now;
        if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            nearestSubj = subj;
        }
    });
    const dday = Math.ceil(minDiff / (1000 * 60 * 60 * 24));
    return nearestSubj ? `<p class="text-red-600 font-black text-2xl">D-${dday}</p><p class="text-gray-700 text-[10px] font-bold mt-1">${nearestSubj}</p>` : "--";
}

// --- [C] 실시간 데이터 렌더링 (디데이 수정됨) ---
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // 시험 D-Day 칼계산
    if (data.examDate) {
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(data.examDate); target.setHours(0,0,0,0);
        const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = diff > 0 ? `D-${diff}` : (diff === 0 ? "D-Day🔥" : "종료");
    }

    document.getElementById('nearest-assessment').innerHTML = getNearest(data.rawAssessments || "");
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    const list = document.getElementById('assessment-list');
    list.innerHTML = "";
    (data.rawAssessments || "").split('\n').filter(r => r.includes('|')).forEach(r => {
        const [s, c, d] = r.split('|');
        list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${s}</td><td class="p-4 text-gray-600">${linkify(c)}</td><td class="p-4 text-right font-bold text-slate-400">${d}</td></tr>`;
    });

    const rCont = document.getElementById('range-cards');
    rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').filter(l => l.includes(':')).forEach(l => {
        const [t, d] = l.split(':');
        rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-indigo-50 animate-fadeIn"><h3 class="font-bold text-indigo-700 text-lg mb-2">${t}</h3><p class="text-slate-600 text-sm">${linkify(d)}</p></div>`;
    });

    const plEl = document.getElementById('pl-main-content');
    const plRaw = data.plSchedule || "";
    const plMatch = plRaw.match(/(\d{1,2})[./](\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if(plMatch) {
        const gDate = new Date(new Date().getFullYear(), parseInt(plMatch[1])-1, parseInt(plMatch[2]), parseInt(plMatch[3]), parseInt(plMatch[4]));
        const tDiff = gDate - new Date();
        if(tDiff > 0) {
            const h = Math.floor(tDiff/(1000*60*60));
            plEl.innerHTML = `<div class="animate-fadeIn"><span class="bg-cyan-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">NEXT MATCH</span><h3 class="text-5xl font-black mt-6 mb-4 text-white">${h > 24 ? 'D-'+Math.floor(h/24) : h+'시간 전'}</h3><p class="text-slate-400 font-medium">${linkify(plRaw)}</p></div>`;
        } else {
            plEl.innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-3xl border border-slate-700 text-left animate-fadeIn"><p class="text-xl font-bold">${linkify(plRaw)}</p></div>`;
        }
    } else { plEl.innerHTML = `<p class="text-slate-500">${linkify(plRaw || "일정 없음")}</p>`; }
});

// --- [D] 게시판 시스템 ---
const addPostBtn = document.getElementById('addPostBtn');
const postText = document.getElementById('post-text');
onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
    const postList = document.getElementById('post-list');
    postList.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const div = document.createElement('div');
        div.className = "card !p-5 bg-white border border-gray-100 animate-fadeIn relative";
        let delBtn = (auth.currentUser?.email === ADMIN_EMAIL) ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-red-400 text-[10px] ml-2">삭제</button>` : "";
        div.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-2">${p.user}</span>${delBtn}</div><span>${p.createdAt?.toDate().toLocaleString().slice(5, 16) || "방금 전"}</span></div><p class="text-sm text-slate-700 whitespace-pre-wrap">${linkify(p.text)}</p>`;
        postList.appendChild(div);
    });
});
window.deletePost = async (id) => { if(confirm("삭제?")) await deleteDoc(doc(db, "posts", id)); };
addPostBtn.onclick = async () => {
    if (!postText.value.trim()) return;
    await addDoc(collection(db, "posts"), { user: auth.currentUser.displayName || "익명", text: postText.value, createdAt: serverTimestamp() });
    postText.value = "";
};

// --- [E] 급식 및 탭 (날짜 수정됨) ---
const switchTab = (id) => {
    ['exam', 'pl', 'meal', 'board'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).className = 'flex-1 py-4 font-bold text-gray-400 transition-all text-[13px]';
    });
    document.getElementById(`content-${id}`).classList.remove('hidden');
    document.getElementById(`tab-${id}`).className = 'flex-1 py-4 font-bold tab-active transition-all text-[13px]';
    if(id === 'meal') getMeal();
};
['exam', 'pl', 'meal', 'board'].forEach(t => document.getElementById(`tab-${t}`).onclick = () => switchTab(t));

async function getMeal() {
    const now = new Date();
    const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=3366de199e3b43ccb46803dcdceb0a92&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;
    try {
        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "급식 정보가 없습니다.";
        });
        const hm = now.getHours() * 100 + now.getMinutes();
        showMeal(hm < 830 ? 1 : (hm < 1330 ? 2 : 3));
    } catch (e) { console.error(e); }
}
function showMeal(type) {
    const container = document.getElementById('meal-display-container');
    const cfg = { 1: ['orange', '아침'], 2: ['emerald', '점심'], 3: ['indigo', '저녁'] }[type];
    [1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).className = t === type ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg[0]}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`);
    container.innerHTML = `<div class="w-full bg-${cfg[0]}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs text-${cfg[0]}-400 font-black mb-2">${cfg[1]}</p><p class="text-lg font-extrabold break-keep text-slate-800">${mealStore[type]}</p></div>`;
}
[1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).onclick = () => showMeal(t));

document.getElementById('saveBtn').onclick = async () => {
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value
    }, { merge: true });
    alert("저장 완료!");
};
