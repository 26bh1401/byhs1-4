import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 링크 변환기
const linkify = (text) => {
    if (!text) return "";
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<a href="$1" target="_blank" class="auto-link">$1</a>');
};

// 탭 전환
const switchTab = (tab) => {
    document.getElementById('content-exam').classList.toggle('hidden', tab !== 'exam');
    document.getElementById('content-board').classList.toggle('hidden', tab !== 'board');
    document.getElementById('tab-exam').className = tab === 'exam' ? 'flex-1 py-4 text-center tab-active' : 'flex-1 py-4 text-center text-gray-500';
    document.getElementById('tab-board').className = tab === 'board' ? 'flex-1 py-4 text-center tab-active' : 'flex-1 py-4 text-center text-gray-500';
};

document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-board').onclick = () => switchTab('board');

// 메인 데이터 감시
onSnapshot(dataDoc, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        
        // D-Day 계산
        const diff = new Date(data.examDate) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = days > 0 ? `D-${days}` : (days === 0 ? "D-Day" : "종료");

        // 공지 및 PL 일정 출력
        document.getElementById('notice-content').innerHTML = linkify(data.notice || "현재 공지가 없습니다.");
        document.getElementById('pl-content').innerHTML = linkify(data.plSchedule || "다음 경기 일정이 없습니다.");

        // 수행평가 출력
        const listBody = document.getElementById('assessment-list');
        listBody.innerHTML = "";
        const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
        if(rows.length > 0) {
            const firstRow = rows[0].split('|');
            document.getElementById('nearest-assessment').innerHTML = `${firstRow[0]} - ${linkify(firstRow[1])} (${firstRow[2]})`;
            rows.forEach(row => {
                const [sub, con, dat] = row.split('|');
                listBody.innerHTML += `<tr><td class="p-4 font-bold text-indigo-600">${sub}</td><td class="p-4">${linkify(con)}</td><td class="p-4 text-xs font-bold text-blue-500">${dat}</td></tr>`;
            });
        }

        // 시험 범위 출력 (폰트 확대 버전)
        const cardCont = document.getElementById('range-cards');
        cardCont.innerHTML = "";
        (data.rawRanges || "").split('\n').forEach(line => {
            if(line.includes(':')) {
                const [t, d] = line.split(':');
                cardCont.innerHTML += `
                    <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <h3 class="font-bold text-green-700 text-xl mb-2">${t}</h3>
                        <p class="text-gray-600 text-lg leading-relaxed">${linkify(d)}</p>
                    </div>`;
            }
        });

        // 관리자 인풋 동기화
        document.getElementById('input-date').value = data.examDate || "";
        document.getElementById('input-assessments').value = data.rawAssessments || "";
        document.getElementById('input-ranges').value = data.rawRanges || "";
        document.getElementById('input-notice').value = data.notice || "";
        document.getElementById('input-pl').value = data.plSchedule || "";
    }
});

// 게시판 실시간 감시
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));
onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list');
    list.innerHTML = "";
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

    snap.forEach(docSnap => {
        const p = docSnap.data();
        const postId = docSnap.id;
        const postEl = document.createElement('div');
        postEl.className = "bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm";
        let delBtn = isAdmin ? `<button class="delete-btn" data-id="${postId}">삭제</button>` : "";
        postEl.innerHTML = `
            <div class="flex justify-between text-xs mb-1">
                <div><span class="font-bold text-indigo-600">${p.user}</span>${delBtn}</div>
                <span class="text-gray-400">${p.createdAt?.toDate().toLocaleString().slice(5, 16)}</span>
            </div>
            <p class="text-sm text-gray-700">${linkify(p.text)}</p>`;
        if(isAdmin) postEl.querySelector('.delete-btn').onclick = () => deletePost(postId);
        list.appendChild(postEl);
    });
});

const deletePost = async (id) => {
    if(confirm("정말 삭제할까요?")) await deleteDoc(doc(db, "posts", id));
};

document.getElementById('addPostBtn').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if(!text.trim()) return;
    await addDoc(collection(db, "posts"), { text, user: auth.currentUser.displayName, createdAt: new Date() });
    document.getElementById('post-text').value = "";
};

// 로그인 상태 감지
onAuthStateChanged(auth, (user) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin);
    document.getElementById('post-input-section').classList.toggle('hidden', !user);
    document.getElementById('post-login-msg').classList.toggle('hidden', !!user);
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.innerText = user ? "로그아웃" : "관리자 로그인";
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});

// 관리자 데이터 저장
document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("서버에 저장할까요?")) return;
    try {
        await setDoc(dataDoc, {
            examDate: document.getElementById('input-date').value,
            rawAssessments: document.getElementById('input-assessments').value,
            rawRanges: document.getElementById('input-ranges').value,
            notice: document.getElementById('input-notice').value,
            plSchedule: document.getElementById('input-pl').value,
            lastUpdated: new Date().toLocaleString()
        });
        alert("성공적으로 저장되었습니다!");
    } catch(e) { alert("권한이 없습니다."); }
};
