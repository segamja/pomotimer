'use strict';

/* ===== Storage (localStorage cache) ===== */
const Storage = {
  KEYS: {
    TODOS: 'timer-todo:todos',
    FILTER: 'timer-todo:filter',
    TIMER: 'timer-todo:timer',
  },

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable */
    }
  },

  initAutoSave() {
    window.addEventListener('pagehide', () => this.saveAll());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveAll();
    });
  },

  saveAll() {
    Timer.saveSettings();
    TodoList.save();
    Storage.set(Storage.KEYS.FILTER, TodoList.filter);
  },
};

/* ===== AppShell ===== */
const QUOTES = [
  { text: '시간은 가장 귀중한 자본이다.', author: '테오프라스투스' },
  { text: '오늘 할 일을 내일로 미루지 마라.', author: '벤저민 프랭클린' },
  { text: '시간을 낭비하지 않는 자가 성공한다.', author: '벤저민 프랭클린' },
  { text: '집중은 성공의 열쇠다.', author: '' },
  { text: '한 번에 하나씩, 천천히 but 확실하게.', author: '' },
  { text: '시간은 되돌릴 수 없다. 지금 이 순간을 소중히.', author: '' },
  { text: '25분의 집중이 하루를 바꾼다.', author: '포모도로 기법' },
  { text: '쉬는 것도 일의 일부다.', author: '' },
  { text: '지금 이 순간에 최선을 다하라.', author: '' },
  { text: '작은 습관이 큰 변화를 만든다.', author: '' },
  { text: '시간 관리는 자기 관리다.', author: '' },
  { text: '미루지 말고, 지금 시작하라.', author: '' },
];

const AppShell = {
  init() {
    this.initQuoteMarquee();
  },

  formatQuote(quote) {
    const author = quote.author ? ` — ${quote.author}` : '';
    return `"${quote.text}"${author}`;
  },

  initQuoteMarquee() {
    const track = document.getElementById('quote-track');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      track.classList.add('app-header__quote-track--static');
      track.innerHTML = `<span class="app-header__quote-item app-header__quote-item--static">${this.formatQuote(quote)}</span>`;
      return;
    }

    const shuffled = [...QUOTES].sort(() => Math.random() - 0.5);
    const line = shuffled.map((quote) => this.formatQuote(quote)).join('   ·   ');
    track.innerHTML = `
      <span class="app-header__quote-item">${line}</span>
      <span class="app-header__quote-item" aria-hidden="true">${line}</span>`;

    requestAnimationFrame(() => {
      const segment = track.querySelector('.app-header__quote-item');
      if (!segment) return;
      const duration = Math.max(24, segment.offsetWidth / 45);
      track.style.setProperty('--quote-marquee-duration', `${duration}s`);
    });
  },
};

/* ===== Timer ===== */
const PRESET_LABELS = {
  focus: '집중',
  'short-break': '휴식',
  'long-break': '긴 휴식',
  custom: '사용자 설정',
};

