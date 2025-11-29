const { Telegraf } = require("telegraf");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./database");

// =============== EXPRESS API ===============
const app = express();
app.use(cors());
app.use(express.json());

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

  if (!date || !slots || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ success: false, error: "Invalid request data" });
  }

  let completed = 0;
  let hasError = false;

  slots.forEach((slot) => {
    db.run(
      "INSERT INTO reservations (date, start, end, name, phone, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [date, slot.start, slot.end, name, phone, user_id],
      function (err) {
        if (err) {
          console.error("Error saving reservation:", err);
          hasError = true;
        }
        completed++;
        
        // Send response after all operations complete
        if (completed === slots.length) {
          if (hasError) {
            return res.status(500).json({ success: false, error: "Failed to save some reservations" });
          }
          res.json({ success: true });
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
              web_app: { url: "https://rafayelryuk.github.io/selfie-studio/" }
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
