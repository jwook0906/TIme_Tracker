const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
const listen = (event, cb) => window.__TAURI__.event.listen(event, cb);

const api = {
  getVersion: () => invoke('get_version'),
  getState: () => invoke('get_state'),
  getRunningProcesses: () => invoke('get_running_processes'),
  addProgram: (name) => invoke('add_program', { name }),
  removeProgram: (name) => invoke('remove_program', { name }),
  resetTimer: (name) => invoke('reset_timer', { name }),
  resetAllTimers: () => invoke('reset_all_timers'),
  setIdleThreshold: (seconds) => invoke('set_idle_threshold', { seconds }),
  setMiniMode: (isMini) => invoke('set_mini_mode', { isMini }),
  getHistory: () => invoke('get_history'),
  onTimerUpdate: (cb) => listen('timer-update', (e) => cb(e.payload)),
  devSetVirtualDate: (date) => invoke('dev_set_virtual_date', { date }),
  devSetTime: (name, seconds) => invoke('dev_set_time', { name, seconds }),
};

// ─── 랭킹 (Supabase 연동) ──────────────────────────────────────────────
// 설정 방법은 RANKING_SETUP.md 참고 — 아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요.
const SUPABASE_URL = 'https://xhvqehcwrywhazoozlsc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodnFlaGN3cnl3aGF6b296bHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjQ3NDgsImV4cCI6MjA5NjQwMDc0OH0.IWmsMKhFI1Sqq4VV4ee3y8edBMzngO-aSi0jD6yhYPk';
const SESSION_STORAGE_KEY = 'tt_session';
const RANKING_SYNC_STORAGE_KEY = 'tt_ranking_synced_until';

function isSupabaseConfigured() {
  return !SUPABASE_URL.startsWith('<') && !SUPABASE_ANON_KEY.startsWith('<');
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession(value) {
  if (value) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

let session = loadSession();

async function authRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && (data.error_description || data.msg || data.message)) || `HTTP ${res.status}`);
  }
  return data;
}

async function restRequest(path, options = {}, retried = false) {
  const token = session ? session.access_token : SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && session && !retried) {
    const refreshed = await auth.refreshSession();
    if (refreshed) return restRequest(path, options, true);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.message) || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

const auth = {
  async signInAnonymously() {
    const data = await authRequest('/auth/v1/signup', { method: 'POST', body: JSON.stringify({}) });
    session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    persistSession(session);
    return session;
  },
  async signOut() {
    if (session) {
      await authRequest('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    session = null;
    persistSession(null);
  },
  async refreshSession() {
    if (!session || !session.refresh_token) return null;
    try {
      const data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
      persistSession(session);
      return session;
    } catch {
      session = null;
      persistSession(null);
      return null;
    }
  },
  getSession() {
    return session;
  },
};

// ─── i18n ────────────────────────────────────────────────────────────
const TRANSLATIONS = {
    appName: '작업시간 측정기',
    miniTitle: '⏱ 작업시간 측정기',
    tabHome: '홈', tabStats: '통계', tabSettings: '설정',
    detecting: '감지 중...',
    workingPrefix: '작업 중: ', idlePrefix: '딴짓 중: ', notWorkingPrefix: '비작업 중: ',
    miniDetecting: '감지 중...', miniIdlePrefix: '딴짓: ',
    totalTime: '총 작업시간', awayTime: '비작업 시간', focusEfficiency: '집중 효율', resetAll: '전체 초기화', miniBtn: '⊟ 미니',
    colName: '프로그램', colTime: '사용 시간', colActions: '작업',
    btnReset: '초기화', btnRemove: '제거',
    emptyLine1: '아직 추가된 프로그램이 없습니다.', emptyLine2: '아래 버튼으로 추가해보세요.',
    addBtn: '+ 프로그램 추가', idleLabel: '딴짓 감지', idleDesc: '딴짓 감지 시간을 설정합니다.',
    secUnit: '초',
    todayChartTitle: '오늘 프로그램별 사용 시간', weekChartTitle: '총 작업시간 추이',
    chartRange7: '7일', chartRange14: '14일', chartRange30: '30일',
    streakLabel: '연속 집중일', bestLabel: '최장 기록',
    noPrograms: '추적 중인 프로그램이 없습니다.',
    modalTitle: '프로그램 추가', searchPlaceholder: '프로세스 이름 검색 또는 직접 입력...',
    addConfirm: '추가', cancel: '취소',
    settingsTheme: '테마', dark: '다크', light: '라이트',
    todayLabel: '오늘', alreadyAdded: '추가됨',
    loading: '실행 중인 프로세스 조회 중...', noResults: '검색 결과 없음',
    errEmpty: '프로세스 이름을 입력하거나 목록에서 선택해주세요.',
    settingsUpdate: '업데이트', checkUpdateBtn: '업데이트 확인', installUpdateBtn: '지금 설치',
    updateChecking: '업데이트 확인 중...', updateLatest: '최신 버전을 사용하고 있습니다.',
    updateAvailablePrefix: '새 버전이 있습니다: v', updateDownloading: '다운로드 및 설치 중... ',
    updateError: '업데이트 확인에 실패했습니다.',
    devModeTabLabel: '개발자', devModeTitle: '개발자 모드',
    devWarning: '⚠ 아래 값을 변경하면 실제 작업 기록이 즉시 덮어써집니다.',
    devDateLabel: '가상 날짜', devCurrentDatePrefix: '현재 적용 날짜: ',
    devDateApplyBtn: '적용', devDateResetBtn: '실제 날짜로 초기화',
    devTimeLabel: '작업시간 조정 (HH:MM:SS)', devTimeApplyBtn: '적용',
    devApplied: '적용되었습니다.', devInvalidTime: '시간 형식이 올바르지 않습니다 (예: 01:23:45).',
    devRankingResetTitle: '랭킹 기록 초기화',
    devRankingResetDesc: '⚠ 본인 계정의 랭킹 누적 기록과 연속 작업일수가 0으로 초기화됩니다. (Supabase에 즉시 반영되며 되돌릴 수 없습니다)',
    devRankingResetBtn: '내 랭킹 기록 초기화',
    devRankingResetNeedLogin: '먼저 랭킹 탭에서 게스트로 시작해 주세요.',
    devRankingResetDone: '랭킹 기록이 초기화되었습니다.',
    devRankingResetFailed: '초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    devRankingResetAllTitle: '관리자: 전체 사용자 랭킹 초기화',
    devRankingResetAllDesc: '⚠ 모든 사용자의 누적 기록과 연속 작업일수가 영구 삭제됩니다. 되돌릴 수 없으며, 관리자 계정에서만 동작합니다.',
    devRankingResetAllBtn: '전체 사용자 랭킹 초기화',
    devRankingResetAllConfirm: '정말로 모든 사용자의 랭킹 기록을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
    devRankingResetAllNeedAdmin: '관리자 계정에서만 사용할 수 있습니다.',
    devRankingResetAllDone: '전체 사용자의 랭킹 기록이 초기화되었습니다.',
    devRankingResetAllFailed: '초기화에 실패했습니다. 관리자 권한을 확인해 주세요.',
    devRankingResetCategoryTitle: '관리자: 랭킹 항목별 초기화',
    devRankingResetCategoryDesc: '⚠ 선택한 항목에 해당하는 모든 사용자의 기록이 영구 삭제됩니다. 되돌릴 수 없으며, 항목 간에 포함 관계가 있어(오늘 ⊂ 이번 주 ⊂ 전체기간) 더 넓은 범위를 초기화하면 좁은 범위도 함께 비워집니다.',
    devRankingResetTodayBtn: '오늘 랭킹 초기화',
    devRankingResetWeekBtn: '이번 주 랭킹 초기화',
    devRankingResetAlltimeBtn: '전체기간/순수작업시간 랭킹 초기화',
    devRankingResetStreakBtn: '연속작업일수 랭킹 초기화',
    devRankingResetCategoryConfirm: '정말로 이 항목에 해당하는 모든 사용자의 랭킹 기록을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
    devRankingResetCategoryDone: '해당 항목의 랭킹 기록이 초기화되었습니다.',
    devRankingResetCategoryFailed: '초기화에 실패했습니다. 관리자 권한을 확인해 주세요.',
    devGenDummyTitle: '랭킹 테스트 유저 생성',
    devGenDummyDesc: '⚠ 입력한 수만큼 새 게스트 계정을 실제로 생성하고 무작위 닉네임 · 작업시간 기록을 채워 전체 랭킹에 등록합니다. (Supabase에 즉시 반영되며 되돌릴 수 없고, 익명 로그인 횟수 제한에도 포함됩니다)',
    devGenDummyBtn: '테스트 유저 생성',
    devGenDummyProgress: '생성 중... ({current}/{total})',
    devGenDummyDone: '테스트 유저 {count}명을 생성했습니다.',
    devGenDummyPartial: '{total}명 중 {created}명만 생성되었습니다. (나머지는 실패 — 잠시 후 다시 시도해 주세요)',
    devGenDummyInvalidCount: '1~50 사이의 숫자를 입력해 주세요.',
    tabRanking: '랭킹',
    rankingGuestTitle: '게스트로 시작하기',
    rankingGuestDesc: '닉네임만 입력하면 이메일이나 비밀번호 없이 바로 익명 계정으로 랭킹에 참여할 수 있습니다.',
    guestLoginBtn: '게스트로 시작하기',
    rankingSetupNeeded: '랭킹 기능을 사용하려면 먼저 Supabase 설정이 필요합니다. RANKING_SETUP.md 문서를 참고해 설정을 완료해주세요.',
    rankingDisclaimer: '참고용 캐주얼 랭킹입니다 — 자가 보고 데이터이며 검증되지 않습니다.',
    authErrEmpty: '닉네임을 입력해주세요.',
    authErrGeneric: '요청 처리 중 오류가 발생했습니다.',
    rankingNicknameTaken: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.',
    rankingNicknameTitle: '닉네임 설정',
    rankingNicknameDesc: '랭킹에 표시될 닉네임을 입력해주세요.',
    nicknamePlaceholder: '닉네임', nicknameSaveBtn: '저장',
    logoutBtn: '로그아웃', rankingBoardTitle: '전체 랭킹',
    rankingPeriodToday: '오늘', rankingPeriodWeek: '이번 주',
    rankingLoading: '랭킹 불러오는 중...',
    rankingLoadError: '랭킹을 불러오지 못했습니다.', rankingEmpty: '아직 랭킹 데이터가 없습니다.',
    rankingCardSubtitle: '전국 랭킹', rankingRankSuffix: '위', rankingMeSuffix: '(나)',
    rankingMyRowLabel: '내 순위', rankingNoRank: '-',
    rankingCardLabelToday: '오늘 작업시간', rankingCardLabelWeek: '이번 주 작업시간',
};

let currentTheme = localStorage.getItem('theme') || 'dark';

function t(key) {
  return TRANSLATIONS[key] ?? key;
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  const idleSelect = document.getElementById('idleSelect');
  if (idleSelect) {
    const val = idleSelect.value;
    idleSelect.innerHTML = ['5', '10', '20', '30', '60']
      .map(v => `<option value="${v}">${v}${t('secUnit')}</option>`).join('');
    idleSelect.value = val;
  }
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  document.title = t('appName');
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-opt]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeOpt === theme);
  });
}
// ─────────────────────────────────────────────────────────────────────

