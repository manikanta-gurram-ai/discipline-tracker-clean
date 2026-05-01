const USERS_KEY = "users";
const SESSION_KEY = "currentUser";
const THEME_KEY = "disciplineTrackerTheme";

const CHART_FALLBACK_DATA = [20, 40, 60, 80, 50, 90, 100];

const elements = {
  body: document.body,
  authScreen: document.getElementById("authScreen"),
  dashboardScreen: document.getElementById("dashboardScreen"),
  authTitle: document.getElementById("authTitle"),
  authForm: document.getElementById("authForm"),
  nameField: document.getElementById("nameField"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  authStatus: document.getElementById("authStatus"),
  loginTab: document.getElementById("loginTab"),
  signupTab: document.getElementById("signupTab"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleIcon: document.getElementById("themeToggleIcon"),
  dashboardThemeToggle: document.getElementById("dashboardThemeToggle"),
  dashboardThemeToggleIcon: document.getElementById("dashboardThemeToggleIcon"),
  logoutBtn: document.getElementById("logoutBtn"),
  welcomeText: document.getElementById("welcomeText"),
  todayLabel: document.getElementById("todayLabel"),
  dateChip: document.getElementById("dateChip"),
  completedCount: document.getElementById("completedCount"),
  miniProgressFill: document.getElementById("miniProgressFill"),
  progressBubble: document.getElementById("progressBubble"),
  currentStreak: document.getElementById("currentStreak"),
  bestStreak: document.getElementById("bestStreak"),
  weeklyStatus: document.getElementById("weeklyStatus"),
  weeklyInsight: document.getElementById("weeklyInsight"),
  taskList: document.getElementById("taskList"),
  emptyTasksState: document.getElementById("emptyTasksState"),
  habitForm: document.getElementById("habitForm"),
  newTaskBtn: document.getElementById("newTaskBtn"),
  taskName: document.getElementById("taskName"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  formStatus: document.getElementById("formStatus"),
  activityChart: document.getElementById("activityChart"),
};

let authMode = "login";
let activityChart = null;

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDay(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(date);
}

function getStoredUsers() {
  const savedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  return Array.isArray(savedUsers) ? savedUsers : [];
}

function saveStoredUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function createDefaultUserData(name, email, password) {
  return {
    name,
    email,
    password,
    timetable: [],
    tasks: {},
    streak: 0,
    bestStreak: 0,
  };
}

function cloneTask(task) {
  return {
    name: task.name || "Untitled Task",
    start: task.start || "00:00",
    end: task.end || "00:00",
    completed: Boolean(task.completed),
  };
}

function cloneTimetableTask(task) {
  return {
    name: task.name || "Untitled Task",
    start: task.start || "00:00",
    end: task.end || "00:00",
  };
}

function normalizeLegacyTasks(rawData) {
  const todayKey = getTodayKey();
  const normalizedByDate = {};

  if (rawData && rawData.tasks && !Array.isArray(rawData.tasks)) {
    Object.entries(rawData.tasks).forEach(([dateKey, tasks]) => {
      normalizedByDate[dateKey] = Array.isArray(tasks) ? tasks.map(cloneTask) : [];
    });
    return normalizedByDate;
  }

  const legacyTasks = Array.isArray(rawData?.tasks) ? rawData.tasks : [];
  const completionHistory = rawData?.completionHistory || {};
  normalizedByDate[todayKey] = legacyTasks.map((task) => ({
    name: task.name || "Untitled Task",
    start: task.start || "00:00",
    end: task.end || "00:00",
    completed: Boolean(completionHistory[todayKey]?.[task.id] ?? task.completed),
  }));

  return normalizedByDate;
}

function normalizeTimetable(rawData, tasksByDate) {
  const rawTimetable = Array.isArray(rawData?.timetable) ? rawData.timetable : [];
  if (rawTimetable.length > 0) {
    return rawTimetable.map(cloneTimetableTask);
  }

  const sortedDates = Object.keys(tasksByDate).sort().reverse();
  const sourceDate = sortedDates.find((dateKey) => Array.isArray(tasksByDate[dateKey]) && tasksByDate[dateKey].length > 0);

  if (!sourceDate) {
    return [];
  }

  return tasksByDate[sourceDate].map(cloneTimetableTask);
}

function removeLegacyDemoTasks(tasksByDate) {
  Object.keys(tasksByDate).forEach((dateKey) => {
    const tasks = Array.isArray(tasksByDate[dateKey]) ? tasksByDate[dateKey] : [];
    const matchesDemoSet =
      tasks.length === 3 &&
      tasks.some((task) => task?.name === "Morning Workout" && task?.start === "06:30" && task?.end === "07:15") &&
      tasks.some((task) => /^Deep Work(?: Sprint)?$/.test(task?.name || "") && task?.start === "09:00" && task?.end === "11:00") &&
      tasks.some((task) => task?.name === "Reading Session" && task?.start === "21:00" && task?.end === "21:30");

    if (matchesDemoSet) {
      tasksByDate[dateKey] = [];
    }
  });

  return tasksByDate;
}

function normalizeUserData(userRecord) {
  const baseData = userRecord || {};
  const normalizedTasks = removeLegacyDemoTasks(normalizeLegacyTasks(baseData));
  const normalized = {
    name: baseData.name || "User",
    email: baseData.email || "",
    password: baseData.password || "",
    timetable: normalizeTimetable(baseData, normalizedTasks),
    tasks: normalizedTasks,
    streak: Number(baseData.streak) || 0,
    bestStreak: Number(baseData.bestStreak) || 0,
  };

  return normalized;
}

function getCurrentUserData() {
  const currentUserEmail = localStorage.getItem(SESSION_KEY);
  if (!currentUserEmail) {
    return null;
  }

  const users = getStoredUsers();
  const userIndex = users.findIndex((user) => user.email === currentUserEmail);
  const userRecord = userIndex >= 0 ? users[userIndex] : null;
  if (!userRecord) {
    return null;
  }

  const normalized = normalizeUserData(userRecord);
  users[userIndex] = normalized;
  saveStoredUsers(users);
  return normalized;
}

function saveCurrentUserData(data) {
  const currentUserEmail = localStorage.getItem(SESSION_KEY);
  const users = getStoredUsers();
  const userIndex = users.findIndex((user) => user.email === currentUserEmail);
  if (userIndex < 0) {
    return;
  }

  users[userIndex] = normalizeUserData(data);
  saveStoredUsers(users);
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "var(--text-soft)";
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === "login";

  elements.authTitle.textContent = isLogin ? "Login" : "Signup";
  elements.authSubmitBtn.textContent = isLogin ? "Login to Dashboard" : "Create Account";
  elements.loginTab.classList.toggle("active", isLogin);
  elements.signupTab.classList.toggle("active", !isLogin);
  elements.nameField.classList.toggle("hidden", isLogin);
  elements.authName.required = !isLogin;
  setStatus(elements.authStatus, "");
}

function applyTheme(theme) {
  const isLight = theme === "light";
  elements.body.classList.toggle("light-mode", isLight);
  const icon = isLight ? "\u2600\uFE0F" : "\uD83C\uDF19";
  elements.themeToggleIcon.textContent = icon;
  elements.dashboardThemeToggleIcon.textContent = icon;
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const nextTheme = elements.body.classList.contains("light-mode") ? "dark" : "light";
  applyTheme(nextTheme);
  if (localStorage.getItem(SESSION_KEY)) {
    renderDashboard();
  }
}

function showDashboard() {
  elements.authScreen.classList.add("hidden");
  elements.dashboardScreen.classList.remove("hidden");
}

function showAuth() {
  elements.dashboardScreen.classList.add("hidden");
  elements.authScreen.classList.remove("hidden");
}

function createDailyTasksFromTimetable(data) {
  return sortTasks((data.timetable || []).map((task) => ({
    ...cloneTimetableTask(task),
    completed: false,
  })));
}

function ensureTimetable(data) {
  if (!Array.isArray(data.timetable)) {
    data.timetable = [];
  }

  data.timetable = sortTasks(data.timetable.map(cloneTimetableTask));
  return data.timetable;
}

function ensureTasksForDate(data, dateKey = getTodayKey(), createIfMissing = false) {
  ensureTimetable(data);

  if (!data.tasks || typeof data.tasks !== "object" || Array.isArray(data.tasks)) {
    data.tasks = {};
  }

  if (!Array.isArray(data.tasks[dateKey])) {
    if (!createIfMissing) {
      return [];
    }

    if (data.timetable.length === 0) {
      return [];
    }

    data.tasks[dateKey] = createDailyTasksFromTimetable(data);
  }

  data.tasks[dateKey] = data.tasks[dateKey].map(cloneTask);
  return data.tasks[dateKey];
}

function getTasksForDate(data, dateKey = getTodayKey(), createIfMissing = false) {
  const tasks = ensureTasksForDate(data, dateKey, createIfMissing);
  return Array.isArray(tasks) ? tasks : [];
}

function sortTasks(tasks) {
  return [...tasks].sort((first, second) => first.start.localeCompare(second.start));
}

function getTodayTasks(data) {
  return getTasksForDate(data, getTodayKey())
    .map((task, taskIndex) => ({
      ...task,
      taskIndex,
    }))
    .sort((first, second) => first.start.localeCompare(second.start));
}

function getCompletionStats(tasks) {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

function calculateCompletionPercentForDate(data, dateKey) {
  const tasks = getTasksForDate(data, dateKey);
  if (tasks.length === 0) {
    return 0;
  }

  return getCompletionStats(tasks).percent;
}

function getLastSevenDaysData(data) {
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dateKey = getTodayKey(date);
    days.push({
      label: formatShortDay(date),
      percent: calculateCompletionPercentForDate(data, dateKey),
      hasTasks: getTasksForDate(data, dateKey).length > 0,
    });
  }

  const hasAnyRealData = days.some((day) => day.hasTasks);

  return {
    labels: days.map((day) => day.label),
    values: hasAnyRealData ? days.map((day) => day.percent) : [...CHART_FALLBACK_DATA],
    hasAnyRealData,
  };
}

function calculateStreaks(data) {
  const dateKeys = Object.keys(data.tasks).sort();
  let best = 0;
  let currentRun = 0;

  dateKeys.forEach((dateKey, index) => {
    const percent = calculateCompletionPercentForDate(data, dateKey);
    const completedDay = getTasksForDate(data, dateKey).length > 0 && percent === 100;

    if (!completedDay) {
      currentRun = 0;
      return;
    }

    if (index === 0) {
      currentRun = 1;
    } else {
      const previousDate = new Date(`${dateKeys[index - 1]}T00:00:00`);
      const currentDate = new Date(`${dateKey}T00:00:00`);
      const diffDays = Math.round((currentDate - previousDate) / 86400000);
      currentRun = diffDays === 1 ? currentRun + 1 : 1;
    }

    best = Math.max(best, currentRun);
  });

  const today = new Date(`${getTodayKey()}T00:00:00`);
  const completedDates = new Set(
    dateKeys.filter((dateKey) => {
      const tasks = getTasksForDate(data, dateKey);
      return tasks.length > 0 && calculateCompletionPercentForDate(data, dateKey) === 100;
    })
  );

  let current = 0;
  while (completedDates.has(getTodayKey(today))) {
    current += 1;
    today.setDate(today.getDate() - 1);
  }

  return { current, best };
}

function renderTasks(data) {
  const todayTasks = getTodayTasks(data);
  elements.taskList.innerHTML = "";
  elements.emptyTasksState.classList.toggle("hidden", todayTasks.length > 0);

  todayTasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item clickable ${task.completed ? "completed" : ""}`;
    item.dataset.taskIndex = String(task.taskIndex);
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-pressed", String(task.completed));
    item.innerHTML = `
      <button
        class="task-toggle"
        type="button"
        aria-label="Toggle ${task.name}"
        data-task-index="${task.taskIndex}"
        style="color:${task.completed ? "var(--success)" : "var(--orange)"};"
      ></button>
      <div class="task-copy">
        <h3 style="${task.completed ? "text-decoration: line-through; opacity: 0.7;" : ""}">${task.name}</h3>
        <div class="timeline-meta">
          <span class="timeline-dot" style="color:${task.completed ? "var(--success)" : "var(--orange)"}; background:${task.completed ? "var(--success)" : "var(--orange)"};"></span>
          <p>${task.completed ? "Completed for today" : "Scheduled for today"}</p>
        </div>
      </div>
      <div class="task-time">${task.start} - ${task.end}</div>
    `;

    elements.taskList.appendChild(item);
  });

  bindTaskEvents();
}

function renderOverview(data) {
  const todayTasks = getTodayTasks(data);
  const { completed, total, percent } = getCompletionStats(todayTasks);
  const weeklyData = getLastSevenDaysData(data);
  const weeklyAverage = Math.round(
    weeklyData.values.reduce((sum, value) => sum + value, 0) / weeklyData.values.length
  );
  const streaks = calculateStreaks(data);

  elements.todayLabel.textContent = formatFullDate();
  elements.dateChip.textContent = formatFullDate();
  elements.welcomeText.textContent = `Welcome, ${data.name} 👋`;
  elements.completedCount.textContent = `${completed} / ${total} tasks`;
  elements.miniProgressFill.style.width = `${percent}%`;
  elements.progressBubble.textContent = `${percent}%`;
  elements.currentStreak.textContent = data.streak;
  elements.bestStreak.textContent = data.bestStreak;
  elements.weeklyStatus.textContent = `${weeklyAverage}% completed`;

  if (!weeklyData.hasAnyRealData) {
    elements.weeklyInsight.textContent = "Fallback activity is showing until your real 7-day history builds up.";
  } else if (weeklyAverage >= 80) {
    elements.weeklyInsight.textContent = "Elite consistency. Your week is flowing with very little friction.";
  } else if (weeklyAverage >= 50) {
    elements.weeklyInsight.textContent = "Solid momentum. A few complete days will turn this into a strong streak.";
  } else {
    elements.weeklyInsight.textContent = "This week is still warm-up mode. Finish today strong to reset the pace.";
  }
}

function createChartGradient() {
  const context = elements.activityChart.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, "rgba(255, 125, 200, 0.95)");
  gradient.addColorStop(0.45, "rgba(255, 176, 120, 0.92)");
  gradient.addColorStop(1, "rgba(115, 203, 255, 0.85)");
  return gradient;
}

function renderChart(data) {
  if (typeof Chart === "undefined") {
    setStatus(elements.formStatus, "Chart.js failed to load, so the activity chart is unavailable.", true);
    return;
  }

  const weeklyData = getLastSevenDaysData(data);
  const axisColor = elements.body.classList.contains("light-mode")
    ? "rgba(36, 18, 38, 0.68)"
    : "rgba(255, 247, 251, 0.72)";
  const gridColor = elements.body.classList.contains("light-mode")
    ? "rgba(36, 18, 38, 0.1)"
    : "rgba(255, 255, 255, 0.08)";
  const tooltipBg = elements.body.classList.contains("light-mode")
    ? "rgba(255, 255, 255, 0.95)"
    : "rgba(37, 16, 48, 0.92)";
  const gradient = createChartGradient();

  const chartData = {
    labels: weeklyData.labels,
    datasets: [
      {
        data: weeklyData.values,
        borderRadius: 18,
        borderSkipped: false,
        backgroundColor: gradient,
        hoverBackgroundColor: gradient,
        maxBarThickness: 34,
      },
    ],
  };

  if (activityChart) {
    activityChart.data = chartData;
    activityChart.options.scales.x.ticks.color = axisColor;
    activityChart.options.scales.y.ticks.color = axisColor;
    activityChart.options.scales.y.grid.color = gridColor;
    activityChart.options.plugins.tooltip.backgroundColor = tooltipBg;
    activityChart.options.plugins.tooltip.titleColor = axisColor;
    activityChart.options.plugins.tooltip.bodyColor = axisColor;
    activityChart.update();
    return;
  }

  activityChart = new Chart(elements.activityChart, {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: axisColor,
          bodyColor: axisColor,
          borderColor: gridColor,
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label(context) {
              return `Completion: ${context.raw}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: axisColor,
            font: {
              family: "Manrope",
              weight: 700,
            },
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: axisColor,
            callback(value) {
              return `${value}%`;
            },
          },
          grid: {
            color: gridColor,
            drawBorder: false,
          },
        },
      },
    },
  });
}

