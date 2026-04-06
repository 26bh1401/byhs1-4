import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "너꺼",
    authDomain: "너꺼",
    projectId: "너꺼"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

const dataDoc = doc(db, "classData", "main");

// 탭
const switchTab = (tab) => {
    document.getElementById('content-exam').classList.toggle('hidden', tab !== 'exam');
    document.getElementById('content-board').classList.toggle('hidden', tab !== 'board');
};

tab-exam.onclick = () => switchTab('exam');
tab-board.onclick = () => switchTab('board');

// 데이터
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    const diff = new Date(data.examDate) - new Date();
    const days = Math.ceil(diff / (1000*60*60*24));

    exam-dday.innerText = days > 0 ? `D-${days}` : "종료";

    notice-content.innerText = data.notice || "";

    const list = assessment-list;
    list.innerHTML = "";

    (data.rawAssessments || "").split('\n').forEach(r => {
        if (!r.includes('|')) return;
        const [s,c,d] = r.split('|');

        list.innerHTML += `<tr><td>${s}</td><td>${c}</td><td>${d}</td></tr>`;
    });
});

// 글쓰기
addPostBtn.onclick = async () => {
    const text = post-text.value;
    if (!text || !auth.currentUser) return;

    await addDoc(collection(db,"posts"), {
        text,
        user: auth.currentUser.displayName,
        createdAt: new Date()
    });

    post-text.value = "";
};

// 로그인
onAuthStateChanged(auth, (user) => {
    loginBtn.innerText = user ? "로그아웃" : "로그인";
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});
