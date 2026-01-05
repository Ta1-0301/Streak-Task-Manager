// ============================================
// Streak Task Manager - メインアプリケーション
// ============================================

// データストア
const Store = {
    KEYS: {
        TASKS: 'streak_tasks',
        MEMOS: 'streak_memos',
        REFLECTIONS: 'streak_reflections',
        WORK_LOGS: 'streak_work_logs',
        STREAK_DATA: 'streak_data'
    },

    // LocalStorageから読み込み
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },

    // LocalStorageに保存
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error writing to localStorage:', e);
            return false;
        }
    },

    // 初期化
    init() {
        if (!this.get(this.KEYS.TASKS)) this.set(this.KEYS.TASKS, []);
        if (!this.get(this.KEYS.MEMOS)) this.set(this.KEYS.MEMOS, []);
        if (!this.get(this.KEYS.REFLECTIONS)) this.set(this.KEYS.REFLECTIONS, []);
        if (!this.get(this.KEYS.WORK_LOGS)) this.set(this.KEYS.WORK_LOGS, []);
        if (!this.get(this.KEYS.STREAK_DATA)) {
            this.set(this.KEYS.STREAK_DATA, {
                currentStreak: 0,
                bestStreak: 0,
                achievedDates: [],
                lastCheckedDate: null
            });
        }
    }
};

// ユーティリティ
const Utils = {
    // 一意のID生成
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 日付フォーマット
    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    },

    // 日付を YYYY-MM-DD 形式に
    toDateString(date) {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    // 今日の日付文字列
    today() {
        return this.toDateString(new Date());
    },

    // 時間フォーマット
    formatTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) {
            return `${h}時間${m > 0 ? m + '分' : ''}`;
        }
        return `${m}分`;
    },

    // タイマー表示用フォーマット
    formatTimerDisplay(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return {
            hours: h.toString().padStart(2, '0'),
            minutes: m.toString().padStart(2, '0'),
            seconds: s.toString().padStart(2, '0')
        };
    }
};

// ============================================
// タスク管理
// ============================================
const TaskManager = {
    getTasks() {
        return Store.get(Store.KEYS.TASKS) || [];
    },

    saveTasks(tasks) {
        Store.set(Store.KEYS.TASKS, tasks);
    },

    addTask(task) {
        const tasks = this.getTasks();
        const newTask = {
            id: Utils.generateId(),
            name: task.name,
            description: task.description || '',
            deadline: task.deadline || null,
            priority: task.priority || 'medium',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            workTime: 0 // 分単位
        };
        tasks.push(newTask);
        this.saveTasks(tasks);
        return newTask;
    },

    updateTask(id, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            this.saveTasks(tasks);
            return tasks[index];
        }
        return null;
    },

    deleteTask(id) {
        const tasks = this.getTasks().filter(t => t.id !== id);
        this.saveTasks(tasks);
    },

    toggleComplete(id) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveTasks(tasks);
            
            // タスク完了時にストリークをチェック
            if (task.completed) {
                StreakManager.checkAndUpdateStreak();
            }
            
            return task;
        }
        return null;
    },

    getTodaysTasks() {
        const today = Utils.today();
        return this.getTasks().filter(t => {
            if (t.deadline === today) return true;
            if (!t.deadline && !t.completed) return true;
            if (t.completedAt && Utils.toDateString(t.completedAt) === today) return true;
            return false;
        });
    },

    getActiveTasks() {
        return this.getTasks().filter(t => !t.completed);
    },

    getCompletedTasks() {
        return this.getTasks().filter(t => t.completed);
    },

    searchTasks(query) {
        const q = query.toLowerCase();
        return this.getTasks().filter(t => 
            t.name.toLowerCase().includes(q) || 
            t.description.toLowerCase().includes(q)
        );
    },

    addWorkTime(id, minutes) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.workTime = (task.workTime || 0) + minutes;
            this.saveTasks(tasks);
            
            // 作業ログを記録
            WorkLogManager.addLog(id, minutes);
            
            return task;
        }
        return null;
    }
};

