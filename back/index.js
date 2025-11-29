const { Telegraf } = require("telegraf");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./database");

// =============== EXPRESS API ===============
const app = express();

// CORS configuration - allow all origins (needed for Telegram Web Apps)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    query: req.query,
    body: req.body ? Object.keys(req.body) : 'no body',
    headers: {
      'ngrok-skip-browser-warning': req.headers['ngrok-skip-browser-warning'],
      'origin': req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    }
  });
  next();
});

// Test endpoint to verify database connection
app.get("/test-db", (req, res) => {
  db.all("SELECT COUNT(*) as count FROM reservations", [], (err, rows) => {
    if (err) {
      console.error("Database test error:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json({ success: true, count: rows[0]?.count || 0, message: "Database connection OK" });
  });
});

// Return booked slots for a specific date
app.get("/slots/:date", (req, res) => {
  const date = req.params.date;
  const user_id = req.query.user_id;

  // Get all booked slots (for blocking others)
  db.all(
    "SELECT start, user_id FROM reservations WHERE date = ?",
    [date],
    (err, rows) => {
      if (err) return res.json({ booked: [], personal: [] });
      
      const allBooked = rows.map(r => r.start);
      
      // Get personal bookings (only for the requesting user)
      const personal = rows
        .filter(r => r.user_id === user_id)
        .map(r => r.start);
      
      res.json({ 
        booked: allBooked,
        personal: personal 
      });
    }
  );
});

// Delete reservation
app.post("/cancel", (req, res) => {
  const { date, start, user_id } = req.body;

  db.run(
    "DELETE FROM reservations WHERE date = ? AND start = ? AND user_id = ?",
    [date, start, user_id],
    function (err) {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

// Save reservation
app.post("/reserve", (req, res) => {
  const { date, slots, name, phone, user_id } = req.body;

  console.log("Reservation request received:", { date, slots: slots?.length, name, phone, user_id });

  if (!date || !slots || !Array.isArray(slots) || slots.length === 0) {
    console.error("Invalid request data:", req.body);
    return res.status(400).json({ success: false, error: "Invalid request data" });
  }

  if (!name || !phone || !user_id) {
    console.error("Missing required fields:", { name, phone, user_id });
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  let completed = 0;
  let hasError = false;
  const errors = [];

  slots.forEach((slot) => {
    if (!slot.start || !slot.end) {
      console.error("Invalid slot data:", slot);
      errors.push(`Invalid slot: ${JSON.stringify(slot)}`);
      completed++;
      if (completed === slots.length) {
        return res.status(400).json({ success: false, error: "Invalid slot data", details: errors });
      }
      return;
    }

    // First check if this slot is already reserved by someone else
    db.get(
      "SELECT id, user_id FROM reservations WHERE date = ? AND start = ?",
      [date, slot.start],
      function (err, row) {
        if (err) {
          console.error("Error checking existing reservation:", err);
          hasError = true;
          errors.push(`Error checking slot ${slot.start}: ${err.message}`);
          completed++;
          if (completed === slots.length) {
            return res.status(500).json({ success: false, error: "Failed to save some reservations", details: errors });
          }
          return;
        }

        if (row) {
          // Slot is already reserved
          if (row.user_id === user_id) {
            // Already reserved by this user - update it instead
            console.log(`Slot ${slot.start} already reserved by user ${user_id}, updating...`);
            db.run(
              "UPDATE reservations SET end = ?, name = ?, phone = ? WHERE date = ? AND start = ? AND user_id = ?",
              [slot.end, name, phone, date, slot.start, user_id],
              function (updateErr) {
                if (updateErr) {
                  console.error("Error updating reservation:", updateErr);
                  hasError = true;
                  errors.push(`Error updating slot ${slot.start}: ${updateErr.message}`);
                } else {
                  console.log(`Reservation updated: ${date} ${slot.start}-${slot.end} for user ${user_id}`);
                }
                completed++;
                if (completed === slots.length) {
                  if (hasError) {
                    return res.status(500).json({ success: false, error: "Failed to save some reservations", details: errors });
                  }
                  console.log(`All ${slots.length} reservations saved/updated successfully`);
                  res.json({ success: true });
                }
              }
            );
          } else {
            // Reserved by someone else - skip this slot
            console.warn(`Slot ${slot.start} is already reserved by another user`);
            errors.push(`Slot ${slot.start} is already reserved`);
            hasError = true;
            completed++;
            if (completed === slots.length) {
              return res.status(400).json({ success: false, error: "Some slots are already reserved", details: errors });
            }
          }
        } else {
          // New reservation - insert it
          db.run(
            "INSERT INTO reservations (date, start, end, name, phone, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            [date, slot.start, slot.end, name, phone, user_id],
            function (insertErr) {
              if (insertErr) {
                console.error("Database error saving reservation:", insertErr);
                console.error("Slot data:", { date, start: slot.start, end: slot.end, name, phone, user_id });
                hasError = true;
                errors.push(`Error saving slot ${slot.start}: ${insertErr.message}`);
              } else {
                console.log(`Reservation saved: ${date} ${slot.start}-${slot.end} for user ${user_id}`);
              }
              completed++;
              
              // Send response after all operations complete
              if (completed === slots.length) {
                if (hasError) {
                  return res.status(500).json({ success: false, error: "Failed to save some reservations", details: errors });
                }
                console.log(`All ${slots.length} reservations saved successfully`);
                res.json({ success: true });
              }
            }
          );
        }
      }
    );
  });
});

app.listen(3000, () => console.log("API running on port 3000"));

// =============== TELEGRAM BOT ===============
const bot = new Telegraf(process.env.BOT_TOKEN);

// START
bot.start((ctx) => {
  ctx.reply(
    "Привет! 👋 Нажми /book чтобы открыть календарь.\n" +
    "Բարև 🙌 /book գրիր, որպեսզի բացվի ամրագրումը։"
  );
});

// BOOK
bot.command("book", (ctx) => {
  ctx.reply(
    "Открываю меню бронирования… 📆\n" +
    "Բացում եմ ամրագրումների էջը… 📆",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Открыть календарь 📸 / Բացել օրացույցը",
              web_app: { url: `${API_URL}/webapp` }

            }
          ]
        ]
      }
    }
  );
});

// Receive WebApp booking
bot.on("web_app_data", (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data);

    ctx.reply(
      "✨ Новое бронирование сохранено!\n" +
      "📅 Дата: " + data.date + "\n" +
      "⏱ Время: " +
      data.slots.map(s => s.start + "-" + s.end).join(", ") + "\n" +
      "👤 Имя: " + data.name + "\n" +
      "📞 Телефон: " + data.phone + "\n\n" +

      "✨ Նոր ամրագրումը պահպանված է!\n" +
      "📅 Ամսաթիվ: " + data.date + "\n" +
      "⏱ Ժամ: " +
      data.slots.map(s => s.start + "-" + s.end).join(", ") + "\n" +
      "👤 Անուն: " + data.name + "\n" +
      "📞 Հեռախոսահամար: " + data.phone
    );
  } catch (e) {
    ctx.reply("Ошибка WebApp данных ❌\nWebApp տվյալների սխալ ❌");
  }
});

// RUN BOT
bot.launch();
console.log("Bot is running...");
