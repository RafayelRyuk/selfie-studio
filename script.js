// ========== SETTINGS ==========
const OPEN_HOUR = 10;
const CLOSE_HOUR = 22;
const SLOT_MINUTES = 30;
const MAX_SELECTION = 2;    // max 2 slots PER DAY (total)
const MAX_DAYS_AHEAD = 14;

let currentLang = "ru";
let selectedDate = null;
let selectedSlots = [];   // in-progress selection
let slots = [];           // all slots of selected day

// Track MY own bookings during current session (per date)
const myBookedByDate = {}; // { "2025-03-01": ["10:00","10:30"] }

// Telegram user ID (for backend, future)
let USER_ID = "web-user";
if (window.Telegram && Telegram.WebApp) {
  Telegram.WebApp.ready();
  USER_ID = Telegram.WebApp.initDataUnsafe?.user?.id || "web-user";
}

// ======= BACKEND API URL ========
const API_URL = "http://localhost:3000";

// ======= UI ELEMENTS ========
const dateListEl   = document.getElementById("date-list");
const slotGridEl   = document.getElementById("slot-grid");
const confirmBtn   = document.getElementById("confirm-btn");
const summaryEl    = document.getElementById("summary");

// POPUP ELEMENTS
const popup        = document.getElementById("popup");
const popupTitle   = document.getElementById("popup-title");
const popupDate    = document.getElementById("popup-date");
const nameInput    = document.getElementById("user-name");
const phoneInput   = document.getElementById("user-phone");
const popupSubmit  = document.getElementById("submit-btn");
const popupClose   = document.getElementById("close-popup");

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
    alertSelect: "Вы можете выбрать максимум 2 слота на этот день.",
    confirmError: "Выберите дату и хотя бы один слот.",
    thanksOne: "Спасибо! Ждём вас в выбранное время.",
    thanksTwo: "Спасибо! Ждём вас совсем скоро 🙌",
    cancelQuestion: "Отменить своё бронирование?",
    cancelDone: "Ваше бронирование отменено.",
    tooLateCancel: "Нельзя отменить бронь по прошедшему времени.",
    formatDate: (date) =>
      date.toLocaleDateString("ru-RU", { weekday: "long", month: "long", day: "numeric" }),
  },
  hy: {
    popupTitle: "Ձեր ամրագրումը",
    namePlaceholder: "Ձեր անունը",
    phonePlaceholder: "Ձեր հեռախոսահամարը",
    submit: "Ուղարկել",
    close: "Փակել",
    alertSelect: "Օրվա համար կարելի է ընտրել առավելագույնը 2 սլոթ։",
    confirmError: "Ընտրեք օրը և գոնե 1 սլոթ։",
    thanksOne: "Շնորհակալություն, սպասում ենք ձեզ ամրագրված ժամին։",
    thanksTwo: "Շնորհակալություն, շուտով կտեսնվենք 🙌",
    cancelQuestion: "Չեղարկե՞լ ձեր ամրագրումը։",
    cancelDone: "Ձեր ամրագրումը չեղարկվեց։",
    tooLateCancel: "Անհնար է չեղարկել արդեն անցած ժամի ամրագրումը։",
    formatDate: (date) =>
      date.toLocaleDateString("hy-AM", { weekday: "long", month: "long", day: "numeric" }),
  },
};

// ========= HELPERS ==========
function getDateKey(date) {
  return date.toISOString().split("T")[0];
}

function totalReservedCount() {
  // all taken slots this day (past+others+mine)
  return slots.filter(s => s.status === "booked" || s.status === "mine").length;
}

function myReservedCount() {
  return slots.filter(s => s.status === "mine").length;
}

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

// ========= SUMMARY / STATUS TEXT =========
function updateStatusText() {
  const mineCount = myReservedCount();

  if (selectedSlots.length > 0) {
    // show in-progress selection
    summaryEl.textContent = selectedSlots
      .map(s => `${s.start}-${s.end}`)
      .join(", ");
    return;
  }

  if (mineCount === 0) {
    summaryEl.textContent = "";
  } else if (mineCount === 1) {
    summaryEl.textContent = currentLang === "ru"
      ? LANG.ru.thanksOne
      : LANG.hy.thanksOne;
  } else {
    summaryEl.textContent = currentLang === "ru"
      ? LANG.ru.thanksTwo
      : LANG.hy.thanksTwo;
  }
}

function updateConfirmButtonState() {
  const reserved = totalReservedCount();
  if (reserved >= MAX_SELECTION) {
    confirmBtn.textContent = currentLang === "ru"
      ? "Спасибо ✔"
      : "Շնորհակալություն ✔";
    confirmBtn.disabled = true;
  } else {
    confirmBtn.textContent = "Далее / Շարունակել";
    confirmBtn.disabled = false;
  }
}