// ============================================
// ストリーク管理
// ============================================
const StreakManager = {
    getData() {
        return Store.get(Store.KEYS.STREAK_DATA) || {
            currentStreak: 0,
            bestStreak: 0,
            achievedDates: [],
            lastCheckedDate: null
        };
    },

    saveData(data) {
        Store.set(Store.KEYS.STREAK_DATA, data);
    },

    checkAndUpdateStreak() {
        const today = Utils.today();
        const data = this.getData();
        
        // 今日完了したタスクがあるかチェック
        const todayCompleted = TaskManager.getTasks().some(t => 
            t.completed && t.completedAt && Utils.toDateString(t.completedAt) === today
        );
        
        if (!todayCompleted) return data;
        
        // 今日が既に達成済みかチェック
        if (data.achievedDates.includes(today)) return data;
        
        // 今日を達成日として追加
        data.achievedDates.push(today);
        
        // 昨日が達成日かチェック
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = Utils.toDateString(yesterday);
        
        if (data.lastCheckedDate === yesterdayStr && data.achievedDates.includes(yesterdayStr)) {
            // 連続継続
            data.currentStreak++;
        } else if (!data.lastCheckedDate || data.lastCheckedDate !== yesterdayStr) {
            // 連続が途切れたか初回
            data.currentStreak = 1;
        }
        
        // 最高記録更新
        if (data.currentStreak > data.bestStreak) {
            data.bestStreak = data.currentStreak;
        }
        
        data.lastCheckedDate = today;
        this.saveData(data);
        
        return data;
    },

    // 日付変更時のストリークチェック
    checkStreakOnDateChange() {
        const today = Utils.today();
        const data = this.getData();
        
        if (data.lastCheckedDate && data.lastCheckedDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = Utils.toDateString(yesterday);
            
            // 昨日が達成されていなければリセット
            if (!data.achievedDates.includes(yesterdayStr)) {
                data.currentStreak = 0;
            }
        }
        
        this.saveData(data);
        return data;
    },

    getBadges() {
        const data = this.getData();
        const badges = [
            { days: 7, label: '7日達成', icon: '🎯' },
            { days: 30, label: '30日達成', icon: '⭐' },
            { days: 100, label: '100日達成', icon: '🏆' }
        ];
        
        return badges.map(b => ({
            ...b,
            earned: data.bestStreak >= b.days
        }));
    },

    isDateAchieved(dateStr) {
        const data = this.getData();
        return data.achievedDates.includes(dateStr);
    }
};

// ============================================
// 作業ログ管理
// ============================================
const WorkLogManager = {
    getLogs() {
        return Store.get(Store.KEYS.WORK_LOGS) || [];
    },

    saveLogs(logs) {
        Store.set(Store.KEYS.WORK_LOGS, logs);
    },

    addLog(taskId, minutes) {
        const logs = this.getLogs();
        logs.push({
            id: Utils.generateId(),
            taskId,
            minutes,
            date: Utils.today(),
            timestamp: new Date().toISOString()
        });
        this.saveLogs(logs);
    },

    getLogsByDate(dateStr) {
        return this.getLogs().filter(l => l.date === dateStr);
    },

    getTotalTimeByDate(dateStr) {
        return this.getLogsByDate(dateStr).reduce((sum, l) => sum + l.minutes, 0);
    },

    getTotalTimeByTask(taskId) {
        return this.getLogs()
            .filter(l => l.taskId === taskId)
            .reduce((sum, l) => sum + l.minutes, 0);
    },

    getRecentDaysData(days) {
        const result = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = Utils.toDateString(date);
            result.push({
                date: dateStr,
                label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                minutes: this.getTotalTimeByDate(dateStr)
            });
        }
        
        return result;
    }
};