let state = { selectedPrograms: [], times: {}, awaySeconds: 0, activeProcess: null, maxPrograms: 10, idleThreshold: 30, date: '', devDateOverride: null };
let selectedInModal = null;
let allProcesses = [];
let isMini = false;
let lastIsIdle = false;

const CHART_RANGE_STORAGE_KEY = 'tt_chart_range';
const CHART_RANGES = [7, 14, 30];
let chartRange = Number(localStorage.getItem(CHART_RANGE_STORAGE_KEY));
if (!CHART_RANGES.includes(chartRange)) chartRange = 30;

// ─── 랭킹 화면 상태 ────────────────────────────────────────────────────
let myProfile = null; // { nickname } | null — 로그인했지만 닉네임 미설정이면 null
let guestLoginBusy = false;
let rankingPeriod = 'today'; // 'today' | 'week'
const RANKING_VIEWS = {
  today: 'ranking_today',
  week: 'ranking_week',
};
const RANKING_METRIC = {
  today: { column: 'total_seconds', format: formatTime },
  week: { column: 'total_seconds', format: formatTime },
};
const RANKING_CARD_LABEL = {
  today: 'rankingCardLabelToday',
  week: 'rankingCardLabelWeek',
};
// 닉네임별 아바타·진행바 색상을 순서대로 순환시켜 시각적으로 구분되게 한다 (의미를 갖진 않음)
const RANKING_COLORS = ['#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fb923c', '#22d3ee'];
// 4위부터는 상위권과 시각적으로 구분되도록 아바타·진행바를 무채색으로 통일한다
const RANKING_GRAY = '#6b7280';
const RANKING_LIST_VISIBLE_COUNT = 10;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTimeToSeconds(text) {
  const m = String(text).trim().match(/^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/);
  if (!m) return null;
  const [, h, mi, s] = m;
  return Number(h) * 3600 + Number(mi) * 60 + Number(s);
}

function updateTotalTime() {
  const total = state.selectedPrograms.reduce((sum, name) => sum + (state.times[name] || 0), 0);
  const el = document.getElementById('totalTime');
  if (el) el.textContent = formatTime(total);
  const miniEl = document.getElementById('miniTotalTime');
  if (miniEl) miniEl.textContent = formatTime(total);
}

function updateAwayTime() {
  const el = document.getElementById('awayTime');
  if (el) el.textContent = formatTime(state.awaySeconds || 0);
}

function updateFocusEfficiency() {
  const el = document.getElementById('focusEfficiency');
  if (!el) return;
  const total = state.selectedPrograms.reduce((sum, name) => sum + (state.times[name] || 0), 0);
  const away = state.awaySeconds || 0;
  const tracked = total + away;
  const pct = tracked > 0 ? Math.round((total / tracked) * 100) : 100;
  el.textContent = `${pct}%`;
}

function updateMiniView(activeProcess, isIdle) {
  const miniView = document.getElementById('miniView');
  const dot = document.getElementById('miniDot');
  const proc = document.getElementById('miniProcess');
  const procTime = document.getElementById('miniProcTime');

  const isTracked = activeProcess && state.selectedPrograms.some(p => p.toLowerCase() === activeProcess.toLowerCase());
  const matchedName = isTracked ? state.selectedPrograms.find(p => p.toLowerCase() === activeProcess.toLowerCase()) : null;

  if (isIdle) {
    dot.className = 'mini-dot idle';
    proc.textContent = `${t('miniIdlePrefix')}${activeProcess}`;
    procTime.textContent = matchedName ? formatTime(state.times[matchedName] || 0) : '--:--:--';
    miniView.classList.remove('working', 'not-working');
    miniView.classList.add('idling');
  } else if (isTracked) {
    dot.className = 'mini-dot active';
    proc.textContent = activeProcess;
    procTime.textContent = formatTime(state.times[matchedName] || 0);
    miniView.classList.remove('idling', 'not-working');
    miniView.classList.add('working');
  } else {
    dot.className = activeProcess ? 'mini-dot inactive' : 'mini-dot';
    proc.textContent = activeProcess || t('miniDetecting');
    procTime.textContent = '--:--:--';
    miniView.classList.remove('working', 'idling');
    miniView.classList.add('not-working');
  }
}

