import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, limit, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 파이어베이스 설정
const firebaseConfig = {
    apiKey: "AIzaSyBiUbjpxKMTr96tSoBwwgFn8-5NTCLEnJ8",
    authDomain: "byhs1-4-de284.firebaseapp.com",
    projectId: "byhs1-4-de284",
    storageBucket: "byhs1-4-de284.firebasestorage.app",
    messagingSenderId: "732735890321",
    appId: "1:732735890321:web:230c9225b7dbd1f22f7030"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// 2. 관리자 이메일 목록
const ADMIN_EMAILS = ["kr.craft1016@gmail.com", "26bh1401@g.cnees.kr"];
const dataDoc = doc(db, "classData", "main");

// 유틸리티 함수
const linkify = (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-500 font-bold underline">$1</a>') : "";

// --- [A] 로그인 및 관리자 상태 감지 ---
onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const postInput = document.getElementById('post-input-section');
    const postMsg = document.getElementById('post-login-msg');
    const loginBtn = document.getElementById('loginBtn');
    
    if (user) {
        loginBtn.innerText = "LOGOUT";
        if (postInput) postInput.classList.remove('hidden');
        if (postMsg) postMsg.classList.add('hidden');
        
        if (ADMIN_EMAILS.includes(user.email)) {
            adminPanel.classList.remove('hidden');
            const snap = await getDoc(dataDoc);
            if (snap.exists()) {
                const d = snap.data();
                document.getElementById('input-date').value = d.examDate || "";
                document.getElementById('input-assessments').value = d.rawAssessments || "";
                document.getElementById('input-ranges').value = d.rawRanges || "";
                document.getElementById('input-notice').value = d.notice || "";
                document.getElementById('input-pl').value = d.plSchedule || "";
                document.getElementById('input-pl-rank').value = d.plRank || "";
            }
        }
    } else {
        loginBtn.innerText = "ADMIN";
        if (adminPanel) adminPanel.classList.add('hidden');
        if (postInput) postInput.classList.add('hidden');
        if (postMsg) postMsg.classList.remove('hidden');
    }
});

// --- [B] 탭 전환 시스템 ---
const tabs = ['exam', 'pl', 'meal', 'board'];
const switchTab = (id) => {
    tabs.forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('tab-active');
        document.getElementById(`tab-${t}`).classList.add('text-gray-400');
    });
    document.getElementById(`content-${id}`).classList.remove('hidden');
    document.getElementById(`tab-${id}`).classList.add('tab-active');
    document.getElementById(`tab-${id}`).classList.remove('text-gray-400');
    if(id === 'meal') getMeal();
};

tabs.forEach(t => {
    document.getElementById(`tab-${t}`).onclick = () => switchTab(t);
});

