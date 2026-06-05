import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- [F] 급식 (활성화 상태 유지) ---
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
        if (b) {
            b.className = i === t ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
        }
    });
    const container = document.getElementById('meal-display-container');
    if (container) {
        container.innerHTML = `<div class="w-full bg-${cfg}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-sm text-${cfg}-400 font-black mb-4">${names[t]}</p><p class="text-lg font-bold text-gray-800 leading-relaxed">${mealStore[t] || "정보 없음"}</p></div>`;
    }
}

// 페이지 로드 시 급식 정보 가져오기
document.addEventListener('DOMContentLoaded', getMeal);

// 버튼 클릭 이벤트 리스너
[1,2,3].forEach(t => {
    const btn = document.getElementById(`btn-meal-${t}`);
    if (btn) {
        btn.onclick = () => showMeal(t);
    }
});