async function toggleMini() {
  isMini = !isMini;
  await api.setMiniMode(isMini);
  document.getElementById('miniView').classList.toggle('hidden', !isMini);
  document.querySelector('.app').classList.toggle('hidden', isMini);
}

function renderPrograms() {
  const list = document.getElementById('programList');
  const { selectedPrograms, times, activeProcess } = state;

  if (selectedPrograms.length === 0) {
    list.innerHTML = `<div class="empty-state">${t('emptyLine1')}<br>${t('emptyLine2')}</div>`;
    updateTotalTime();
    return;
  }

  const sorted = [...selectedPrograms].sort((a, b) => (times[b] || 0) - (times[a] || 0));
  const maxSecs = Math.max(...selectedPrograms.map(n => times[n] || 0), 1);

  list.innerHTML = sorted.map(name => {
    const isActive = activeProcess && activeProcess.toLowerCase() === name.toLowerCase();
    const secs = times[name] || 0;
    const pct = Math.round((secs / maxSecs) * 100);
    return `
      <div class="program-row ${isActive ? 'active-row' : ''}" data-name="${name}">
        <span class="col-name">
          <span class="proc-indicator"></span>
          ${name}
        </span>
        <span class="col-time">${formatTime(secs)}</span>
        <div class="col-bar">
          <div class="bar-track-inline">
            <div class="bar-fill-inline" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="col-actions">
          <button class="btn-reset" data-name="${name}">${t('btnReset')}</button>
          <button class="btn-remove" data-name="${name}">${t('btnRemove')}</button>
        </span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.btn-reset').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.resetTimer(btn.dataset.name);
      state.times[btn.dataset.name] = 0;
      renderPrograms();
      updateTotalTime();
    });
  });

  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.removeProgram(btn.dataset.name);
      state.selectedPrograms = state.selectedPrograms.filter(p => p !== btn.dataset.name);
      renderPrograms();
      updateFooter();
      updateTotalTime();
    });
  });

  updateTotalTime();
}

function updateStatus(activeProcess, isIdle) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const isTracked = activeProcess && state.selectedPrograms.includes(activeProcess.toLowerCase());

  if (!activeProcess) {
    dot.className = 'dot';
    text.textContent = t('detecting');
  } else if (isIdle) {
    dot.className = 'dot idle';
    text.textContent = `${t('idlePrefix')}${activeProcess}`;
  } else if (isTracked) {
    dot.className = 'dot active';
    text.textContent = `${t('workingPrefix')}${activeProcess}`;
  } else {
    dot.className = 'dot inactive';
    text.textContent = `${t('notWorkingPrefix')}${activeProcess}`;
  }
}

function updateFooter() {
  const count = state.selectedPrograms.length;
  document.getElementById('countLabel').textContent = `${count} / ${state.maxPrograms}`;
  document.getElementById('addBtn').disabled = count >= state.maxPrograms;
}

function openModal() {
  selectedInModal = null;
  document.getElementById('searchInput').value = '';
  document.getElementById('modalError').classList.add('hidden');
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('processList').innerHTML = `<div class="loading">${t('loading')}</div>`;
  document.getElementById('searchInput').focus();

  api.getRunningProcesses().then(processes => {
    allProcesses = processes;
    renderProcessList('');
  });
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  selectedInModal = null;
}

function renderProcessList(filter) {
  const list = document.getElementById('processList');
  const filtered = allProcesses.filter(p => p.includes(filter.toLowerCase().trim()));

  if (filtered.length === 0) {
    list.innerHTML = `<div class="loading">${t('noResults')}</div>`;
    return;
  }

  list.innerHTML = filtered.map(p => {
    const added = state.selectedPrograms.includes(p);
    return `<div class="process-item ${added ? 'already-added' : ''} ${selectedInModal === p ? 'selected' : ''}" data-name="${p}">
      ${p}${added ? ` (${t('alreadyAdded')})` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.process-item:not(.already-added)').forEach(item => {
    item.addEventListener('click', () => {
      selectedInModal = item.dataset.name;
      document.getElementById('searchInput').value = selectedInModal;
      renderProcessList(filter);
    });
  });
}

async function addProgram() {
  const input = document.getElementById('searchInput').value.trim().toLowerCase();
  const errEl = document.getElementById('modalError');

  if (!input) {
    errEl.textContent = t('errEmpty');
    errEl.classList.remove('hidden');
    return;
  }

  const result = await api.addProgram(input);
  if (!result.ok) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    return;
  }

  state.selectedPrograms.push(input);
  if (!state.times[input]) state.times[input] = 0;
  closeModal();
  renderPrograms();
  updateFooter();
  updateTotalTime();
}

function reorderProgramRows() {
  const list = document.getElementById('programList');
  const rows = [...list.querySelectorAll('.program-row')];
  if (rows.length < 2) return;
  rows
    .sort((a, b) => (state.times[b.dataset.name] || 0) - (state.times[a.dataset.name] || 0))
    .forEach(row => list.appendChild(row));
}

function updateProgramBars() {
  const { selectedPrograms, times } = state;
  const maxSecs = Math.max(...selectedPrograms.map(n => times[n] || 0), 1);
  selectedPrograms.forEach(name => {
    const row = document.querySelector(`.program-row[data-name="${name}"]`);
    if (!row) return;
    const fill = row.querySelector('.bar-fill-inline');
    if (!fill) return;
    const pct = Math.round(((times[name] || 0) / maxSecs) * 100);
    fill.style.width = `${pct}%`;
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `tab-${tabName}`);
  });
  if (tabName === 'stats') renderStats();
  if (tabName === 'devmode') renderDevMode();
  if (tabName === 'ranking') renderRanking();
}