// ============ TOGGLE ============
function toggleSlotSelection(slot) {
  // can't select blocked/other or already mine
  if (slot.status === "booked" || slot.status === "mine") return slot;

  const exists = selectedSlots.find(s => s.start === slot.start);

  if (exists) {
    // unselect
    selectedSlots = selectedSlots.filter(s => s.start !== slot.start);
    return { ...slot, status: "free" };
  }

  // total reserved this day (mine+others) + in-progress selection
  const reserved = totalReservedCount();
  if (reserved + selectedSlots.length >= MAX_SELECTION) {
    alert(LANG[currentLang].alertSelect);
    return slot;
  }

  if (selectedSlots.length >= MAX_SELECTION) {
    alert(LANG[currentLang].alertSelect);
    return slot;
  }

  selectedSlots.push({ start: slot.start, end: slot.end });
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
      // 1) other people's or past reservations: DO NOTHING
      if (slot.status === "booked") {
        return;
      }

      // 2) my own slot → cancel (only if time not passed)
      if (slot.status === "mine") {
        if (isPastSlot(selectedDate, slot.start)) {
          alert(LANG[currentLang].tooLateCancel);
          return;
        }

        if (confirm(LANG[currentLang].cancelQuestion)) {
          const dateKey = getDateKey(selectedDate);

          try {
            await fetch(`${API_URL}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: dateKey,
                start: slot.start,
                user_id: USER_ID
              }),
            });

            // remove from local "mine" list for this date
            if (myBookedByDate[dateKey]) {
              myBookedByDate[dateKey] = myBookedByDate[dateKey].filter(s => s !== slot.start);
            }

            slots = slots.map(s =>
              s.start === slot.start ? { ...s, status: "free" } : s
            );

            renderSlots();
            updateConfirmButtonState();
            updateStatusText();
            alert(LANG[currentLang].cancelDone);

          } catch(err) {
            console.error(err);
          }
        }
        return;
      }

      // 3) block next day after 22:00 for new booking
      if (isNextDayBlocked(selectedDate)) {
        alert(currentLang === "ru"
          ? "Нельзя бронировать на завтра после 22:00."
          : "22:00-ից հետո հնարավոր չէ ամրագրել հաջորդ օրվա համար։"
        );
        return;
      }

      // 4) normal free slot select/deselect
      const updated = toggleSlotSelection(slot);
      slots = slots.map(s => s.start === slot.start ? updated : s);
      renderSlots();
      updateStatusText();
    });

    slotGridEl.appendChild(btn);
  });
}

// ============ INIT DAY SLOTS ============
async function initSlotsForDay() {
  const dateKey = getDateKey(selectedDate);
  let base = generateSlotsForDay();

  const today = new Date();
  const sel = new Date(selectedDate);

  // block past hours for TODAY as non-cancelable booked
  if (isSameDay(today, sel)) {
    base = base.map(s =>
      isPastSlot(selectedDate, s.start) ? { ...s, status:"booked" } : s
    );
  }

  // load booked slots from backend
  try {
    const res = await fetch(`${API_URL}/slots/${dateKey}`);
    const data = await res.json();
    const globalBooked = data.booked || [];

    slots = applyBookedSlots(base, globalBooked);
  } catch (e) {
    console.error("Error loading booked slots", e);
    slots = base;
  }

  // mark MY own slots for this date (only current session)
  const myForDay = myBookedByDate[dateKey] || [];
  if (myForDay.length) {
    slots = slots.map(s =>
      myForDay.includes(s.start) && !isPastSlot(selectedDate, s.start)
        ? { ...s, status: "mine" }
        : s
    );
  }

  updateConfirmButtonState();
  selectedSlots = [];
  renderSlots();
  updateStatusText();
}

// ============ SUMMARY ============
function renderSummary() {
  updateStatusText();
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

  const dateKey = getDateKey(selectedDate);

  const reservationData = {
    date: dateKey,
    slots: selectedSlots,
    name: nameInput.value,
    phone: phoneInput.value,
    user_id: USER_ID
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

  // mark them as "mine" locally
  if (!myBookedByDate[dateKey]) myBookedByDate[dateKey] = [];
  selectedSlots.forEach(sel => {
    if (!myBookedByDate[dateKey].includes(sel.start)) {
      myBookedByDate[dateKey].push(sel.start);
    }
    slots = slots.map(s =>
      s.start === sel.start ? { ...s, status:"mine" } : s
    );
  });

  popup.classList.add("hidden");

  // update button state & status text
  updateConfirmButtonState();
  selectedSlots = [];
  renderSlots();
  updateStatusText();
});

popupClose.addEventListener("click", () => popup.classList.add("hidden"));

// INIT
(function() {
  const dates = getAvailableDates();
  selectedDate = dates[0];
  renderDates();
  initSlotsForDay();
})();