const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const Timer = {
  state: {
    mode: 'focus',
    total: 25 * 60,
    remaining: 25 * 60,
    running: false,
    startedAt: null,
    intervalId: null,
  },

  els: {},

  init() {
    this.els = {
      section: document.getElementById('timer-section'),
      modeLabel: document.getElementById('timer-mode-label'),
      display: document.getElementById('timer-display'),
      ringProgress: document.getElementById('timer-ring-progress'),
      startBtn: document.getElementById('timer-start-btn'),
      presetBtns: document.querySelectorAll('.segment-control__btn'),
      customForm: document.getElementById('timer-custom-form'),
      customDetails: document.getElementById('timer-custom-details'),
      minutesInput: document.getElementById('timer-minutes'),
      secondsInput: document.getElementById('timer-seconds'),
      resetBtn: document.getElementById('timer-reset-btn'),
    };

    this.els.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

    this.lastSavedAt = 0;
    this.loadSettings();
    this.bindEvents();
    this.render();
    this.restoreRunningState();
    this.requestNotificationPermission();
  },

  loadSettings() {
    const saved = Storage.get(Storage.KEYS.TIMER, null);
    if (!saved) return;

    this.state.mode = saved.mode || 'focus';
    this.state.total = saved.total || 25 * 60;
    this.state.remaining = saved.remaining ?? this.state.total;

    if (saved.running && saved.startedAt) {
      const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
      this.state.remaining = Math.max(0, this.state.total - elapsed);
      this.state.running = this.state.remaining > 0;
      this.state.startedAt = saved.startedAt;
    }

    const mins = Math.floor(this.state.total / 60);
    const secs = this.state.total % 60;
    this.els.minutesInput.value = mins;
    this.els.secondsInput.value = secs;

    this.updatePresetButtons();
  },

  saveSettings() {
    Storage.set(Storage.KEYS.TIMER, {
      mode: this.state.mode,
      total: this.state.total,
      remaining: this.state.remaining,
      running: this.state.running,
      startedAt: this.state.startedAt,
    });
  },

  restoreRunningState() {
    if (!this.state.running) return;

    this.setInputsDisabled(true);
    this.updateStartButton(true);
    this.state.intervalId = setInterval(() => this.tick(), 250);
    this.tick();
  },

  bindEvents() {
    this.els.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.state.running) return;
        const minutes = parseInt(btn.dataset.minutes, 10);
        const preset = btn.dataset.preset;
        this.setTime(preset, minutes * 60);
      });
    });

    this.els.customForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.state.running) return;
      const mins = this.clamp(parseInt(this.els.minutesInput.value, 10) || 0, 0, 99);
      const secs = this.clamp(parseInt(this.els.secondsInput.value, 10) || 0, 0, 59);
      const total = mins * 60 + secs;
      if (total === 0) return;
      this.setTime('custom', total);
      this.els.customDetails.open = false;
    });

    this.els.startBtn.addEventListener('click', () => {
      if (this.state.running) this.pause();
      else this.start();
    });

    this.els.resetBtn.addEventListener('click', () => this.reset());
  },

  clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  },

  setTime(mode, seconds) {
    this.state.mode = mode;
    this.state.total = seconds;
    this.state.remaining = seconds;

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.els.minutesInput.value = mins;
    this.els.secondsInput.value = secs;

    this.updatePresetButtons();
    this.render();
    this.saveSettings();
  },

  updatePresetButtons() {
    this.els.presetBtns.forEach((btn) => {
      const isActive = btn.dataset.preset === this.state.mode;
      btn.classList.toggle('segment-control__btn--active', isActive);
    });

    if (this.state.mode === 'custom') {
      this.els.presetBtns.forEach((btn) => btn.classList.remove('segment-control__btn--active'));
    }
  },

  start() {
    if (this.state.remaining === 0) {
      this.state.remaining = this.state.total;
    }
    if (this.state.remaining === 0) return;

    this.state.running = true;
    this.state.startedAt = Date.now() - (this.state.total - this.state.remaining) * 1000;

    this.setInputsDisabled(true);
    this.updateStartButton(true);
    this.saveSettings();

    this.state.intervalId = setInterval(() => this.tick(), 250);
    this.tick();
  },

  pause() {
    this.state.running = false;
    clearInterval(this.state.intervalId);
    this.state.intervalId = null;
    this.state.startedAt = null;

    this.setInputsDisabled(false);
    this.updateStartButton(false);
    this.saveSettings();
  },

  reset() {
    this.pause();
    this.state.remaining = this.state.total;
    this.render();
    this.saveSettings();
  },

  tick() {
    if (!this.state.running) return;

    const elapsed = Math.floor((Date.now() - this.state.startedAt) / 1000);
    this.state.remaining = Math.max(0, this.state.total - elapsed);
    this.render();
    this.saveSettingsThrottled();

    if (this.state.remaining === 0) {
      this.onComplete();
    }
  },

  saveSettingsThrottled() {
    const now = Date.now();
    if (now - this.lastSavedAt < 3000) return;
    this.lastSavedAt = now;
    this.saveSettings();
  },

  onComplete() {
    this.pause();
    this.playBeep();
    this.showNotification();
  },

  setInputsDisabled(disabled) {
    this.els.presetBtns.forEach((btn) => { btn.disabled = disabled; });
    this.els.minutesInput.disabled = disabled;
    this.els.secondsInput.disabled = disabled;
    document.getElementById('timer-apply-btn').disabled = disabled;
  },

  updateStartButton(isRunning) {
    this.els.startBtn.textContent = isRunning ? '일시정지' : '시작';
    this.els.startBtn.setAttribute('aria-label', isRunning ? '일시정지' : '시작');
  },

  updateProgressRing() {
    const progress = this.state.total > 0 ? this.state.remaining / this.state.total : 0;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    this.els.ringProgress.style.strokeDashoffset = String(offset);
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  render() {
    this.els.display.textContent = this.formatTime(this.state.remaining);
    this.els.modeLabel.textContent = PRESET_LABELS[this.state.mode] || '타이머';
    this.updateProgressRing();

    this.els.section.className = 'timer-section';
    if (this.state.mode === 'focus' || this.state.mode === 'custom') {
      this.els.section.classList.add('mode-focus');
    } else if (this.state.mode === 'short-break') {
      this.els.section.classList.add('mode-short-break');
    } else if (this.state.mode === 'long-break') {
      this.els.section.classList.add('mode-long-break');
    }

    document.title = `${this.formatTime(this.state.remaining)} — Pomodoro Timer`;
  },

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  showNotification() {
    const label = PRESET_LABELS[this.state.mode] || '타이머';
    const body = `${label} 시간이 끝났습니다!`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro Timer', { body });
    }
  },

  playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      /* audio not available */
    }
  },
};