// --- [C] 데이터 렌더링 (핵심 수정 부분) ---
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const now = new Date(); now.setHours(0,0,0,0);

    // 1. 시험 디데이
    if (data.examDate) {
        const target = new Date(data.examDate); target.setHours(0,0,0,0);
        const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = diff > 0 ? `D-${diff}` : (diff === 0 ? "D-Day🔥" : "종료");
    }

    // 2. 가장 빠른 수행평가 (다중 표시 + 지난 것 삭제 기능 포함)
    const lines = (data.rawAssessments || "").split('\n').filter(l => l.includes('|'));
    let minDiff = Infinity;
    let nearestSubs = [];

    const list = document.getElementById('assessment-list');
    list.innerHTML = "";

    lines.forEach(line => {
        const [subj, cont, dateStr] = line.split('|');
        const [m, d] = dateStr.split('.').map(Number);
        const target = new Date(now.getFullYear(), m - 1, d);
        target.setHours(0,0,0,0);
        const diff = target - now;

        if (diff >= 0) { // 오늘 이후인 것만 표시/계산
            // 리스트 추가
            list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${subj}</td><td class="p-4 text-gray-600">${linkify(cont)}</td><td class="p-4 text-right font-bold text-slate-400">${dateStr}</td></tr>`;
            
            // 디데이 계산
            if (diff < minDiff) {
                minDiff = diff;
                nearestSubs = [subj];
            } else if (diff === minDiff) {
                nearestSubs.push(subj);
            }
        }
    });

    const nearestEl = document.getElementById('nearest-assessment');
    if (nearestSubs.length > 0) {
        const ddayVal = Math.round(minDiff / (1000 * 60 * 60 * 24));
        nearestEl.innerHTML = `<p class="text-red-600 font-black text-2xl">${ddayVal === 0 ? "D-Day🔥" : "D-"+ddayVal}</p><p class="text-gray-700 text-[10px] font-bold mt-1">${nearestSubs.join(', ')}</p>`;
    } else {
        nearestEl.innerHTML = `<p class="text-gray-400 font-black text-2xl">--</p>`;
    }

    // 3. 공지사항
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    // 4. 시험 범위 (| 줄바꿈 적용)
    const rCont = document.getElementById('range-cards');
    rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').filter(l => l.includes(':')).forEach(l => {
        const [t, d] = l.split(':');
        const formattedD = linkify(d).replace(/\|/g, '<br>');
        rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><h3 class="font-bold text-indigo-700 text-lg mb-2">${t}</h3><p class="text-slate-600 text-sm leading-relaxed">${formattedD}</p></div>`;
    });

    // 5. PL
    document.getElementById('pl-main-content').innerHTML = `<p class="text-lg font-bold">${linkify(data.plSchedule || "경기 정보 없음").replace(/\|/g, '<br>')}</p>`;
    const rankList = document.getElementById('pl-rank-list');
    rankList.innerHTML = "";
    (data.plRank || "").split('\n').filter(r => r.includes('|')).forEach((r, idx) => {
        const [team, record] = r.split('|');
        rankList.innerHTML += `<tr><td class="py-4 px-2 font-black text-cyan-500">${idx+1}</td><td class="py-4 font-bold text-white">${team}</td><td class="py-4 text-right text-slate-300 font-mono">${record}</td></tr>`;
    });
});

// --- [D] 게시판 로직 ---
onSnapshot(query(collection(db, "posts"), limit(20)), (snap) => {
    const postList = document.getElementById('post-list');
    postList.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const div = document.createElement('div');
        div.className = "card !p-5 bg-white border border-gray-100 relative mb-4";
        const time = p.createdAt ? p.createdAt.toDate().toLocaleString().slice(5, 16) : "방금 전";
        let isAdmin = auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email);
        let delBtn = isAdmin ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-red-400 text-[10px] ml-2">삭제</button>` : "";
        div.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-2">${p.user}</span>${delBtn}</div><span>${time}</span></div><p class="text-sm text-slate-700 whitespace-pre-wrap">${p.text}</p>`;
        postList.appendChild(div);
    });
});

// --- [E] 이벤트 리스너 ---
document.getElementById('loginBtn').onclick = async () => {
    if (auth.currentUser) { if (confirm("로그아웃?")) await signOut(auth); }
    else { await signInWithPopup(auth, provider); }
};

document.getElementById('addPostBtn').onclick = async () => {
    const txt = document.getElementById('post-text').value.trim();
    if (!txt || !auth.currentUser) return;
    await addDoc(collection(db, "posts"), { text: txt, user: auth.currentUser.displayName || "익명", createdAt: serverTimestamp() });
    document.getElementById('post-text').value = "";
};

window.deletePost = async (id) => {
    if (confirm("삭제?") && auth.currentUser) await deleteDoc(doc(db, "posts", id));
};

document.getElementById('saveBtn').onclick = async () => {
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        plRank: document.getElementById('input-pl-rank').value
    }, { merge: true });
    alert("저장 완료");
};

// --- [F] 급식 ---
let mealStore = {};
async function getMeal() {
    const now = new Date();
    const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=3366de199e3b43ccb46803dcdceb0a92&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;
    try {
        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "정보 없음";
        });
        showMeal(now.getHours() < 13 ? 2 : 3);
    } catch (e) { console.error(e); }
}
function showMeal(t) {
    const cfg = { 1: 'orange', 2: 'emerald', 3: 'indigo' }[t];
    const names = { 1: '조식', 2: '중식', 3: '석식' };
    [1,2,3].forEach(i => {
        const b = document.getElementById(`btn-meal-${i}`);
        b.className = i === t ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
    });
    document.getElementById('meal-display-container').innerHTML = `<div class="w-full bg-${cfg}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs text-${cfg}-400 font-black mb-2">${names[t]}</p><p class="text-lg font-extrabold text-slate-800">${mealStore[t] || "정보 없음"}</p></div>`;
}
[1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).onclick = () => showMeal(t));