// ============================================
// メモ管理
// ============================================
const MemoManager = {
    getMemos() {
        return Store.get(Store.KEYS.MEMOS) || [];
    },

    saveMemos(memos) {
        Store.set(Store.KEYS.MEMOS, memos);
    },

    addMemo(memo) {
        const memos = this.getMemos();
        const newMemo = {
            id: Utils.generateId(),
            title: memo.title || '無題',
            content: memo.content || '',
            taskId: memo.taskId || null,
            createdAt: new Date().toISOString()
        };
        memos.unshift(newMemo);
        this.saveMemos(memos);
        return newMemo;
    },

    deleteMemo(id) {
        const memos = this.getMemos().filter(m => m.id !== id);
        this.saveMemos(memos);
    },

    searchMemos(query) {
        const q = query.toLowerCase();
        return this.getMemos().filter(m => 
            m.title.toLowerCase().includes(q) || 
            m.content.toLowerCase().includes(q)
        );
    }
};

// ============================================
// 振り返り管理
// ============================================
const ReflectionManager = {
    getReflections() {
        return Store.get(Store.KEYS.REFLECTIONS) || [];
    },

    saveReflections(reflections) {
        Store.set(Store.KEYS.REFLECTIONS, reflections);
    },

    saveToday(good, goal) {
        const reflections = this.getReflections();
        const today = Utils.today();
        
        const existing = reflections.find(r => r.date === today);
        if (existing) {
            existing.good = good;
            existing.goal = goal;
            existing.updatedAt = new Date().toISOString();
        } else {
            reflections.unshift({
                id: Utils.generateId(),
                date: today,
                good,
                goal,
                createdAt: new Date().toISOString()
            });
        }
        
        this.saveReflections(reflections);
    },

    getToday() {
        const today = Utils.today();
        return this.getReflections().find(r => r.date === today) || null;
    }
};

// ============================================
// タイマー
// ============================================
const Timer = {
    seconds: 0,
    interval: null,
    taskId: null,
    isRunning: false,

    start(taskId) {
        if (this.isRunning) return;
        this.taskId = taskId;
        this.isRunning = true;
        this.interval = setInterval(() => {
            this.seconds++;
            this.updateDisplay();
        }, 1000);
    },

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.interval);
    },

    stop() {
        if (this.seconds > 0 && this.taskId) {
            const minutes = Math.ceil(this.seconds / 60);
            TaskManager.addWorkTime(this.taskId, minutes);
            UI.showToast(`${minutes}分の作業時間を記録しました`, 'success');
        }
        this.reset();
    },

    reset() {
        this.pause();
        this.seconds = 0;
        this.taskId = null;
        this.updateDisplay();
    },

    updateDisplay() {
        const time = Utils.formatTimerDisplay(this.seconds);
        document.getElementById('timer-hours').textContent = time.hours;
        document.getElementById('timer-minutes').textContent = time.minutes;
        document.getElementById('timer-seconds').textContent = time.seconds;
    }
};

