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
let personalBookedByDate = {}; // Track personal bookings from DB per date

// Telegram user ID (for backend, future)
let USER_ID = "web-user";
const isTelegram = window.Telegram && Telegram.WebApp;
if (isTelegram) {
  Telegram.WebApp.ready();
  USER_ID = Telegram.WebApp.initDataUnsafe?.user?.id || "web-user";
  console.log("📱 Telegram Web App detected, User ID:", USER_ID);
}

// ======= BACKEND API URL ========
// For Telegram Web App to work, you need to expose your localhost backend
// Option 1: Use ngrok (recommended for testing)
//   1. Install ngrok: https://ngrok.com/download
//   2. Run: ngrok http 3000
//   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
//   4. Paste it below as PRODUCTION_API_URL
//
// Option 2: Deploy to a cloud service (Heroku, Railway, Render, etc.)
//
// Option 3: Use your PC's public IP with port forwarding (advanced)

// ⚠️ REPLACE THIS with your ngrok URL or deployed backend URL
// Example: "https://abc123.ngrok.io" or "https://your-app.herokuapp.com"
const API_URL = " https://unsponged-roseann-slackly.ngrok-free.dev";

// Log API URL for debugging (check browser console)
console.log("🔗 API URL:", API_URL, "| Telegram:", isTelegram);

// Helper function to make API calls with ngrok bypass headers
async function apiFetch(url, options = {}) {
  // Build headers - ensure ngrok-skip-browser-warning is always included
  const headers = {
    'ngrok-skip-browser-warning': 'true', // Bypass ngrok warning page - MUST be first
    ...(options.headers || {})
  };
  
  // Add Content-Type if not present and we have a body
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const defaultOptions = {
    ...options,
    headers: headers,
    mode: 'cors', // Ensure CORS is enabled
    credentials: 'omit' // Don't send cookies
  };
  
  console.log("🌐 apiFetch:", url, "Headers:", Object.keys(headers));
  
  try {
    const response = await fetch(url, defaultOptions);
    
    // Check if we got the ngrok warning page (HTML response instead of JSON)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html') && !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.includes('ngrok') || text.includes('Visit Site')) {
        throw new Error('ngrok warning page detected - requests are being blocked');
      }
    }
    
    return response;
  } catch (error) {
    console.error("❌ Fetch error:", error);
    if (isTelegram && error.message.includes('ngrok warning page')) {
      console.error("🔴 CRITICAL: ngrok warning page is blocking requests!");
      console.error("💡 Solution: Run ngrok with: ngrok http 3000 --host-header=rewrite");
    }
    throw error;
  }
}