async function renderDevMode() {
  // 관리자 전용 섹션도 누구나 볼 수 있도록 노출한다 — 실제 권한 검증은 서버(SECURITY DEFINER RPC의
  // is_admin 재검증)가 수행하므로, 비관리자가 눌러도 데이터는 안전하며 "관리자 계정에서만
  // 사용할 수 있습니다" 메시지로 자연스럽게 안내된다.
  const adminSection = document.getElementById('devAdminResetSection');
  if (adminSection) adminSection.classList.remove('hidden');
  const adminCategorySection = document.getElementById('devAdminCategoryResetSection');
  if (adminCategorySection) adminCategorySection.classList.remove('hidden');

  const dateInput = document.getElementById('devDateInput');
  const currentDateEl = document.getElementById('devCurrentDate');
  const effectiveDate = state.devDateOverride || state.date;
  if (currentDateEl) currentDateEl.textContent = `${t('devCurrentDatePrefix')}${effectiveDate}`;
  if (dateInput) dateInput.value = effectiveDate;

  const list = document.getElementById('devTimeList');
  if (!list) return;
  list.innerHTML = '';
  state.selectedPrograms.forEach(name => {
    const row = document.createElement('div');
    row.className = 'update-row dev-time-row';
    row.innerHTML = `
      <span class="dev-time-name">${name}</span>
      <input type="text" class="dev-time-input" data-name="${name}" value="${formatTime(state.times[name] || 0)}" placeholder="HH:MM:SS" />
      <button class="btn-secondary dev-time-apply" data-name="${name}">${t('devTimeApplyBtn')}</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.dev-time-apply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const input = list.querySelector(`.dev-time-input[data-name="${name}"]`);
      const seconds = parseTimeToSeconds(input.value);
      if (seconds === null) {
        input.classList.add('dev-input-error');
        setTimeout(() => input.classList.remove('dev-input-error'), 1200);
        return;
      }
      await api.devSetTime(name, seconds);
      await refreshAfterDevChange();
    });
  });
}

async function refreshAfterDevChange() {
  state = await api.getState();
  renderPrograms();
  updateTotalTime();
  updateProgramBars();
  if (!document.getElementById('tab-stats').classList.contains('hidden')) renderStats();
  renderDevMode();
}

// ─── 랭킹 탭 ───────────────────────────────────────────────────────────
async function fetchMyProfile() {
  const sess = auth.getSession();
  if (!sess) return null;
  const rows = await restRequest(`/profiles?user_id=eq.${sess.user.id}&select=nickname,is_admin`);
  return rows && rows.length ? rows[0] : null;
}

async function createProfile(nickname) {
  const sess = auth.getSession();
  await restRequest('/profiles', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: sess.user.id, nickname }),
  });
  myProfile = { nickname };
}

function authErrorMessage(err) {
  if (err && err.message && err.message.includes('profiles_nickname_key')) {
    return t('rankingNicknameTaken');
  }
  return (err && err.message) || t('authErrGeneric');
}

// 랭킹에는 "그날이 끝나 더 이상 변하지 않는 확정 기록"만 등록한다 (작업 도중의 어중간한 숫자 노출 방지).
// history(api.getHistory)에는 자정 롤오버 시점에 얼려진 지난 날짜의 기록만 들어오고 진행 중인 오늘 데이터는
// 절대 포함되지 않으므로, history에 아직 등록하지 않은 새 레코드가 있는지만 확인하면 충분히 안전하다.
async function syncFinalizedDays() {
  const sess = auth.getSession();
  if (!sess || !myProfile) return;

  let lastSynced = localStorage.getItem(RANKING_SYNC_STORAGE_KEY) || '';
  const history = await api.getHistory();
  const pending = history
    .filter(r => r.date > lastSynced)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  for (const record of pending) {
    try {
      const total = Object.values(record.times).reduce((s, v) => s + v, 0);
      await restRequest('/daily_totals', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: sess.user.id, date: record.date, total_seconds: total }),
      });
      const { current } = calculateStreak(history, record.date);
      await restRequest(`/profiles?user_id=eq.${sess.user.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ current_streak: current }),
      });
      lastSynced = record.date;
      localStorage.setItem(RANKING_SYNC_STORAGE_KEY, lastSynced);
    } catch {
      // 캐주얼 용도이므로 실패 시 큐잉 없이 다음 주기에 이어서 재시도 (lastSynced가 갱신되지 않았으므로 자동으로 재시도됨)
      break;
    }
  }
}

// 개발자 모드용: 본인 랭킹 기록을 0으로 되돌린다 (delete 권한이 없는 RLS 정책 그대로 두고 update만으로 처리).
// RANKING_SYNC_STORAGE_KEY는 그대로 둬야 한다 — 지우면 다음 syncFinalizedDays 때 history에 남은
// 예전 기록이 "미동기화"로 다시 인식되어 방금 0으로 되돌린 값을 덮어써 버린다.
async function resetMyRankingData() {
  const sess = auth.getSession();
  if (!sess || !myProfile) return t('devRankingResetNeedLogin');
  try {
    await restRequest(`/daily_totals?user_id=eq.${sess.user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ total_seconds: 0 }),
    });
    await restRequest(`/profiles?user_id=eq.${sess.user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ current_streak: 0 }),
    });
    return t('devRankingResetDone');
  } catch {
    return t('devRankingResetFailed');
  }
}

// daily_totals/profiles 모두 RLS상 "본인 행만 쓰기 가능"이고 profiles.user_id는 auth.users(id)를
// 참조하는 FK라서, 더미 랭킹 유저는 서버에 가짜 행을 직접 꽂아 넣는 방법으로는 만들 수 없다 —
// 실제로 새 익명 계정을 만들고 그 계정의 토큰으로 본인 행을 채우는 것이 유일한 방법이다.
// 전역 session(현재 로그인된 계정)은 절대 건드리지 않도록 매 계정의 토큰을 직접 들고 다닌다.
async function restRequestAs(token, path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.message) || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

const DUMMY_NICKNAME_WORDS = [
  '몰입러', '집중왕', '코딩요정', '부엉이', '올빼미', '다람쥐', '책벌레',
  '야행성', '새벽별', '집중모드', '초집중', '마감직전', '루틴마스터',
  '꾸준맨', '타이머지킴이', '워커홀릭', '딴짓금지', '오후의커피', '불꽃집중', '갓생러',
];

function randomDummyNickname() {
  const word = DUMMY_NICKNAME_WORDS[Math.floor(Math.random() * DUMMY_NICKNAME_WORDS.length)];
  return `${word}${Math.floor(Math.random() * 100000)}`;
}

function recentDateStrings(count) {
  const dates = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

// 개발자 모드용: 임의의 닉네임 · 작업시간 기록을 가진 더미 게스트 계정을 N개 생성해 랭킹에 등록한다.
// 계정 하나당 회원가입 1회 + 닉네임 등록 + 최근 며칠치 daily_totals 기록을 새로 발급받은 토큰으로 직접 남긴다.
async function generateDummyRankingUsers(count, onProgress) {
  const recentDates = recentDateStrings(7);
  let created = 0;
  for (let i = 0; i < count; i++) {
    if (onProgress) onProgress(i, count);
    try {
      const signup = await authRequest('/auth/v1/signup', { method: 'POST', body: JSON.stringify({}) });
      const token = signup.access_token;
      const userId = signup.user.id;

      let nickname = randomDummyNickname();
      for (let attempt = 0; ; attempt++) {
        try {
          await restRequestAs(token, '/profiles', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ user_id: userId, nickname }),
          });
          break;
        } catch (err) {
          if (attempt >= 4 || !(err.message || '').includes('profiles_nickname_key')) throw err;
          nickname = randomDummyNickname();
        }
      }

      const days = 1 + Math.floor(Math.random() * recentDates.length);
      for (const date of recentDates.slice(0, days)) {
        await restRequestAs(token, '/daily_totals', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: userId, date, total_seconds: 600 + Math.floor(Math.random() * 8 * 3600) }),
        });
      }
      created++;
    } catch {
      // 한 명 실패해도(닉네임 충돌, 익명 로그인 횟수 제한 등) 멈추지 않고 나머지를 계속 진행한다
    }
  }
  return created === count
    ? t('devGenDummyDone').replace('{count}', String(created))
    : t('devGenDummyPartial').replace('{created}', String(created)).replace('{total}', String(count));
}

// 관리자 전용: 전체 사용자의 랭킹 기록을 영구 삭제한다.
// 클라이언트(게스트 계정)는 RLS상 본인 행만 건드릴 수 있으므로, 실제 작업은 SECURITY DEFINER로
// 정의된 admin_reset_all_rankings() RPC가 수행한다 — 이 함수는 호출자가 profiles.is_admin인지
// 서버 측에서 직접 재검증하므로, 비관리자가 호출해도 거부된다(서비스 역할 키를 앱에 넣지 않고도 안전).
// 여기서의 is_admin 검사와 confirm()은 그 위에 더해진 클라이언트 측 추가 방어선/UX일 뿐이다.
async function resetAllRankingData() {
  const sess = auth.getSession();
  if (!sess || !myProfile || !myProfile.is_admin) return t('devRankingResetAllNeedAdmin');
  if (!window.confirm(t('devRankingResetAllConfirm'))) return '';
  try {
    await restRequest('/rpc/admin_reset_all_rankings', { method: 'POST' });
    return t('devRankingResetAllDone');
  } catch {
    return t('devRankingResetAllFailed');
  }
}