function renderDashboard() {
  const data = getCurrentUserData();
  if (!data) {
    setStatus(elements.formStatus, "Please login.");
    showAuth();
    return;
  }

  ensureTasksForDate(data, getTodayKey(), false);
  const streaks = calculateStreaks(data);
  data.streak = streaks.current;
  data.bestStreak = streaks.best;
  saveCurrentUserData(data);
  renderTasks(data);
  renderOverview(data);
  renderChart(data);
}

function validateTimeRange(start, end) {
  return Boolean(start) && Boolean(end) && start < end;
}

function loginUser(event) {
  event.preventDefault();

  const name = elements.authName.value.trim();
  const email = elements.authEmail.value.trim().toLowerCase();
  const password = elements.authPassword.value.trim();

  if (!email || !password) {
    setStatus(elements.authStatus, "Please enter both email and password.", true);
    return;
  }

  const users = getStoredUsers();

  if (authMode === "signup") {
    if (!name) {
      setStatus(elements.authStatus, "Please enter your name.", true);
      return;
    }

    if (users.some((user) => user.email === email)) {
      setStatus(elements.authStatus, "An account with this email already exists.", true);
      return;
    }

    users.push(createDefaultUserData(name, email, password));
    saveStoredUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    elements.authForm.reset();
    showDashboard();
    renderDashboard();
    setStatus(elements.authStatus, "");
    return;
  }

  const matchedUser = users.find((user) => user.email === email && user.password === password);
  if (!matchedUser) {
    setStatus(elements.authStatus, "Invalid email or password.", true);
    return;
  }

  localStorage.setItem(SESSION_KEY, email);
  elements.authForm.reset();
  showDashboard();
  renderDashboard();
  setStatus(elements.authStatus, "");
}

