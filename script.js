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

// ======= BACKEND API URL ========
const API_URL = "http://localhost:3000";

// ======= UI ELEMENTS ========
const dateListEl = document.getElementById("date-list");
const slotGridEl = document.getElementById("slot-grid");
const confirmBtn = document.getElementById("confirm-btn");
const summaryEl = document.getElementById("summary");

// POPUP
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
    initSlotsForDay();
    renderSummary();
  });
});

document.querySelector('.lang-btn[data-lang="ru"]').classList.add("active");

// ======= LANG DATA ========
const LANG = {
  ru: {
    popupTitle: "Ваше бронирование",
    namePlaceholder: "Ваше имя",
    phonePlaceholder: "Ваш телефон",
    submit: "Отправить",
    close: "Отмена",
    alertSelect: "Вы можете выбрать максимум 2 слота.",
    confirmError: "Выберите дату и хотя бы один слот.",
    thanks: "Спасибо! Бронирование сохранено.",
    cancelQuestion: "Отменить бронирование?",
    cancelDone: "Бронирование отменено.",
    afterBooking: "Если хотите отменить — нажмите на выделенный слот.",
    formatDate: (date) =>
      date.toLocaleDateString("ru-RU", { weekday: "long", month: "long", day: "numeric" }),
  },
  hy: {
    popupTitle: "Ձեր ամրագրումը",
    namePlaceholder: "Ձեր անունը",
    phonePlaceholder: "Ձեր հեռախոսահամարը",
    submit: "Ուղարկել",
    close: "Փակել",
    alertSelect: "Կարելի է ընտրել առավելագույնը 2 սլոթ։",
    confirmError: "Ընտրեք օրը և գոնե 1 սլոթ։",
    thanks: "Շնորհակալություն։ Ամրագրումը պահպանված է։",
    cancelQuestion: "Չեղարկե՞լ ամրագրված սլոթը։",
    cancelDone: "Ամրագրվածը չեղարկվեց։",
    afterBooking: "Եթե ցանկանում եք չեղարկել՝ սեղմեք սլոթի վրա։",
    formatDate: (date) =>
      date.toLocaleDateString("hy-AM", { weekday: "long", month: "long", day: "numeric" }),
  },
};

