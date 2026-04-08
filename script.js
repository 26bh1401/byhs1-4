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

// --- [관리자 및 로그인 로직] ---
onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const postInput = document.getElementById('post-input-section');
    const postMsg = document.getElementById('post-login-msg');
    if (user) {
        document.getElementById('loginBtn').innerText = "LOGOUT";
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
                document.getElementById('input-pl-rank').value = d.plRank || "";
            }
        }
    } else {
        document.getElementById('loginBtn').innerText = "ADMIN";
        adminPanel.classList.add('hidden');
    }
});

// --- [데이터 실시간 렌더링] ---
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // 1. 디데이 계산
    if (data.examDate) {
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(data.examDate); target.setHours(0,0,0,0);
        const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = diff > 0 ? `D-${diff}` : (diff === 0 ? "D-Day🔥" : "종료");
    }

    // 2. 부리미어 리그 일정 & 전적
    document.getElementById('pl-main-content').innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-left animate-fadeIn"><p class="text-lg font-bold">${linkify(data.plSchedule || "경기 정보 없음")}</p></div>`;

    const rankList = document.getElementById('pl-rank-list');
    rankList.innerHTML = "";
    (data.plRank || "").split('\n').filter(r => r.includes('|')).forEach((r, idx) => {
        const [team, record] = r.split('|');
        rankList.innerHTML += `<tr class="animate-fadeIn"><td class="py-4 px-2 font-black text-cyan-500">${idx+1}</td><td class="py-4 font-bold text-white">${team}</td><td class="py-4 text-right text-slate-300 font-mono">${record}</td></tr>`;
    });

    // 3. 공지 및 수행평가 리스트 등... (나머지 렌더링 생략, 기존과 동일)
    document.getElementById('notice-content').innerHTML = linkify(data.notice);
    const list = document.getElementById('assessment-list');
    list.innerHTML = "";
    (data.rawAssessments || "").split('\n').filter(r => r.includes('|')).forEach(r => {
        const [s, c, d] = r.split('|');
        list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${s}</td><td class="p-4 text-gray-600">${linkify(c)}</td><td class="p-4 text-right font-bold text-slate-400">${d}</td></tr>`;
    });
});

// --- [서버 저장] ---
document.getElementById('saveBtn').onclick = async () => {
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        plRank: document.getElementById('input-pl-rank').value
    }, { merge: true });
    alert("Update Server Success!");
};
