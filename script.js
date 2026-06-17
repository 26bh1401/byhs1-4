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

// --- 급식 데이터 저장소 ---
let mealStore = {}; // 날짜별 급식 정보
let currentCalendarDate = new Date();

// Service Worker 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('ServiceWorker 등록 실패:', err);
    });
}

// 온라인/오프라인 상태 감지
window.addEventListener('online', () => {
    console.log('온라인 상태 복귀');
    document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태');
    document.body.classList.add('offline');
});

// API에서 급식 정보 가져오기 (캐싱 포함)
async function getMealForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = year + month + day;

    // 이미 캐시된 데이터가 있으면 반환
    if (mealStore[dateStr]) {
        return mealStore[dateStr];
    }

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=3366de199e3b43ccb46803dcdceb0a92&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${dateStr}`;
    try {
        const mealData = {};
        
        // 각 끼니별로 API 호출
        for (let mealCode of [1, 2, 3]) {
            try {
                const response = await fetch(`${url}&MMEAL_SC_CODE=${mealCode}`, {
                    signal: AbortSignal.timeout(5000) // 5초 타임아웃
                });
                const data = await response.json();
                
                console.log(`[${dateStr} 끼니${mealCode}] API응답:`, data);
                
                // mealServiceDietInfo[1].row[0].DDISH_NM 구조로 접근
                if (data && data.mealServiceDietInfo && Array.isArray(data.mealServiceDietInfo) && data.mealServiceDietInfo.length > 1) {
                    const mealInfo = data.mealServiceDietInfo[1];
                    if (mealInfo && mealInfo.row && Array.isArray(mealInfo.row) && mealInfo.row.length > 0) {
                        const dishes = mealInfo.row[0].DDISH_NM;
                        mealData[mealCode] = dishes
                            .replace(/[0-9.]/g, "")
                            .replace(/\(\)/g, "")
                            .replace(/<br\/>/g, "\n")
                            .trim();
                        console.log(`[${dateStr} 끼니${mealCode}] 파싱된 급식:`, mealData[mealCode]);
                    } else {
                        mealData[mealCode] = "급식 정보 없음";
                        console.log(`[${dateStr} 끼니${mealCode}] row 없음`);
                    }
                } else {
                    mealData[mealCode] = "급식 정보 없음";
                    console.log(`[${dateStr} 끼니${mealCode}] mealServiceDietInfo 구조 오류`);
                }
            } catch (err) {
                console.error(`[${dateStr} 끼니${mealCode}] 에러:`, err);
                mealData[mealCode] = "정보 조회 실패";
            }
        }
        
        mealStore[dateStr] = mealData;
        console.log(`[${dateStr}] 최종 급식 데이터:`, mealData);
        return mealData;
    } catch (e) {
        console.error("급식 정보 조회 실패:", e);
        mealStore[dateStr] = { 1: "정보 없음", 2: "정보 없음", 3: "정보 없음" };
        return mealStore[dateStr];
    }
}

// 오늘의 급식 표시 (기존 기능)
async function getMeal() {
    const now = new Date();
    console.log("오늘의 급식 조회:", now);
    const mealData = await getMealForDate(now);
    console.log("오늘의 급식 데이터:", mealData);
    
    // 오늘 날짜로 mealStore에도 저장
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = year + month + day;
    mealStore[todayStr] = mealData;
    
    showMeal(now.getHours() < 13 ? 2 : 3);
}

function showMeal(t) {
    const cfg = { 1: 'orange', 2: 'emerald', 3: 'indigo' }[t];
    const names = { 1: '조식', 2: '중식', 3: '석식' };
    [1, 2, 3].forEach(i => {
        const b = document.getElementById(`btn-meal-${i}`);
        if (b) {
            b.className = i === t ? `flex-1 md:flex-none px-3 md:px-5 py-2.5 rounded-xl bg-white shadow text-${cfg}-600 font-black` : `flex-1 md:flex-none px-3 md:px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
        }
    });
    const container = document.getElementById('meal-display-container');
    if (container) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = year + month + day;
        
        const meal = (mealStore[dateStr] && mealStore[dateStr][t]) ? mealStore[dateStr][t] : "정보 없음";
        const mealDisplay = meal.replace(/\n/g, "<br/>");
        container.innerHTML = `<div class="w-full bg-${cfg}-50 p-6 md:p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs md:text-sm text-${cfg}-400 font-black mb-3 md:mb-4">${names[t]}</p><p class="text-sm md:text-base text-gray-700 leading-relaxed md:leading-relaxed whitespace-pre-wrap">${mealDisplay}</p></div>`;
    }
}