// 관리자 전용: 랭킹 항목(오늘/이번 주/전체기간·순수작업시간/연속작업일수)별 개별 초기화.
// 오늘 ⊂ 이번 주 ⊂ 전체기간 관계로 daily_totals를 날짜 범위만 다르게 집계한 뷰들이라
// 완전히 독립적인 초기화는 불가능하다 — 더 넓은 범위를 지우면 좁은 범위도 함께 비워지는
// 계층적 동작으로 구현한다 (admin_reset_all_rankings와 동일하게 SECURITY DEFINER RPC가
// is_admin을 서버에서 재검증하므로 비관리자가 호출해도 거부된다).
const RANKING_RESET_RPC = {
  today: 'admin_reset_ranking_today',
  week: 'admin_reset_ranking_week',
  alltime: 'admin_reset_ranking_alltime',
  streak: 'admin_reset_ranking_streak',
};

async function resetRankingCategory(scope) {
  const sess = auth.getSession();
  if (!sess || !myProfile || !myProfile.is_admin) return t('devRankingResetAllNeedAdmin');
  if (!window.confirm(t('devRankingResetCategoryConfirm'))) return '';
  try {
    await restRequest(`/rpc/${RANKING_RESET_RPC[scope]}`, { method: 'POST' });
    return t('devRankingResetCategoryDone');
  } catch {
    return t('devRankingResetCategoryFailed');
  }
}

function renderGuestLogin() {
  return `
    <div class="stats-section">
      <h3 class="stats-title">${t('rankingGuestTitle')}</h3>
      <p class="ranking-disclaimer">${t('rankingGuestDesc')}</p>
      <p class="ranking-disclaimer">${t('rankingDisclaimer')}</p>
      <div class="auth-form">
        <input type="text" id="guestNicknameInput" class="search-input" placeholder="${t('nicknamePlaceholder')}" maxlength="20" />
        <div id="guestLoginMsg" class="modal-error hidden"></div>
        <div class="auth-actions">
          <button id="guestLoginBtn" class="btn-primary">${t('guestLoginBtn')}</button>
        </div>
      </div>
    </div>
  `;
}

function bindGuestLogin(container) {
  const input = container.querySelector('#guestNicknameInput');
  const msgEl = container.querySelector('#guestLoginMsg');
  const btn = container.querySelector('#guestLoginBtn');

  const showMsg = (text) => {
    msgEl.textContent = text;
    msgEl.classList.remove('hidden');
  };

  btn.addEventListener('click', async () => {
    if (guestLoginBusy) return;
    const nickname = input.value.trim();
    if (!nickname) {
      showMsg(t('authErrEmpty'));
      return;
    }
    guestLoginBusy = true;
    btn.disabled = true;
    msgEl.classList.add('hidden');
    try {
      if (!auth.getSession()) await auth.signInAnonymously();
      await createProfile(nickname);
      await renderRanking();
    } catch (err) {
      showMsg(authErrorMessage(err));
    } finally {
      guestLoginBusy = false;
      btn.disabled = false;
    }
  });
}

function renderNicknameForm() {
  return `
    <div class="stats-section">
      <h3 class="stats-title">${t('rankingNicknameTitle')}</h3>
      <p class="ranking-disclaimer">${t('rankingNicknameDesc')}</p>
      <div class="auth-form">
        <input type="text" id="nicknameInput" class="search-input" placeholder="${t('nicknamePlaceholder')}" maxlength="20" />
        <div id="nicknameMsg" class="modal-error hidden"></div>
        <div class="auth-actions">
          <button id="nicknameSubmitBtn" class="btn-primary">${t('nicknameSaveBtn')}</button>
          <button id="nicknameLogoutBtn" class="btn-secondary">${t('logoutBtn')}</button>
        </div>
      </div>
    </div>
  `;
}

function bindNicknameForm(container) {
  const input = container.querySelector('#nicknameInput');
  const msgEl = container.querySelector('#nicknameMsg');
  const submitBtn = container.querySelector('#nicknameSubmitBtn');
  const logoutBtn = container.querySelector('#nicknameLogoutBtn');

  const showMsg = (text) => {
    msgEl.textContent = text;
    msgEl.classList.remove('hidden');
  };

  submitBtn.addEventListener('click', async () => {
    const nickname = input.value.trim();
    if (!nickname) {
      showMsg(t('authErrEmpty'));
      return;
    }
    submitBtn.disabled = true;
    msgEl.classList.add('hidden');
    try {
      await createProfile(nickname);
      await renderRanking();
    } catch (err) {
      showMsg(authErrorMessage(err));
      submitBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
    myProfile = null;
    await renderRanking();
  });
}

function renderLeaderboardShell(streakCurrent, streakBest) {
  return `
    <div class="stats-section ranking-summary-card">
      <div class="ranking-summary-top">
        <div class="ranking-rank-badge" id="rankingMyRankBadge">
          <span class="ranking-rank-num">${t('rankingNoRank')}</span>
        </div>
        <div class="ranking-summary-info">
          <span class="ranking-summary-nickname" title="${myProfile.nickname}">${myProfile.nickname}</span>
          <span class="ranking-summary-sub">${t('rankingCardSubtitle')}</span>
        </div>
        <div class="ranking-summary-value">
          <span class="ranking-summary-time" id="rankingMyValue">--:--:--</span>
          <span class="ranking-summary-time-label" id="rankingMyValueLabel">${t(RANKING_CARD_LABEL[rankingPeriod])}</span>
        </div>
      </div>
      <div class="ranking-stat-badges">
        <div class="ranking-stat-badge">
          <span class="ranking-stat-icon">🔥</span>
          <span class="ranking-stat-value">${streakCurrent}</span>
          <span class="ranking-stat-label">${t('streakLabel')}</span>
        </div>
        <div class="ranking-stat-badge">
          <span class="ranking-stat-icon">🏆</span>
          <span class="ranking-stat-value">${streakBest}</span>
          <span class="ranking-stat-label">${t('bestLabel')}</span>
        </div>
      </div>
    </div>
    <div class="stats-section ranking-board-card">
      <div class="ranking-top-row">
        <span class="ranking-board-title">${t('rankingBoardTitle')}</span>
        <button id="rankingLogoutBtn" class="btn-secondary">${t('logoutBtn')}</button>
      </div>
      <p class="ranking-disclaimer">${t('rankingDisclaimer')}</p>
      <div class="ranking-period-tabs">
        <button class="ranking-period-btn" data-period="today">${t('rankingPeriodToday')}</button>
        <button class="ranking-period-btn" data-period="week">${t('rankingPeriodWeek')}</button>
      </div>
      <div id="rankingList" class="ranking-list"></div>
      <div id="rankingMyRow" class="ranking-my-row hidden"></div>
    </div>
  `;
}

function bindLeaderboardShell(container) {
  container.querySelector('#rankingLogoutBtn').addEventListener('click', async () => {
    await auth.signOut();
    myProfile = null;
    await renderRanking();
  });
  container.querySelectorAll('.ranking-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === rankingPeriod);
    btn.addEventListener('click', () => {
      container.querySelectorAll('.ranking-period-btn').forEach(b => b.classList.toggle('active', b === btn));
      loadLeaderboard(btn.dataset.period);
    });
  });
}