/* ===== TodoList ===== */
const TodoList = {
  todos: [],
  filter: 'all',

  els: {},

  init() {
    this.els = {
      form: document.getElementById('todo-form'),
      input: document.getElementById('todo-input'),
      list: document.getElementById('todo-list'),
      counter: document.getElementById('todo-counter'),
      empty: document.getElementById('todo-empty'),
      filterBtns: document.querySelectorAll('.filter-pill'),
    };

    this.todos = Storage.get(Storage.KEYS.TODOS, []);
    this.filter = Storage.get(Storage.KEYS.FILTER, 'all');

    this.bindEvents();
    this.updateFilterUI();
    this.render();
  },

  bindEvents() {
    this.els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.add(this.els.input.value);
      this.els.input.value = '';
      this.els.input.focus();
    });

    this.els.list.addEventListener('click', (e) => {
      const item = e.target.closest('.todo-item');
      if (!item) return;

      const id = item.dataset.id;
      const checkBtn = e.target.closest('.todo-item__check');
      const deleteBtn = e.target.closest('.todo-item__delete');

      if (checkBtn) {
        this.toggle(id);
      } else if (deleteBtn) {
        this.remove(id);
      }
    });

    this.els.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.filter;
        Storage.set(Storage.KEYS.FILTER, this.filter);
        this.updateFilterUI();
        this.render();
      });
    });
  },

  add(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.todos.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    });

    this.save();
    this.render();
  },

  toggle(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.save();
      this.render();
    }
  },

  remove(id) {
    this.todos = this.todos.filter((t) => t.id !== id);
    this.save();
    this.render();
  },

  save() {
    Storage.set(Storage.KEYS.TODOS, this.todos);
  },

  getFiltered() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter((t) => !t.completed);
      case 'completed':
        return this.todos.filter((t) => t.completed);
      default:
        return this.todos;
    }
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isToday) return '오늘';

    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  },

  updateFilterUI() {
    this.els.filterBtns.forEach((btn) => {
      const isActive = btn.dataset.filter === this.filter;
      btn.classList.toggle('filter-pill--active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
  },

  render() {
    const filtered = this.getFiltered();
    const activeCount = this.todos.filter((t) => !t.completed).length;

    this.els.counter.textContent =
      activeCount === 0 ? '할 일 없음' : `${activeCount}개 남음`;

    this.els.list.innerHTML = filtered
      .map(
        (todo) => `
        <li class="todo-item${todo.completed ? ' todo-item--completed' : ''}" data-id="${todo.id}">
          <button type="button" class="todo-item__check" aria-label="${todo.completed ? '완료 취소' : '완료'}: ${this.escapeHtml(todo.text)}">
            <svg class="todo-item__check-icon" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <div class="todo-item__body">
            <span class="todo-item__text">${this.escapeHtml(todo.text)}</span>
            <div class="todo-item__meta">
              <span class="todo-item__date">
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
                  <path d="M1 5h10M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                ${this.formatDate(todo.createdAt)}
              </span>
            </div>
          </div>
          <button type="button" class="todo-item__delete" aria-label="삭제: ${this.escapeHtml(todo.text)}">
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </li>`
      )
      .join('');

    const showEmpty = filtered.length === 0;
    this.els.empty.classList.toggle('todo-empty--hidden', !showEmpty);

    if (showEmpty) {
      const messages = {
        all: { text: '할 일이 없습니다', hint: '아래에서 할 일을 추가해 보세요' },
        active: { text: '진행 중인 할 일이 없습니다', hint: '새 할 일을 추가하거나 필터를 변경해 보세요' },
        completed: { text: '완료된 할 일이 없습니다', hint: '할 일을 완료하면 여기에 표시됩니다' },
      };
      const msg = messages[this.filter];
      this.els.empty.querySelector('.todo-empty__text').textContent = msg.text;
      this.els.empty.querySelector('.todo-empty__hint').textContent = msg.hint;
    }
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  Storage.initAutoSave();
  AppShell.init();
  Timer.init();
  TodoList.init();
});