// ============================================
// UI管理
// ============================================
const UI = {
    currentTab: 'dashboard',
    currentFilter: 'all',
    currentMonth: new Date(),

    init() {
        this.bindEvents();
        this.renderAll();
    },

    bindEvents() {
        // タブ切り替え
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // タスクフォーム
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddTask();
        });

        // クイック追加
        document.getElementById('quick-add-btn').addEventListener('click', () => {
            this.openModal('quick-add-modal');
        });

        document.getElementById('quick-add-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuickAddTask();
        });

        document.getElementById('quick-add-close').addEventListener('click', () => {
            this.closeModal('quick-add-modal');
        });

        // タスクフィルター
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderTaskList();
            });
        });

        // タスク検索
        document.getElementById('task-search').addEventListener('input', (e) => {
            this.renderTaskList(e.target.value);
        });

        // タスク編集モーダル
        document.getElementById('edit-modal-close').addEventListener('click', () => {
            this.closeModal('edit-task-modal');
        });

        document.getElementById('edit-modal-cancel').addEventListener('click', () => {
            this.closeModal('edit-task-modal');
        });

        document.getElementById('edit-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpdateTask();
        });

        // モーダルオーバーレイ
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                overlay.closest('.modal').classList.remove('active');
            });
        });

        // タイマー
        document.getElementById('timer-start').addEventListener('click', () => {
            const taskId = document.getElementById('timer-task-select').value;
            if (!taskId) {
                this.showToast('タスクを選択してください', 'error');
                return;
            }
            Timer.start(taskId);
            document.getElementById('timer-start').disabled = true;
            document.getElementById('timer-pause').disabled = false;
            document.getElementById('timer-stop').disabled = false;
        });

        document.getElementById('timer-pause').addEventListener('click', () => {
            if (Timer.isRunning) {
                Timer.pause();
                document.getElementById('timer-pause').innerHTML = '<span class="material-icons">play_arrow</span>';
            } else {
                Timer.start(Timer.taskId);
                document.getElementById('timer-pause').innerHTML = '<span class="material-icons">pause</span>';
            }
        });

        document.getElementById('timer-stop').addEventListener('click', () => {
            Timer.stop();
            document.getElementById('timer-start').disabled = false;
            document.getElementById('timer-pause').disabled = true;
            document.getElementById('timer-stop').disabled = true;
            document.getElementById('timer-pause').innerHTML = '<span class="material-icons">pause</span>';
            this.renderAll();
        });

        // カレンダーナビ
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });

        // メモフォーム
        document.getElementById('memo-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddMemo();
        });

        // 振り返りフォーム
        document.getElementById('reflection-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveReflection();
        });

        // メモ検索
        document.getElementById('memo-search').addEventListener('input', (e) => {
            this.renderMemoList(e.target.value);
        });

        // グラフ期間変更
        document.getElementById('bar-chart-period').addEventListener('change', (e) => {
            this.renderBarChart(parseInt(e.target.value));
        });
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // タブ切り替え時にデータ更新
        if (tabName === 'stats') {
            this.renderCharts();
        }
    },

    renderAll() {
        StreakManager.checkStreakOnDateChange();
        this.renderStreak();
        this.renderCalendar();
        this.renderTodayTasks();
        this.renderTaskList();
        this.updateTimerTaskSelect();
        this.renderStats();
        this.renderMemoList();
        this.loadTodayReflection();
        this.updateMemoTaskSelect();
    },

    // ストリーク表示
    renderStreak() {
        const data = StreakManager.getData();
        document.getElementById('streak-count').textContent = data.currentStreak;
        
        // バッジ
        const badges = StreakManager.getBadges();
        const badgesHtml = badges.map(b => `
            <span class="badge ${b.earned ? 'badge-earned' : 'badge-locked'}">
                ${b.icon} ${b.label}
            </span>
        `).join('');
        document.getElementById('streak-badges').innerHTML = badgesHtml;
        
        // メッセージ
        const today = Utils.today();
        const todayAchieved = StreakManager.isDateAchieved(today);
        const message = todayAchieved 
            ? '🎉 今日の目標達成！継続おめでとう！' 
            : '今日のタスクを完了して継続を維持しよう！';
        document.getElementById('streak-message').textContent = message;
    },

    // カレンダー表示
    renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        document.getElementById('current-month').textContent = 
            `${year}年${month + 1}月`;
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const today = Utils.today();
        
        const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
        let html = dayHeaders.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
        
        // 前月の日
        for (let i = 0; i < firstDay.getDay(); i++) {
            const prevDate = new Date(year, month, -firstDay.getDay() + i + 1);
            html += `<div class="calendar-day other-month">${prevDate.getDate()}</div>`;
        }
        
        // 当月の日
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isAchieved = StreakManager.isDateAchieved(dateStr);
            
            const classes = ['calendar-day'];
            if (isToday) classes.push('today');
            if (isAchieved) classes.push('achieved');
            
            html += `<div class="${classes.join(' ')}">${day}</div>`;
        }
        
        document.getElementById('calendar-grid').innerHTML = html;
    },

    // 今日のタスク表示
    renderTodayTasks() {
        const tasks = TaskManager.getTodaysTasks();
        const container = document.getElementById('today-tasks-list');
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 1rem;">
                    <p style="color: var(--text-muted);">今日のタスクはありません</p>
                </div>
            `;
        } else {
            container.innerHTML = tasks.map(task => `
                <div class="today-task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                    <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="UI.toggleTaskComplete('${task.id}')">
                        <span class="material-icons">check</span>
                    </div>
                    <span class="task-name">${this.escapeHtml(task.name)}</span>
                    <div class="priority-dot ${task.priority}"></div>
                    ${task.workTime ? `<span class="task-time">⏱ ${Utils.formatTime(task.workTime)}</span>` : ''}
                </div>
            `).join('');
        }
        
        // プログレス更新
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        
        document.getElementById('today-progress-fill').style.width = `${percentage}%`;
        document.getElementById('today-progress-text').textContent = `${completed}/${total} 完了`;
    },

    // タスク一覧表示
    renderTaskList(searchQuery = '') {
        let tasks = TaskManager.getTasks();
        
        // フィルター
        if (this.currentFilter === 'active') {
            tasks = tasks.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            tasks = tasks.filter(t => t.completed);
        }
        
        // 検索
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            tasks = tasks.filter(t => 
                t.name.toLowerCase().includes(q) || 
                t.description.toLowerCase().includes(q)
            );
        }
        
        // 優先度でソート
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        const container = document.getElementById('task-list');
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">task_alt</span>
                    <p>タスクがありません</p>
                </div>
            `;
        } else {
            container.innerHTML = tasks.map(task => `
                <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                    <div class="task-checkbox-large ${task.completed ? 'checked' : ''}" onclick="UI.toggleTaskComplete('${task.id}')">
                        <span class="material-icons">check</span>
                    </div>
                    <div class="task-info">
                        <h3>${this.escapeHtml(task.name)}</h3>
                        ${task.description ? `<p>${this.escapeHtml(task.description)}</p>` : ''}
                        <div class="task-meta">
                            <span class="task-tag priority-${task.priority}">
                                ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                            </span>
                            ${task.deadline ? `
                                <span class="task-tag">
                                    <span class="material-icons">event</span>
                                    ${Utils.formatDate(task.deadline)}
                                </span>
                            ` : ''}
                            ${task.workTime ? `
                                <span class="task-tag">
                                    <span class="material-icons">timer</span>
                                    ${Utils.formatTime(task.workTime)}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn" onclick="UI.openEditTaskModal('${task.id}')" title="編集">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="task-action-btn delete" onclick="UI.deleteTask('${task.id}')" title="削除">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    },

    // タスク追加
    handleAddTask() {
        const name = document.getElementById('task-name').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        const priority = document.getElementById('task-priority').value;
        
        if (!name) {
            this.showToast('タスク名を入力してください', 'error');
            return;
        }
        
        TaskManager.addTask({ name, description, deadline, priority });
        
        // フォームリセット
        document.getElementById('task-form').reset();
        
        this.showToast('タスクを追加しました', 'success');
        this.renderAll();
    },

    // クイック追加
    handleQuickAddTask() {
        const name = document.getElementById('quick-task-name').value.trim();
        const priority = document.getElementById('quick-task-priority').value;
        
        if (!name) {
            this.showToast('タスク名を入力してください', 'error');
            return;
        }
        
        TaskManager.addTask({ name, priority, deadline: Utils.today() });
        
        document.getElementById('quick-add-form').reset();
        this.closeModal('quick-add-modal');
        
        this.showToast('タスクを追加しました', 'success');
        this.renderAll();
    },

    // タスク完了切り替え
    toggleTaskComplete(id) {
        TaskManager.toggleComplete(id);
        this.renderAll();
    },

    // タスク削除
    deleteTask(id) {
        if (confirm('このタスクを削除しますか？')) {
            TaskManager.deleteTask(id);
            this.showToast('タスクを削除しました', 'success');
            this.renderAll();
        }
    },

    // タスク編集モーダル
    openEditTaskModal(id) {
        const task = TaskManager.getTasks().find(t => t.id === id);
        if (!task) return;
        
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-name').value = task.name;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-deadline').value = task.deadline || '';
        document.getElementById('edit-task-priority').value = task.priority;
        document.getElementById('edit-task-time').value = task.workTime || '';
        
        this.openModal('edit-task-modal');
    },

    // タスク更新
    handleUpdateTask() {
        const id = document.getElementById('edit-task-id').value;
        const updates = {
            name: document.getElementById('edit-task-name').value.trim(),
            description: document.getElementById('edit-task-description').value.trim(),
            deadline: document.getElementById('edit-task-deadline').value || null,
            priority: document.getElementById('edit-task-priority').value,
            workTime: parseInt(document.getElementById('edit-task-time').value) || 0
        };
        
        TaskManager.updateTask(id, updates);
        this.closeModal('edit-task-modal');
        this.showToast('タスクを更新しました', 'success');
        this.renderAll();
    },

    // タイマーのタスク選択更新
    updateTimerTaskSelect() {
        const tasks = TaskManager.getActiveTasks();
        const select = document.getElementById('timer-task-select');
        
        select.innerHTML = '<option value="">タスクを選択...</option>' +
            tasks.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
    },

    // 統計表示
    renderStats() {
        const tasks = TaskManager.getTasks();
        const streakData = StreakManager.getData();
        const logs = WorkLogManager.getLogs();
        
        const totalTime = logs.reduce((sum, l) => sum + l.minutes, 0);
        const hours = Math.floor(totalTime / 60);
        
        document.getElementById('stat-total-tasks').textContent = tasks.length;
        document.getElementById('stat-completed-tasks').textContent = 
            tasks.filter(t => t.completed).length;
        document.getElementById('stat-total-time').textContent = `${hours}h`;
        document.getElementById('stat-best-streak').textContent = streakData.bestStreak;
    },

    // グラフ描画
    renderCharts() {
        this.renderBarChart(7);
        this.renderPieChart();
        this.renderLineChart();
    },

    renderBarChart(days = 7) {
        const data = WorkLogManager.getRecentDaysData(days);
        const canvas = document.getElementById('bar-chart');
        
        // 既存のチャートを破棄
        if (window.barChart) window.barChart.destroy();
        
        window.barChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    label: '作業時間（分）',
                    data: data.map(d => d.minutes),
                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                        }
                    }
                }
            }
        });
    },

    renderPieChart() {
        const tasks = TaskManager.getTasks().filter(t => t.workTime > 0);
        const canvas = document.getElementById('pie-chart');
        
        if (window.pieChart) window.pieChart.destroy();
        
        if (tasks.length === 0) {
            window.pieChart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['データなし'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(107, 107, 123, 0.5)']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.6)'
                            }
                        }
                    }
                }
            });
            return;
        }
        
        const colors = [
            'rgba(255, 107, 53, 0.8)',
            'rgba(102, 126, 234, 0.8)',
            'rgba(17, 153, 142, 0.8)',
            'rgba(240, 147, 251, 0.8)',
            'rgba(247, 197, 49, 0.8)',
            'rgba(56, 239, 125, 0.8)'
        ];
        
        window.pieChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: tasks.map(t => t.name.substring(0, 15) + (t.name.length > 15 ? '...' : '')),
                datasets: [{
                    data: tasks.map(t => t.workTime),
                    backgroundColor: tasks.map((_, i) => colors[i % colors.length]),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            padding: 10,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },

    renderLineChart() {
        const streakData = StreakManager.getData();
        const canvas = document.getElementById('line-chart');
        
        if (window.lineChart) window.lineChart.destroy();
        
        // 過去30日のストリークデータを作成
        const data = [];
        const today = new Date();
        let streak = 0;
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = Utils.toDateString(date);
            
            if (streakData.achievedDates.includes(dateStr)) {
                streak++;
            } else {
                streak = 0;
            }
            
            data.push({
                label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                streak
            });
        }
        
        window.lineChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    label: '継続日数',
                    data: data.map(d => d.streak),
                    borderColor: 'rgba(255, 107, 53, 1)',
                    backgroundColor: 'rgba(255, 107, 53, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    },

    // メモ関連
    handleAddMemo() {
        const title = document.getElementById('memo-title').value.trim();
        const content = document.getElementById('memo-content').value.trim();
        const taskId = document.getElementById('memo-task-link').value || null;
        
        if (!content) {
            this.showToast('メモの内容を入力してください', 'error');
            return;
        }
        
        MemoManager.addMemo({ title, content, taskId });
        document.getElementById('memo-form').reset();
        
        this.showToast('メモを保存しました', 'success');
        this.renderMemoList();
    },

    renderMemoList(searchQuery = '') {
        let memos = MemoManager.getMemos();
        
        if (searchQuery) {
            memos = MemoManager.searchMemos(searchQuery);
        }
        
        const container = document.getElementById('memo-list');
        
        if (memos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">note</span>
                    <p>メモがありません</p>
                </div>
            `;
        } else {
            const tasks = TaskManager.getTasks();
            
            container.innerHTML = memos.map(memo => {
                const task = memo.taskId ? tasks.find(t => t.id === memo.taskId) : null;
                return `
                    <div class="memo-item" data-id="${memo.id}">
                        <div class="memo-item-header">
                            <h3>${this.escapeHtml(memo.title || '無題')}</h3>
                            <span class="memo-item-date">${Utils.formatDate(memo.createdAt)}</span>
                        </div>
                        <p>${this.escapeHtml(memo.content).replace(/\n/g, '<br>')}</p>
                        <div class="memo-item-footer">
                            ${task ? `<span class="memo-task-link">📎 ${this.escapeHtml(task.name)}</span>` : '<span></span>'}
                            <div class="memo-actions">
                                <button class="task-action-btn delete" onclick="UI.deleteMemo('${memo.id}')" title="削除">
                                    <span class="material-icons">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    deleteMemo(id) {
        if (confirm('このメモを削除しますか？')) {
            MemoManager.deleteMemo(id);
            this.showToast('メモを削除しました', 'success');
            this.renderMemoList();
        }
    },

    updateMemoTaskSelect() {
        const tasks = TaskManager.getTasks();
        const select = document.getElementById('memo-task-link');
        
        select.innerHTML = '<option value="">紐づけなし</option>' +
            tasks.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
    },

    // 振り返り
    handleSaveReflection() {
        const good = document.getElementById('reflection-good').value.trim();
        const goal = document.getElementById('reflection-goal').value.trim();
        
        ReflectionManager.saveToday(good, goal);
        this.showToast('振り返りを保存しました', 'success');
    },

    loadTodayReflection() {
        const reflection = ReflectionManager.getToday();
        if (reflection) {
            document.getElementById('reflection-good').value = reflection.good || '';
            document.getElementById('reflection-goal').value = reflection.goal || '';
        }
    },

    // モーダル
    openModal(id) {
        document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    // トースト
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    // XSS対策
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    Store.init();
    UI.init();
});

// UIをグローバルに公開（onclick用）
window.UI = UI;