// --- 달력 기능 ---
function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 월 표시 업데이트
    const monthDisplay = document.getElementById('current-month-display');
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    monthDisplay.textContent = `${year}년 ${monthNames[month]}`;

    // 달력 헤더
    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
    let calendarHTML = `
        <div class="grid grid-cols-7 gap-1.5 md:gap-2 mb-3 md:mb-4">
            ${dayHeaders.map(day => `<div class="text-center font-black text-gray-600 py-2 text-xs md:text-sm">${day}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-1.5 md:gap-2">
    `;

    // 첫 번째 요일
    const firstDay = new Date(year, month, 1).getDay();
    
    // 이전 달의 마지막 날들
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarHTML += `<div class="p-2 md:p-3 text-center text-gray-300 bg-gray-50 rounded-lg text-xs md:text-sm"></div>`;
    }

    // 현재 달의 날들
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');

    for (let day = 1; day <= lastDate; day++) {
        const date = new Date(year, month, day);
        const dateStr = year + String(month + 1).padStart(2, '0') + String(day).padStart(2, '0');
        const isToday = dateStr === todayStr;
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const backgroundColor = isToday ? 'bg-blue-500' : isWeekend ? 'bg-red-50' : 'bg-gray-50';
        const textColor = isToday ? 'text-white' : isWeekend ? 'text-red-600' : 'text-gray-800';
        const borderClass = isToday ? 'border-2 border-blue-500' : '';

        calendarHTML += `
            <div class="cursor-pointer p-2 md:p-3 text-center rounded-lg font-bold text-xs md:text-sm ${backgroundColor} ${textColor} ${borderClass} hover:shadow-lg transition transform hover:scale-105 calendar-date active:scale-95"
                 data-date="${dateStr}" onclick="openMealModal('${dateStr}')">
                ${day}
            </div>
        `;
    }

    // 다음 달의 첫 날들
    const totalCells = Math.ceil((firstDay + lastDate) / 7) * 7;
    const nextDays = totalCells - firstDay - lastDate;
    for (let i = 1; i <= nextDays; i++) {
        calendarHTML += `<div class="p-2 md:p-3 text-center text-gray-300 bg-gray-50 rounded-lg text-xs md:text-sm"></div>`;
    }

    calendarHTML += `</div>`;

    document.getElementById('calendar-display').innerHTML = calendarHTML;

    // 급식 정보 미리 로드
    loadMealsForMonth(year, month);
}

// 해당 월의 급식 정보 미리 로드
async function loadMealsForMonth(year, month) {
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDate; day++) {
        const date = new Date(year, month, day - 1);
        const dateStr = year + String(month + 1).padStart(2, '0') + String(day).padStart(2, '0');
        if (!mealStore[dateStr]) {
            // 비동기 작업이지만 await하지 않음 (백그라운드 로딩)
            getMealForDate(new Date(year, month, day)).catch(e => console.error('월 데이터 로드 오류:', e));
        }
    }
}

// 모달에서 급식 표시
async function openMealModal(dateStr) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    
    const date = new Date(year, month - 1, day);
    const mealData = await getMealForDate(date);

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    const modalTitle = document.getElementById('modal-title');
    modalTitle.textContent = `${year}년 ${monthNames[month - 1]} ${day}일 (${dayNames[date.getDay()]})`;

    const mealColors = {
        1: { name: '조식', color: 'orange', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
        2: { name: '중식', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
        3: { name: '석식', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' }
    };

    let modalContent = '';
    for (let mealCode = 1; mealCode <= 3; mealCode++) {
        const mealInfo = mealColors[mealCode];
        const meal = (mealData[mealCode]) ? mealData[mealCode] : "정보 없음";
        const mealDisplay = meal.replace(/\n/g, "<br/>");
        modalContent += `
            <div class="${mealInfo.bg} ${mealInfo.border} border-l-4 p-3 md:p-4 rounded-lg">
                <p class="text-xs md:text-sm font-black ${mealInfo.text} mb-2">${mealInfo.name}</p>
                <p class="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">${mealDisplay}</p>
            </div>
        `;
    }

    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('meal-modal').classList.remove('hidden');
    
    // 모바일에서 스크롤 잠금
    document.body.style.overflow = 'hidden';
}

function closeMealModal() {
    document.getElementById('meal-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// --- 탭 전환 기능 ---
function switchTab(tabName) {
    // 모든 탭 콘텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 모든 탭 버튼 스타일 초기화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'border-blue-500', 'text-emerald-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-400');
    });

    // 선택된 탭 표시
    if (tabName === 'today') {
        document.getElementById('content-meal').classList.remove('hidden');
        document.getElementById('tab-today').classList.remove('border-transparent', 'text-gray-400');
        document.getElementById('tab-today').classList.add('border-emerald-500', 'text-emerald-600');
    } else if (tabName === 'calendar') {
        document.getElementById('content-calendar').classList.remove('hidden');
        document.getElementById('tab-calendar').classList.remove('border-transparent', 'text-gray-400');
        document.getElementById('tab-calendar').classList.add('border-blue-500', 'text-blue-600');
        generateCalendar(currentCalendarDate);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log("페이지 로드됨");
    
    // 오늘의 급식 로드
    getMeal();

    // 오늘의 급식 버튼 이벤트
    [1, 2, 3].forEach(t => {
        const btn = document.getElementById(`btn-meal-${t}`);
        if (btn) {
            btn.onclick = () => showMeal(t);
        }
    });

    // 탭 버튼 이벤트
    const tabToday = document.getElementById('tab-today');
    const tabCalendar = document.getElementById('tab-calendar');
    
    if (tabToday) {
        tabToday.onclick = () => switchTab('today');
    }
    if (tabCalendar) {
        tabCalendar.onclick = () => switchTab('calendar');
    }

    // 달력 네비게이션
    const prevBtn = document.getElementById('btn-prev-month');
    const nextBtn = document.getElementById('btn-next-month');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            generateCalendar(currentCalendarDate);
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            generateCalendar(currentCalendarDate);
        };
    }

    // 모달 외부 클릭 시 닫기
    const modal = document.getElementById('meal-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target.id === 'meal-modal') {
                closeMealModal();
            }
        };
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('meal-modal').classList.contains('hidden')) {
            closeMealModal();
        }
    });

    // 모바일 뷰포트 높이 조정 (주소표시줄 때문에 변하는 높이)
    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

    // 큰 화면에서 터치 이벤트 지원
    if ('ontouchstart' in window) {
        document.body.classList.add('touch-device');
    }
});

// 전역으로 함수 노출
window.openMealModal = openMealModal;
window.closeMealModal = closeMealModal;