// 내 순위 요약 카드(좌측 순위 배지 + 우측 기록값)를 현재 선택된 기간에 맞춰 갱신한다.
// rank가 null이면 해당 기간에 내 기록이 없는 것 — "-"와 빈 값으로 표시한다.
function updateMyRankSummary(rank, value) {
  const badgeEl = document.getElementById('rankingMyRankBadge');
  const valueEl = document.getElementById('rankingMyValue');
  const labelEl = document.getElementById('rankingMyValueLabel');
  if (!badgeEl || !valueEl || !labelEl) return;
  if (rank == null) {
    badgeEl.innerHTML = `<span class="ranking-rank-num">${t('rankingNoRank')}</span>`;
    valueEl.textContent = '--:--:--';
  } else {
    badgeEl.innerHTML = `<span class="ranking-rank-num">${rank}</span><span class="ranking-rank-suffix">${t('rankingRankSuffix')}</span>`;
    valueEl.textContent = RANKING_METRIC[rankingPeriod].format(value || 0);
  }
  labelEl.textContent = t(RANKING_CARD_LABEL[rankingPeriod]);
}

function renderLeaderboardRows(rows) {
  const listEl = document.getElementById('rankingList');
  const myRowEl = document.getElementById('rankingMyRow');
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = `<div class="stats-empty">${t('rankingEmpty')}</div>`;
    if (myRowEl) myRowEl.classList.add('hidden');
    updateMyRankSummary(null, null);
    return;
  }
  const sess = auth.getSession();
  const metric = RANKING_METRIC[rankingPeriod];
  const maxVal = Math.max(...rows.map(r => r[metric.column] || 0), 1);

  const buildRow = (row, idx) => {
    const isMe = sess && row.user_id === sess.user.id;
    const rank = idx + 1;
    const pct = Math.max(Math.round(((row[metric.column] || 0) / maxVal) * 100), 2);
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const initial = (row.nickname || '?').trim().charAt(0).toUpperCase();
    const color = rank <= 3 ? RANKING_COLORS[idx % RANKING_COLORS.length] : RANKING_GRAY;
    return `
      <div class="ranking-row ${isMe ? 'ranking-row-me' : ''}">
        <span class="ranking-rank ${rank <= 3 ? 'ranking-rank-medal' : ''}">${medal}</span>
        <span class="ranking-avatar" style="background:${color}">${initial}</span>
        <span class="ranking-nickname">${row.nickname}${isMe ? ` <span class="ranking-me-tag">${t('rankingMeSuffix')}</span>` : ''}</span>
        <div class="ranking-bar-track"><div class="ranking-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="ranking-time">${metric.format(row[metric.column] || 0)}</span>
      </div>
    `;
  };

  listEl.innerHTML = rows.slice(0, RANKING_LIST_VISIBLE_COUNT).map(buildRow).join('');

  const myIndex = sess ? rows.findIndex(r => r.user_id === sess.user.id) : -1;
  if (myIndex >= 0) {
    myRowEl.innerHTML = `<span class="ranking-my-row-label">${t('rankingMyRowLabel')}</span>${buildRow(rows[myIndex], myIndex)}`;
    myRowEl.classList.remove('hidden');
    updateMyRankSummary(myIndex + 1, rows[myIndex][metric.column]);
  } else {
    myRowEl.classList.add('hidden');
    updateMyRankSummary(null, null);
  }
}

async function loadLeaderboard(period) {
  rankingPeriod = period;
  const listEl = document.getElementById('rankingList');
  const myRowEl = document.getElementById('rankingMyRow');
  if (!listEl) return;
  listEl.innerHTML = `<div class="stats-empty">${t('rankingLoading')}</div>`;
  if (myRowEl) myRowEl.classList.add('hidden');
  try {
    const column = RANKING_METRIC[period].column;
    const rows = await restRequest(`/${RANKING_VIEWS[period]}?select=nickname,${column},user_id&order=${column}.desc&limit=50`);
    renderLeaderboardRows(rows || []);
  } catch {
    listEl.innerHTML = `<div class="stats-empty">${t('rankingLoadError')}</div>`;
    updateMyRankSummary(null, null);
  }
}

async function renderRanking() {
  const container = document.getElementById('rankingContent');
  if (!container) return;

  if (!isSupabaseConfigured()) {
    container.innerHTML = `
      <div class="stats-section">
        <h3 class="stats-title">${t('rankingGuestTitle')}</h3>
        <p class="ranking-disclaimer">${t('rankingSetupNeeded')}</p>
      </div>
    `;
    return;
  }

  if (!auth.getSession()) {
    container.innerHTML = renderGuestLogin();
    bindGuestLogin(container);
    return;
  }

  if (!myProfile) {
    try { myProfile = await fetchMyProfile(); } catch { /* 닉네임 미설정 — 아래에서 설정 폼 표시 */ }
  }

  if (!myProfile) {
    container.innerHTML = renderNicknameForm();
    bindNicknameForm(container);
    return;
  }

  let streakCurrent = 0, streakBest = 0;
  try {
    const calc = calculateStreak(await api.getHistory());
    streakCurrent = calc.current;
    streakBest = calc.best;
  } catch { /* 계산 실패 시 0으로 표시 */ }

  container.innerHTML = renderLeaderboardShell(streakCurrent, streakBest);
  bindLeaderboardShell(container);
  await loadLeaderboard(rankingPeriod);
  syncFinalizedDays();
}

function renderTodayChart() {
  const container = document.getElementById('todayChart');
  const { selectedPrograms, times } = state;

  if (selectedPrograms.length === 0) {
    container.innerHTML = `<div class="stats-empty">${t('noPrograms')}</div>`;
    return;
  }

  const sorted = [...selectedPrograms].sort((a, b) => (times[b] || 0) - (times[a] || 0));
  const maxSecs = Math.max(...sorted.map(n => times[n] || 0), 1);

  container.innerHTML = sorted.map(name => {
    const secs = times[name] || 0;
    const pct = Math.round((secs / maxSecs) * 100);
    return `
      <div class="bar-row">
        <span class="bar-label" title="${name}">${name}</span>
        <div class="bar-track">
          <div class="bar-fill ${secs === 0 ? 'zero' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="bar-value">${formatTime(secs)}</span>
      </div>`;
  }).join('');
}