function toggleTask(taskIndex) {
  const data = getCurrentUserData();
  if (!data) {
    setStatus(elements.formStatus, "Please login.", true);
    return;
  }

  const todayKey = getTodayKey();
  const tasks = getTasksForDate(data, todayKey, true);
  const index = Number(taskIndex);

  if (!Number.isInteger(index) || index < 0 || index >= tasks.length) {
    return;
  }

  tasks[index].completed = !tasks[index].completed;
  saveCurrentUserData(data);
  renderDashboard();
}

function addHabit(event) {
  event.preventDefault();

  const name = elements.taskName.value.trim();
  const start = elements.startTime.value;
  const end = elements.endTime.value;

  if (!name) {
    setStatus(elements.formStatus, "Task name should not be empty.", true);
    return;
  }

  if (!validateTimeRange(start, end)) {
    setStatus(elements.formStatus, "Please enter a valid start and end time.", true);
    return;
  }

  const data = getCurrentUserData();
  if (!data) {
    setStatus(elements.formStatus, "Please log in to add tasks.", true);
    return;
  }

  const todayKey = getTodayKey();
  const newTask = { name, start, end };

  ensureTimetable(data);
  data.timetable.push(newTask);
  data.timetable = sortTasks(data.timetable);

  // ✅ FIX HERE
  const todayTasks = getTasksForDate(data, todayKey, false);

  todayTasks.push({
    ...newTask,
    completed: false,
  });

  data.tasks[todayKey] = sortTasks(todayTasks);
  saveCurrentUserData(data);

  elements.habitForm.reset();
  setStatus(elements.formStatus, "Task added to your timetable.");
  renderDashboard();
}