// Test API connection on load
(async () => {
  try {
    const testResponse = await apiFetch(`${API_URL}/test-db`);
    const testData = await testResponse.json();
    console.log("✅ Backend connection test:", testData);
  } catch (error) {
    console.error("❌ Backend connection failed:", error);
    if (isTelegram) {
      console.error("⚠️ Telegram Web App cannot connect to backend!");
      console.error("💡 Possible issues:");
      console.error("   1. ngrok warning page blocking (free tier)");
      console.error("   2. Backend not running");
      console.error("   3. ngrok tunnel not active");
      console.error("   4. Try: ngrok http 3000 --host-header=rewrite");
    }
  }
})();


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
      // SECURITY: Double-check this is actually my slot before allowing cancel
      if (slot.status === "mine") {
        const dateKey = getDateKey(selectedDate);
        
        // Additional security check: verify this slot is in my personal bookings from DB
        const personalBooked = personalBookedByDate[dateKey] || [];
        const isActuallyMine = personalBooked.includes(slot.start);
        
        if (!isActuallyMine) {
          console.error("🚨 SECURITY: Attempt to cancel slot not in personal bookings!", {
            slot: slot.start,
            date: dateKey,
            personalBooked: personalBooked,
            user_id: USER_ID
          });
          alert("Error: This slot doesn't belong to you.");
          return;
        }
        if (isPastSlot(selectedDate, slot.start)) {
          alert(LANG[currentLang].tooLateCancel);
          return;
        }

        if (confirm(LANG[currentLang].cancelQuestion)) {
          const dateKey = getDateKey(selectedDate);

          try {
            const cancelResponse = await apiFetch(`${API_URL}/cancel`, {
              method: "POST",
              body: JSON.stringify({
                date: dateKey,
                start: slot.start,
                user_id: USER_ID
              }),
            });

            if (!cancelResponse.ok) {
              const errorData = await cancelResponse.json();
              console.error("❌ Cancel failed:", errorData);
              alert(errorData.error || "Failed to cancel reservation");
              return;
            }

            const result = await cancelResponse.json();
            
            if (!result.success) {
              console.error("❌ Cancel failed:", result.error);
              alert(result.error || "Failed to cancel reservation");
              return;
            }

            console.log("✅ Reservation cancelled successfully");

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
            console.error("❌ Error cancelling reservation:", err);
            alert("Error cancelling reservation. Please try again.");
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

  // ✅ HIDE passed hours fully (not “booked”)
  if (isSameDay(today, sel)) {
    base = base.filter(s => !isPastSlot(selectedDate, s.start));
  }

  // ============================================
  // 1) LOAD global booked slots (from backend)
  // ============================================
  let globalBooked = [];
  let personalBooked = [];

  try {
    console.log("📡 Loading slots for date:", dateKey, "User:", USER_ID);
    const res = await apiFetch(`${API_URL}/slots/${dateKey}?user_id=${USER_ID}`);
    
    if (!res.ok) {
      console.error("❌ Failed to load slots:", res.status, res.statusText);
      return;
    }
    
    const data = await res.json();
    console.log("📥 Loaded slots data:", data);

    globalBooked = data.booked || [];    // others' bookings
    const personalBooked = data.personal || []; // my own slots from DB
    
    // Store personal bookings by date for security checks
    personalBookedByDate[dateKey] = personalBooked;
    
    console.log("✅ Loaded:", globalBooked.length, "global bookings,", personalBooked.length, "personal bookings");

  } catch (e) {
    console.error("❌ Error loading booked slots:", e);
    if (isTelegram) {
      console.error("⚠️ Telegram Web App cannot fetch slots from backend!");
    }
  }

  // 2) FIRST apply global bookings
  slots = applyBookedSlots(base, globalBooked);

  // 3) THEN override with MY personal bookings (mine must win)
  slots = slots.map(s =>
    personalBooked.includes(s.start)
      ? { ...s, status: "mine" }
      : s
  );

  // 4) Disable NEXT if user already has 2 reserved slots
  const myCount = slots.filter(s => s.status === "mine").length;
  if (myCount >= 2) {
    confirmBtn.textContent =
      currentLang === "ru" ? "Спасибо ✔" : "Շնորհակալություն ✔";
    confirmBtn.disabled = true;
  } else {
    confirmBtn.textContent = "Далее / Շարունակել";
    confirmBtn.disabled = false;
  }

  // 5) reset temporary selections
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

  console.log("📤 Sending reservation request to:", `${API_URL}/reserve`);
  console.log("📦 Reservation data:", reservationData);
  console.log("🌐 Is Telegram:", isTelegram, "| User ID:", USER_ID);
  
  // Show loading indicator in Telegram
  if (isTelegram && Telegram.WebApp) {
    Telegram.WebApp.showAlert("Sending reservation...");
  }
  
  try {
    console.log("🔄 Calling apiFetch...");
    const response = await apiFetch(`${API_URL}/reserve`, {
      method: "POST",
      body: JSON.stringify(reservationData),
    });
    
    console.log("📥 Response received! Status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Server error response:", errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error("❌ Error details:", errorJson);
        alert(`Failed to save reservation: ${errorJson.error || "Server error"}`);
      } catch {
        alert(`Failed to save reservation: ${response.status} ${response.statusText}`);
      }
      return;
    }
    
    const result = await response.json();
    console.log("✅ Reservation response:", result);
    
    if (!result.success) {
      console.error("❌ Reservation failed:", result.error || "Unknown error");
      alert(`Failed to save reservation: ${result.error || "Unknown error"}`);
      return;
    }
    
    console.log("✅ Reservation saved successfully!");
  } catch (e) {
    console.error("❌ Network error saving reservation:", e);
    console.error("❌ Error details:", {
      message: e.message,
      stack: e.stack,
      name: e.name,
      API_URL: API_URL,
      isTelegram: isTelegram
    });
    
    // Try to get more details about the error
    if (e.message) {
      console.error("❌ Error message:", e.message);
    }
    if (e.cause) {
      console.error("❌ Error cause:", e.cause);
    }
    
    let errorMsg = "Error connecting to server.\n\n";
    errorMsg += `API URL: ${API_URL}\n`;
    errorMsg += `Error: ${e.message || "Unknown error"}\n\n`;
    
    if (isTelegram) {
      errorMsg += "Possible issues:\n";
      errorMsg += "• ngrok warning page blocking\n";
      errorMsg += "• Backend not running\n";
      errorMsg += "• Wrong API URL\n";
      errorMsg += "• Check backend console for requests";
      
      if (Telegram.WebApp) {
        Telegram.WebApp.showAlert(errorMsg);
      }
    }
    alert(errorMsg);
    return;
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