// ======= DATE FUNCTIONS ========
function getAvailableDates() {
  let arr = [];

  const now = new Date();
  const today = new Date();
  today.setHours(0,0,0,0);

  const startIndex = now.getHours() >= CLOSE_HOUR ? 1 : 0;

  for (let i = startIndex; i < MAX_DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    arr.push(d);
  }

  return arr;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function renderDates() {
  const dates = getAvailableDates();
  dateListEl.innerHTML = "";

  dates.forEach((d, idx) => {
    const div = document.createElement("div");
    div.className = "date-pill";

    if (!selectedDate && idx === 0) selectedDate = d;
    if (selectedDate && isSameDay(d, selectedDate)) div.classList.add("selected");

    const day = d.getDate();
    const month = d.toLocaleString(currentLang === "ru" ? "ru-RU" : "hy-AM", { month: "short" });

    div.textContent = `${day} ${month}`;

    div.addEventListener("click", () => {
      selectedDate = d;
      selectedSlots = [];
      renderDates();
      initSlotsForDay();
      renderSummary();
      confirmBtn.textContent = "Далее / Շարունակել";
      confirmBtn.disabled = false;
    });

    dateListEl.appendChild(div);
  });
}

// ======= SLOT FUNCTIONS ========
function generateSlotsForDay() {
  let list = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (let min = 0; min < 60; min += SLOT_MINUTES) {
      const start = `${String(hour).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
      const endDate = new Date();
      endDate.setHours(hour, min + SLOT_MINUTES);
      const end = `${String(endDate.getHours()).padStart(2,"0")}:${String(endDate.getMinutes()).padStart(2,"0")}`;
      list.push({ start, end, status: "free" });
    }
  }
  return list;
}

function applyBookedSlots(fs, booked = []) {
  return fs.map(s => booked.includes(s.start) ? { ...s, status: "booked" } : s);
}

function isPastSlot(date, slotStart) {
  const now = new Date();
  const slotDate = new Date(date);
  const [h,m] = slotStart.split(":");
  slotDate.setHours(h, m, 0, 0);
  return slotDate < now;
}

function isNextDayBlocked(date) {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate()+1);
  tomorrow.setHours(0,0,0,0);

  const selected = new Date(date);
  selected.setHours(0,0,0,0);

  return selected.getTime() === tomorrow.getTime() && now.getHours() >= 22;
}

// ============ TOGGLE ============
function toggleSlotSelection(slot) {
  const exists = selectedSlots.find(s => s.start === slot.start);

  if (exists) {
    selectedSlots = selectedSlots.filter(s => s.start !== slot.start);
    return { ...slot, status: "free" };
  }

  if (selectedSlots.length >= MAX_SELECTION) {
    alert(LANG[currentLang].alertSelect);
    return slot;
  }

  selectedSlots.push(slot);
  return { ...slot, status: "selected" };
}

// ============ RENDER =============
function renderSlots() {
  slotGridEl.innerHTML = "";

  slots.forEach(slot => {
    const btn = document.createElement("button");
    btn.className = `slot ${slot.status}`;
    btn.textContent = `${slot.start}-${slot.end}`;

    btn.addEventListener("click", async () => {

      // BOOKED SLOT CLICK → CANCEL
      if (slot.status === "booked") {
        if (confirm(LANG[currentLang].cancelQuestion)) {
          try {
            await fetch(`${API_URL}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: selectedDate.toISOString().split("T")[0],
                start: slot.start,
                user_id: "web-user"
              })
            });
            slots = slots.map(s => s.start === slot.start ? { ...s, status:"free" } : s);
            renderSlots();
            alert(LANG[currentLang].cancelDone);
          } catch(e) {
            console.error(e);
          }
        }
        return;
      }

      // NEXT-DAY BLOCK
      if (isNextDayBlocked(selectedDate)) {
        alert(currentLang === "ru"
          ? "Нельзя бронировать на завтра после 22:00."
          : "22:00-ից հետո հնարավոր չէ ամրագրել հաջորդ օրվա համար։"
        );
        return;
      }

      const updated = toggleSlotSelection(slot);
      slots = slots.map(s => s.start === slot.start ? updated : s);
      renderSlots();
      renderSummary();
    });

    slotGridEl.appendChild(btn);
  });
}

// ============ INIT DAY SLOTS ============
async function initSlotsForDay() {
  const dateString = selectedDate.toISOString().split("T")[0];
  let base = generateSlotsForDay();

  const today = new Date();
  const sel = new Date(selectedDate);

  if (isSameDay(today, sel)) {
    base = base.map(s => isPastSlot(selectedDate, s.start) ? { ...s, status:"booked" } : s);
  }

  try {
    const res = await fetch(`${API_URL}/slots/${dateString}`);
    const data = await res.json();
    slots = applyBookedSlots(base, data.booked || []);
  } catch {
    slots = base;
  }

  renderSlots();
}

// ============ SUMMARY ============
function renderSummary() {
  if (!selectedSlots.length) summaryEl.textContent = "";
  else summaryEl.textContent = selectedSlots.map(s => `${s.start}-${s.end}`).join(", ");
}

// ============ CONFIRM → POPUP ============
confirmBtn.addEventListener("click", () => {
  if (!selectedSlots.length) {
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

// ============ POPUP SUBMIT ============
popupSubmit.addEventListener("click", async () => {
  if (!nameInput.value || !phoneInput.value) {
    alert("Fill all fields");
    return;
  }

  const reservationData = {
    date: selectedDate.toISOString().split("T")[0],
    slots: selectedSlots,
    name: nameInput.value,
    phone: phoneInput.value,
    user_id: "web-user"
  };

  try {
    await fetch(`${API_URL}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reservationData),
    });
  } catch (e) {
    console.error(e);
  }

  popup.classList.add("hidden");
  confirmBtn.textContent = LANG[currentLang].thanks;
  confirmBtn.disabled = true;

  selectedSlots.forEach(s => {
    slots = slots.map(sl => sl.start === s.start ? { ...sl, status:"booked" } : sl);
  });

  renderSlots();

  summaryEl.textContent = LANG[currentLang].afterBooking;
  selectedSlots = [];
});

popupClose.addEventListener("click", () => popup.classList.add("hidden"));

// INIT
(function() {
  const dates = getAvailableDates();
  selectedDate = dates[0];
  renderDates();
  initSlotsForDay();
})();