function pulseElement(element) {
  if (!element) {
    return;
  }

  element.classList.remove("pop", "flash");
  void element.offsetWidth;

  if (element.classList.contains("task-item")) {
    element.classList.add("pop");
    return;
  }

  element.classList.add("flash");
}

function focusNewTaskForm() {
  elements.habitForm.reset();
  setStatus(elements.formStatus, "");
  pulseElement(elements.habitForm);
  elements.taskName.focus();
}

function bindTaskEvents() {
  const taskItems = elements.taskList.querySelectorAll(".task-item");

  taskItems.forEach((item) => {
    const { taskIndex } = item.dataset;
    const toggle = item.querySelector(".task-toggle");

    item.onclick = () => {
      toggleTask(taskIndex);
      const updatedItem = elements.taskList.querySelector(`.task-item[data-task-index="${taskIndex}"]`);
      pulseElement(updatedItem);
    };

    item.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        item.click();
      }
    };

    if (toggle) {
      toggle.onclick = (event) => {
        event.stopPropagation();
        item.click();
      };
    }
  });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  showAuth();
  setAuthMode("login");
  setStatus(elements.formStatus, "");
}

function bindEvents() {
  elements.loginTab.addEventListener("click", () => setAuthMode("login"));
  elements.signupTab.addEventListener("click", () => setAuthMode("signup"));
  elements.authForm.addEventListener("submit", loginUser);
  elements.habitForm.addEventListener("submit", addHabit);
  elements.newTaskBtn.addEventListener("click", focusNewTaskForm);
  elements.logoutBtn.addEventListener("click", logout);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.dashboardThemeToggle.addEventListener("click", toggleTheme);
}

function seedSessionUserIfMissing() {
  const currentUserEmail = localStorage.getItem(SESSION_KEY);
  if (!currentUserEmail) {
    return;
  }

  const users = getStoredUsers();
  const userExists = users.some((user) => user.email === currentUserEmail);
  if (!userExists) {
    localStorage.removeItem(SESSION_KEY);
  }
}

function init() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);
  bindEvents();
  setAuthMode("login");
  seedSessionUserIfMissing();

  if (localStorage.getItem(SESSION_KEY)) {
    showDashboard();
    renderDashboard();
  } else {
    showAuth();
  }
}

init();
