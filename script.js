// ========== SETTINGS ==========
const OPEN_HOUR = 10;
const CLOSE_HOUR = 22;
const SLOT_MINUTES = 30;
const MAX_SELECTION = 2;
const MAX_DAYS_AHEAD = 14;

let currentLang = "ru";
let selectedDate = null;
let selectedSlots = [];
let slots = [];

// ======= OLD UI ELEMENTS ========
const dateListEl = document.getElementById("date-list");
const slotGridEl = document.getElementById("slot-grid");
const confirmBtn = document.getElementById("confirm-btn");
const summaryEl = document.getElementById("summary");

// ======= NEW POPUP ELEMENTS ========
const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popup-title");
const popupDate = document.getElementById("popup-date");
const nameInput = document.getElementById("user-name");
const phoneInput = document.getElementById("user-phone");
const popupSubmit = document.getElementById("submit-btn");
const popupClose = document.getElementById("close-popup");

// ======= LANG BUTTONS ========
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentLang = btn.dataset.lang;
    renderDates();
    renderSlots();
    renderSummary();
  });
});

// default RU
document.querySelector('.lang-btn[data-lang="ru"]').classList.add("active");

// ======= LANG DATA ========
const LANG = {
  ru: {
    popupTitle: "Ваше бронирование",
    namePlaceholder: "Ваше имя",
    phonePlaceholder: "Ваш телефон",
    submit: "Отправить",
    close: "Закрыть",
    alertSelect:
      "Вы можете выбрать максимум 2 слота. Если вам нужно больше — напишите администратору.",
    confirmError: "Пожалуйста, выберите дату и минимум один слот.",
    thanks: "Спасибо! Мы свяжемся с вами.",
    formatDate: (date) =>
      date.toLocaleDateString("ru-RU", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
  },
  hy: {
    popupTitle: "Ձեր ամրագրումը",
    namePlaceholder: "Ձեր անունը",
    phonePlaceholder: "Ձեր հեռախոսահամարը",
    submit: "Ուղարկել",
    close: "Փակել",
    alertSelect:
      "Դուք կարող եք ընտրել առավելագույնը 2 սլոթ։ Αν ձեզ պետք է ավելին՝ գրեք ադմինին։",
    confirmError: "Խնդրում ենք ընտրել օրը և առնվազն մեկ սլոթ։",
    thanks: "Շնորհակալություն։ Մենք կապ կհաստատենք ձեզ հետ։",
    formatDate: (date) =>
      date.toLocaleDateString("hy-AM", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
  },
};

// ======= DATE FUNCTIONS ========
function getAvailableDates() {
  let arr = [];

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If current time is >= closing hour, skip today entirely
  const startIndex = now.getHours() >= CLOSE_HOUR ? 1 : 0;

  for (let i = startIndex; i < MAX_DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    arr.push(d);
  }

  return arr;
}


function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function renderDates() {
  const dates = getAvailableDates();
  dateListEl.innerHTML = "";

  dates.forEach((d, idx) => {
    const div = document.createElement("div");
    div.className = "date-pill";

    if (!selectedDate && idx === 0) selectedDate = d;
    if (isSameDay(d, selectedDate)) div.classList.add("selected");

    const day = d.getDate();
    const month = d.toLocaleString(
      currentLang === "ru" ? "ru-RU" : "hy-AM",
      { month: "short" }
    );

    div.textContent = `${day} ${month}`;

    div.addEventListener("click", () => {
      selectedDate = d;
      selectedSlots = [];
      renderDates();
      initSlotsForDay();
    });

    dateListEl.appendChild(div);
  });
}

// ======= SLOT FUNCTIONS ========
function generateSlotsForDay() {
  let list = [];

  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (let min = 0; min < 60; min += SLOT_MINUTES) {
      const start = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const endDate = new Date();
      endDate.setHours(hour, min + SLOT_MINUTES);
      const end = `${String(endDate.getHours()).padStart(2, "0")}:${String(
        endDate.getMinutes()
      ).padStart(2, "0")}`;

      list.push({ start, end, status: "free" });
    }
  }

  return list;
}

function applyBookedSlots(fs, booked = []) {
  return fs.map((s) =>
    booked.includes(s.start) ? { ...s, status: "booked" } : s
  );
}

// === BLOCK PAST SLOTS FOR TODAY ===
function isPastSlot(date, slotStart) {
  const now = new Date();
  const slotDate = new Date(date);

  const [h, m] = slotStart.split(":");
  slotDate.setHours(h, m, 0, 0);

  return slotDate < now;
}

// === BLOCK NEXT DAY AFTER 22:00 ===
function isNextDayBlocked(selectedDate) {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  return selected.getTime() === tomorrow.getTime() && now.getHours() >= 22;
}

function toggleSlotSelection(slot) {

  // BLOCK TOMORROW AFTER 22:00
if (isNextDayBlocked(selectedDate)) {
  alert(
    currentLang === "ru"
      ? "Нельзя бронировать на завтра после 22:00."
      : "22:00-ից հետո հնարավոր չէ ամրագրել հաջորդ օրվա համար։"
  );
  return slot;
}

  if (slot.status === "booked") return slot;

  const exists = selectedSlots.find((s) => s.start === slot.start);

  if (exists) {
    selectedSlots = selectedSlots.filter((s) => s.start !== slot.start);
    return { ...slot, status: "free" };
  }

  if (selectedSlots.length >= MAX_SELECTION) {
    alert(LANG[currentLang].alertSelect);
    return slot;
  }

  selectedSlots.push(slot);
  return { ...slot, status: "selected" };
}

function renderSlots() {
  slotGridEl.innerHTML = "";

  slots.forEach((slot) => {
    const btn = document.createElement("button");
    btn.className = `slot ${slot.status}`;
    btn.textContent = `${slot.start}-${slot.end}`;

    btn.addEventListener("click", () => {
      const updated = toggleSlotSelection(slot);
      slots = slots.map((s) =>
        s.start === slot.start ? updated : s
      );
      renderSlots();
      renderSummary();
    });

    slotGridEl.appendChild(btn);
  });
}

function initSlotsForDay() {
  let base = generateSlotsForDay();

  // 1) Block next day after 22:00
 

  // 2) Block past times for TODAY
  const today = new Date();
  const selectedDay = new Date(selectedDate);

  if (isSameDay(today, selectedDay)) {
    base = base.map(s => {
      if (isPastSlot(selectedDate, s.start)) {
        return { ...s, status: "booked" };
      }
      return s;
    });
  }

  // 3) Apply real booked slots
  slots = applyBookedSlots(base);

  renderSlots();
}


// ======= SUMMARY ========
function renderSummary() {
  if (!selectedSlots.length) {
    summaryEl.textContent = "";
    return;
  }

  summaryEl.textContent = selectedSlots
    .map((s) => `${s.start} - ${s.end}`)
    .join(", ");
}

// ======= CONFIRM → OPEN POPUP ========
confirmBtn.addEventListener("click", () => {
  if (!selectedDate || !selectedSlots.length) {
    alert(LANG[currentLang].confirmError);
    return;
  }

  popupTitle.textContent = LANG[currentLang].popupTitle;
  popupDate.textContent = LANG[currentLang].formatDate(selectedDate);

  nameInput.placeholder = LANG[currentLang].namePlaceholder;
  phoneInput.placeholder = LANG[currentLang].phonePlaceholder;
  popupSubmit.textContent = LANG[currentLang].submit;
  popupClose.textContent = LANG[currentLang].close;

  popup.classList.remove("hidden");
});

// ======= POPUP ACTIONS ========
popupSubmit.addEventListener("click", () => {
  if (!nameInput.value || !phoneInput.value) {
    alert("Fill all fields");
    return;
  }

  alert(LANG[currentLang].thanks);
  popup.classList.add("hidden");
});

popupClose.addEventListener("click", () => popup.classList.add("hidden"));

// INIT
(function () {
  const dates = getAvailableDates();
  selectedDate = dates[0];
  renderDates();
  initSlotsForDay();
})();