// asOf: 생략 시 "오늘"을 기준으로 계산(통계 탭 용도). 날짜 문자열을 넘기면 그 날짜를 기준으로
// 거꾸로 센다 — history에 있는 확정 기록만으로 계산하므로 자정 직후(오늘 누적이 아직 0인 시점)에
// streak가 0으로 잘못 끊기는 것을 방지한다 (랭킹의 "확정된 날짜 기준" 등록에 사용).
function calculateStreak(history, asOf) {
  const THRESHOLD = 3600;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayTotal = state.selectedPrograms.reduce((s, n) => s + (state.times[n] || 0), 0);

  const dayMap = {};
  for (const r of history) {
    dayMap[r.date] = Object.values(r.times).reduce((s, v) => s + v, 0);
  }
  if (!asOf) dayMap[todayStr] = todayTotal;

  const refStr = asOf || todayStr;
  let current = 0;
  const d = new Date(refStr);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if ((dayMap[key] || 0) >= THRESHOLD) {
      current++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const allDates = Object.keys(dayMap).sort();
  let best = 0, run = 0;
  for (let i = 0; i < allDates.length; i++) {
    if ((dayMap[allDates[i]] || 0) >= THRESHOLD) {
      if (i > 0) {
        const prev = new Date(allDates[i - 1]);
        const curr = new Date(allDates[i]);
        if ((curr - prev) / 86400000 > 1) run = 0;
      }
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best };
}

async function renderWeekChart() {
  const container = document.getElementById('weekChart');
  const history = await api.getHistory();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const DAYS = chartRange;
  const lastIdx = DAYS - 1;
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (lastIdx - i));
    return d.toISOString().slice(0, 10);
  });

  const totals = days.map(date => {
    if (date === todayStr) {
      return state.selectedPrograms.reduce((s, n) => s + (state.times[n] || 0), 0);
    }
    const record = history.find(r => r.date === date);
    return record ? Object.values(record.times).reduce((s, v) => s + v, 0) : 0;
  });

  const maxSecs = Math.max(...totals, 1);
  const maxHours = maxSecs / 3600;

  const W = 280, H = 130;
  const PAD = { top: 14, right: 22, bottom: 20, left: 26 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xOf = i => PAD.left + (i / lastIdx) * chartW;
  const yOf = secs => PAD.top + chartH - (secs / maxSecs) * chartH;

  const linePath = `M ${totals.map((s, i) => `${xOf(i).toFixed(1)} ${yOf(s).toFixed(1)}`).join(' L ')}`;
  const areaPath = `${linePath} L ${xOf(lastIdx).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${xOf(0).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  const gridStep = maxHours <= 2 ? 1 : maxHours <= 8 ? 2 : Math.ceil(maxHours / 3);
  const gridVals = [];
  for (let v = gridStep; v <= maxHours + 0.01; v += gridStep) {
    gridVals.push(Math.round(v * 10) / 10);
  }

  // x축 라벨: 범위가 길면 7일 간격, 짧으면 절반 지점에 찍는다.
  // 마지막 라벨이 끝 지점과 너무 가까우면 끝 지점으로 대체해 겹침을 방지한다
  // (예: 30일 → [0,7,14,21,29], 14일 → [0,7,13], 7일 → [0,3,6])
  const axisStep = lastIdx >= 14 ? 7 : Math.max(1, Math.round(lastIdx / 2));
  const axisIdx = [0];
  for (let i = axisStep; i < lastIdx; i += axisStep) axisIdx.push(i);
  if (lastIdx > 0) {
    if (lastIdx - axisIdx[axisIdx.length - 1] >= 3) axisIdx.push(lastIdx);
    else axisIdx[axisIdx.length - 1] = lastIdx;
  }

  const gradId = 'lineGrad';
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
      </linearGradient>
    </defs>`;

  const isLight = currentTheme === 'light';
  const baseLineColor = isLight ? '#d8d8ee' : '#1e1e2a';
  const dotBgColor = isLight ? '#f0f2f7' : '#0f0f13';

  axisIdx.forEach(i => {
    const x = xOf(i).toFixed(1);
    svg += `<line x1="${x}" y1="${PAD.top.toFixed(1)}" x2="${x}" y2="${(PAD.top + chartH).toFixed(1)}" class="week-grid-line"/>`;
  });

  const baseY = (PAD.top + chartH).toFixed(1);
  svg += `<line x1="${PAD.left}" y1="${baseY}" x2="${W - PAD.right}" y2="${baseY}" stroke="${baseLineColor}" stroke-width="1"/>`;

  gridVals.forEach(h => {
    const y = PAD.top + chartH - (h / maxHours) * chartH;
    svg += `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${W - PAD.right}" y2="${y.toFixed(1)}" class="week-grid-line"/>`;
    svg += `<text x="${PAD.left - 4}" y="${(y + 3).toFixed(1)}" class="week-axis-label" text-anchor="end">${h}h</text>`;
    svg += `<text x="${W - PAD.right + 4}" y="${(y + 3).toFixed(1)}" class="week-axis-label" text-anchor="start">${h}h</text>`;
  });

  svg += `<path d="${areaPath}" fill="url(#${gradId})"/>`;
  svg += `<path d="${linePath}" fill="none" stroke="#60a5fa" stroke-width="3" stroke-opacity="0.15" stroke-linejoin="miter" stroke-linecap="square"/>`;
  svg += `<path d="${linePath}" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linejoin="miter" stroke-linecap="square"/>`;

  totals.forEach((secs, i) => {
    const x = xOf(i), y = yOf(secs);
    const isToday = days[i] === todayStr;
    if (isToday) {
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#60a5fa" fill-opacity="0.15"/>`;
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="${dotBgColor}" stroke="#60a5fa" stroke-width="1.4"/>`;
    } else if (secs > 0) {
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2" fill="#60a5fa" fill-opacity="0.55"/>`;
    }
  });

  // 마우스 오버 시 작업 시간을 보여주는 투명 히트 타겟
  totals.forEach((secs, i) => {
    const x = xOf(i), y = yOf(secs);
    svg += `<circle class="week-chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" data-idx="${i}"/>`;
  });

  axisIdx.forEach(i => {
    const label = days[i] === todayStr ? t('todayLabel') : days[i].slice(5).replace('-', '/');
    const anchor = i === 0 ? 'start' : i === lastIdx ? 'end' : 'middle';
    svg += `<text x="${xOf(i).toFixed(1)}" y="${H - 3}" class="week-axis-label" text-anchor="${anchor}">${label}</text>`;
  });

  svg += '</svg>';

  container.innerHTML = svg;

  let tooltip = container.querySelector('.week-chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'week-chart-tooltip';
    container.appendChild(tooltip);
  }
  const svgEl = container.querySelector('svg');
  container.querySelectorAll('.week-chart-point').forEach(pt => {
    const i = Number(pt.dataset.idx);
    const secs = totals[i];
    const dateLabel = days[i] === todayStr ? t('todayLabel') : days[i];
    pt.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<span class="tt-date">${dateLabel}</span>${formatTime(secs)}`;
      tooltip.classList.add('visible');
    });
    pt.addEventListener('mousemove', (e) => {
      const wrapRect = container.getBoundingClientRect();
      const svgRect = svgEl.getBoundingClientRect();
      const cx = Number(pt.getAttribute('cx'));
      const cy = Number(pt.getAttribute('cy'));
      const px = svgRect.left - wrapRect.left + (cx / W) * svgRect.width;
      const py = svgRect.top - wrapRect.top + (cy / H) * svgRect.height;
      tooltip.style.left = `${px}px`;
      tooltip.style.top = `${(py - 8)}px`;
    });
    pt.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });

  const { current, best } = calculateStreak(history);
  document.getElementById('streakCurrent').textContent = current;
  document.getElementById('streakBest').textContent = best;
}

async function renderStats() {
  renderTodayChart();
  await renderWeekChart();
}

// ─── 자동 업데이트 ────────────────────────────────────────────────────
let pendingUpdate = null;

async function checkForUpdates(manual) {
  const statusEl = document.getElementById('updateStatus');
  const installBtn = document.getElementById('installUpdateBtn');
  if (manual && statusEl) statusEl.textContent = t('updateChecking');

  try {
    const update = await window.__TAURI__.updater.check();
    if (update) {
      pendingUpdate = update;
      if (statusEl) statusEl.textContent = `${t('updateAvailablePrefix')}${update.version}`;
      if (installBtn) installBtn.classList.remove('hidden');
    } else {
      pendingUpdate = null;
      if (statusEl) statusEl.textContent = manual ? t('updateLatest') : '';
      if (installBtn) installBtn.classList.add('hidden');
    }
  } catch (err) {
    pendingUpdate = null;
    if (manual && statusEl) statusEl.textContent = t('updateError');
  }
}

async function installUpdate() {
  if (!pendingUpdate) return;
  const statusEl = document.getElementById('updateStatus');
  const installBtn = document.getElementById('installUpdateBtn');
  const checkBtn = document.getElementById('checkUpdateBtn');
  if (installBtn) installBtn.disabled = true;
  if (checkBtn) checkBtn.disabled = true;

  try {
    let total = 0;
    let downloaded = 0;
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength || 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        const pct = total ? Math.round((downloaded / total) * 100) : 0;
        if (statusEl) statusEl.textContent = `${t('updateDownloading')}${pct}%`;
      }
    });
    await window.__TAURI__.process.relaunch();
  } catch (err) {
    if (statusEl) statusEl.textContent = t('updateError');
    if (installBtn) installBtn.disabled = false;
    if (checkBtn) checkBtn.disabled = false;
  }
}

async function init() {
  applyTheme(currentTheme);
  applyLang();

  const version = await api.getVersion();
  const verEl = document.getElementById('versionLabel');
  if (verEl) verEl.textContent = `v${version}`;

  checkForUpdates(false);

  // 랭킹: 저장된 세션이 있으면 갱신해 둔 뒤, history에 새로 확정된 날짜가 있는지 동기화
  // (진행 중인 오늘 데이터는 history에 절대 들어오지 않으므로 몇 번을 호출해도 안전함)
  if (session) await auth.refreshSession();
  syncFinalizedDays();
  setInterval(syncFinalizedDays, 30 * 60 * 1000);

  state = await api.getState();
  renderPrograms();
  updateStatus(state.activeProcess, false);
  updateFooter();
  updateTotalTime();
  updateAwayTime();
  updateFocusEfficiency();

  const idleSelect = document.getElementById('idleSelect');
  idleSelect.value = String(state.idleThreshold || 30);

  api.onTimerUpdate(({ times, awaySeconds, activeProcess, isIdle }) => {
    state.times = times;
    state.awaySeconds = awaySeconds;
    state.activeProcess = activeProcess;
    lastIsIdle = isIdle;

    state.selectedPrograms.forEach(name => {
      const row = document.querySelector(`.program-row[data-name="${name}"]`);
      if (!row) return;
      const timeEl = row.querySelector('.col-time');
      if (timeEl) timeEl.textContent = formatTime(times[name] || 0);
      const isActive = activeProcess && activeProcess.toLowerCase() === name.toLowerCase();
      row.classList.toggle('active-row', isActive && !isIdle);
    });

    updateStatus(activeProcess, isIdle);
    updateTotalTime();
    updateAwayTime();
    updateFocusEfficiency();
    updateMiniView(activeProcess, isIdle);
    updateProgramBars();
    reorderProgramRows();
  });

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  document.querySelectorAll('.chart-range-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.range) === chartRange);
    b.addEventListener('click', () => {
      chartRange = Number(b.dataset.range);
      localStorage.setItem(CHART_RANGE_STORAGE_KEY, String(chartRange));
      document.querySelectorAll('.chart-range-btn').forEach(btn => btn.classList.toggle('active', btn === b));
      renderWeekChart();
    });
  });

  // F11+F12 동시 입력: 개발자 모드 탭 토글 (평소엔 완전히 숨겨진 단축키 조합)
  // keydown은 키를 누르고 있는 동안 반복 발생하므로, Set으로 "현재 눌려있는 키"를 추적하다가
  // 두 키가 동시에 눌린 첫 순간에만 토글하고 즉시 비워서 같은 입력으로 반복 토글되지 않게 한다.
  const devModeComboKeys = new Set();
  document.addEventListener('keydown', e => {
    if (e.key !== 'F11' && e.key !== 'F12') return;
    e.preventDefault(); // F11의 기본 동작(전체 화면 전환)을 막는다
    devModeComboKeys.add(e.key);
    if (!devModeComboKeys.has('F11') || !devModeComboKeys.has('F12')) return;
    devModeComboKeys.clear();

    const devTabBtn = document.getElementById('devModeTabBtn');
    const showing = devTabBtn.classList.contains('hidden');
    devTabBtn.classList.toggle('hidden', !showing);
    if (showing) {
      switchTab('devmode');
    } else if (document.getElementById('tab-devmode') && !document.getElementById('tab-devmode').classList.contains('hidden')) {
      switchTab('home');
    }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'F11' || e.key === 'F12') devModeComboKeys.delete(e.key);
  });
  window.addEventListener('blur', () => devModeComboKeys.clear());

  document.getElementById('devDateApplyBtn').addEventListener('click', async () => {
    const input = document.getElementById('devDateInput');
    if (!input.value) return;
    await api.devSetVirtualDate(input.value);
    await refreshAfterDevChange();
  });

  document.getElementById('devDateResetBtn').addEventListener('click', async () => {
    await api.devSetVirtualDate(null);
    await refreshAfterDevChange();
  });

  document.getElementById('devRankingResetBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('devRankingResetStatus');
    const btn = document.getElementById('devRankingResetBtn');
    btn.disabled = true;
    statusEl.textContent = await resetMyRankingData();
    btn.disabled = false;
  });

  document.getElementById('devGenDummyBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('devGenDummyStatus');
    const btn = document.getElementById('devGenDummyBtn');
    const input = document.getElementById('devGenDummyCountInput');
    const count = parseInt(input.value, 10);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      statusEl.textContent = t('devGenDummyInvalidCount');
      return;
    }
    btn.disabled = true;
    statusEl.textContent = t('devGenDummyProgress').replace('{current}', '0').replace('{total}', String(count));
    statusEl.textContent = await generateDummyRankingUsers(count, (i, total) => {
      statusEl.textContent = t('devGenDummyProgress').replace('{current}', String(i + 1)).replace('{total}', String(total));
    });
    btn.disabled = false;
  });

  document.getElementById('devRankingResetAllBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('devRankingResetAllStatus');
    const btn = document.getElementById('devRankingResetAllBtn');
    btn.disabled = true;
    const msg = await resetAllRankingData();
    if (msg) statusEl.textContent = msg;
    btn.disabled = false;
  });

  [
    ['today', 'devRankingResetTodayBtn', 'devRankingResetTodayStatus'],
    ['week', 'devRankingResetWeekBtn', 'devRankingResetWeekStatus'],
    ['alltime', 'devRankingResetAlltimeBtn', 'devRankingResetAlltimeStatus'],
    ['streak', 'devRankingResetStreakBtn', 'devRankingResetStreakStatus'],
  ].forEach(([scope, btnId, statusId]) => {
    document.getElementById(btnId).addEventListener('click', async () => {
      const statusEl = document.getElementById(statusId);
      const btn = document.getElementById(btnId);
      btn.disabled = true;
      const msg = await resetRankingCategory(scope);
      if (msg) statusEl.textContent = msg;
      btn.disabled = false;
    });
  });

  document.getElementById('miniBtn').addEventListener('click', toggleMini);
  document.getElementById('expandBtn').addEventListener('click', toggleMini);

  document.getElementById('addBtn').addEventListener('click', openModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('addCustomBtn').addEventListener('click', addProgram);

  document.getElementById('resetAllBtn').addEventListener('click', async () => {
    await api.resetAllTimers();
    state.selectedPrograms.forEach(name => { state.times[name] = 0; });
    state.awaySeconds = 0;
    renderPrograms();
    updateTotalTime();
    updateAwayTime();
    updateFocusEfficiency();
  });

  idleSelect.addEventListener('change', async () => {
    const val = parseInt(idleSelect.value, 10);
    state.idleThreshold = val;
    await api.setIdleThreshold(val);
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    selectedInModal = null;
    renderProcessList(e.target.value);
  });

  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addProgram();
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // 설정: 테마 토글
  document.querySelectorAll('[data-theme-opt]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeOpt));
  });

  // 설정: 업데이트 확인 / 설치
  document.getElementById('checkUpdateBtn').addEventListener('click', () => checkForUpdates(true));
  document.getElementById('installUpdateBtn').addEventListener('click', installUpdate);

  // 저장된 설정 반영
  document.querySelectorAll('[data-theme-opt]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeOpt === currentTheme);
  });
}

init();
