# Kuestro

A private routine app for prayer, skin care, workouts, runs, reading and meals. It connects to Strava, Apple Health (through an iPhone Shortcut), Claude and ChatGPT. It works offline and can be added to your home screen.

## 1. Publish on GitHub Pages
1. On github.com create a new repository, e.g. `kuestro`.
2. **Add file → Upload files** and upload everything here: `index.html`, `app.js`, `foods.js`, `theme.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`.
3. **Settings → Pages → Deploy from a branch → main → / (root) → Save.**
4. After about a minute the app is live at `https://YOUR-USERNAME.github.io/kuestro/`.

## 2. Add to your home screen
- iPhone (Safari): Share → **Add to Home Screen**. Always open Kuestro from this icon.
- Android (Chrome): ⋮ → **Install app**.

## 3. Lock it (do this first)
Go to **Settings → Passcode lock**. Your data is encrypted on your phone with AES-256, and the app locks when you leave it.
**If you forget the passcode, the data can't be recovered**, so export a backup now and then.

### Who can see what
- GitHub only holds the app's code. **None of your data goes to GitHub.** Anyone who opens your link gets a blank copy of the app on their own device.
- Your data only leaves your phone when you use a connection yourself: Strava (to download your activities), aladhan.com (prayer times for your city) and Claude/OpenAI (only when you tap Ask).
- The app blocks connections to any other site.

## 4. Connect Strava
1. Go to https://www.strava.com/settings/api and create an app. Set **Authorization Callback Domain** = `YOUR-USERNAME.github.io`.
2. In Kuestro go to **Connect → Strava**, paste the Client ID and Secret, and tap **Connect**.
3. If Strava sends you back to Safari instead of the app, copy the code it shows. Then open Kuestro from your home screen and go to **Connect → Strava → Got a code?**
Runs are logged as runs and everything else as workouts. They also tick off your Run and Workout routines. Kuestro syncs whenever you open it, at most once an hour.

**Apple Watch / Health workouts:** connect Apple Health in the Strava app. Workouts then go Health → Strava → Kuestro.

## 5. Apple Health (steps, active calories, exercise minutes, weight)
Apple doesn't let any website read Health, so an iPhone Shortcut does it. The steps are inside the app under **Connect → Apple Health → Set up the Shortcut**. The Shortcut copies something like:
```
KUESTRO
steps=8432
active_kcal=540
exercise_min=45
weight=72.5
```
Then tap **Import from Health**. Add a daily Automation in the Shortcuts app so the data is ready every evening.

## 6. Prayer app
Add your prayer app under **Connect → App shortcuts**, then pick it under **Prayer app**.
- **iPhone:** in the Shortcuts app, make a shortcut with one action, **Open App → (your app)**, named e.g. "Open Muslim Pro". In Kuestro choose "iPhone app (via Shortcuts)" and enter that name. This works for any app.
- **Android:** choose "Android app" and enter the package name, e.g. `com.bitsmedia.android.muslimpro`.

Set the same calculation method in **Settings** so the times match your app. "Add this month's prayer times to my calendar" gives you an alert for each prayer.

## 7. Claude / ChatGPT coach
In the **Log** tab, write your workout plan and tap **Ask Claude** or **Ask ChatGPT**.
- With no keys, it copies your plan plus 4 weeks of training and health data, then opens the Claude or ChatGPT app.
- With an API key (Connect tab, stored encrypted), the answer appears inside Kuestro. API use is billed by Anthropic or OpenAI, so set a low spending limit on the key.

## Updating the app later
Upload the changed files again and change the version in `sw.js` (for example `kuestro-v22` to `kuestro-v23`) so phones get the update.

## Quests & levels 🏆
- **XP:** +10 per routine, +15 per prayer, +5 per log entry, +100 per badge.
- **Levels & titles:** 🌱 Beginner → 🧭 Seeker (3) → 🛡️ Disciplined (5) → ⚔️ Warrior (8) → 🏅 Champion (12) → 🦁 Master (16) → 👑 Legend (20).
- **Daily quests:** 3 new ones every day, picked from what you actually have scheduled. Claim all 3 to open the 🎁 daily chest. There's also a 🌟 perfect-day bonus, and you can swap your quests once a day.
- **Weekly quests:** 3 bigger goals, e.g. run 15 km, 3 workouts, all 5 prayers on 5 days.
- **Monthly boss:** each routine and prayer you finish this month is a hit. Defeat it for +500 XP.
- **Badges:** 16 to unlock (streaks, perfect days, 100 prayers, 50 km, 500 pages…).
- **Streak 🔥:** a day counts when at least half of its routines are done.

## Language learning 🗣️ (Learn tab)
- **Pick your language** the first time you open Learn: level, daily goal, new words per day, native language.
- **Duolingo:** tap 🦉 *Open Duolingo*, do your lesson, then log it under *Log practice* (minutes, plus XP and streak if you like). That ticks off your "Duolingo lesson" routine. Duolingo has no public API, so this part is manual. On iPhone you can set the Duolingo link to a Shortcut link (`shortcuts://run-shortcut?name=Open%20Duolingo`) so it always opens the app.
- **Flashcards with spaced repetition:** add the words you got wrong, one at a time or many at once (`word = meaning | example`). *Review* shows each card at the right moment (Again / Hard / Good / Easy). 🔊 reads it aloud and 🎤 *Say it* checks your pronunciation (Chrome / Safari).
- **AI tutor:** a story using your words, a quiz, conversation practice, help with words you keep forgetting, and writing correction. It uses Claude or ChatGPT, answering inside Kuestro if you saved an API key and opening the app otherwise.
- **Language quests and badges:** one language quest every day and every week, +2 XP per flashcard, and badges for 100 and 500 words, 50 words mastered and 10 hours of practice.
- **Starter routines:** Duolingo (daily), flashcards (daily), listening (3×/week), speaking (every 2 days) and conversation (weekly). You can edit them in Routines.

## Your character 🧙
Tap the hero card in **Quests** to design your character: name, motto, class, skin, hair or hijab, colors, eyes, mouth, beard, glasses or headband, outfit and background. *Randomize* and *Preview your Level 20 look* are there too.
- **Classes** give bonus XP. Paladin: +2 on everything. Monk: +5 on prayers & Quran. Warrior: +5 on workouts. Ranger: +5 on runs. Scholar: +5 on reading & language. Healer: +5 on skin care & meals. You can switch any time, and the bonus counts from the day you switch.
- **Gear unlocks:** 🧣 Scarf (Lv 3), ✨ Aura (Lv 5), 🦸 Cape (Lv 8), 🥇 Gold trim (Lv 12), 🌟 Star halo (Lv 16), 👑 Crown (Lv 20).

## Anime characters & quest animations ✨
- **Characters** are drawn in an anime style: sparkly eyes in 8 colors, 8 hairstyles (including hijab and twin tails), cat ears, an ahoge, a flower pin, a headband, blush and freckles.
- **9 classes, one for each activity, each with its own outfit:** 🛡️ Paladin (all), 📿 Spirit Monk (prayer), ⚔️ Warrior (workouts), 🏹 Wind Ranger (running), 🌸 Bloom Healer (skin care), 📜 Sage (reading), 🔮 Rune Mage (language), 🧪 Alchemist (meals), ♟️ Tactician (work/study).
- **QUEST CLEAR! screen** with anime speed lines and your character, themed by quest type: prayer 🌙 rising stars · workout 💥 power-up shake · run 💨 speed dash · skin care 🫧 bubbles · reading 📖 pages · language 💬 greetings in many languages · meals 🍎 falling fruit · steps 👣 footprints · chest 🪙 coins · boss ⚔️ sword slash.
- Ticking a routine gives a small themed burst. Sound effects can be turned off in More → Settings.

## 💊 Medications (More → Medications)
- Add each medication with its dose and form, how often (every day, certain days, or every few days), times (1×, 2×, 3× a day or custom), food instructions, start and end dates, and stock.
- Doses appear on **Today** in time order. Late doses are flagged, and ticking one off lowers your stock count. You get a refill alert when stock runs low.
- You can see the % taken over the last 7 and 30 days, and export a calendar file with a reminder at every dose time.
- There's a daily quest ("Take all your medications"), a weekly quest and the 💊 *Self-care pro* badge. The 🧪 Alchemist class gets +5 XP per dose.

## 🏋️ Train tab: 5-day rotating program
- The default rotation is **Push → Pull → Legs → Upper → Lower + Core** on **Sat, Sun, Mon, Wed, Thu** (Tue and Fri are rest days). You can change the days, rename workouts, and add, remove or reorder exercises (sets, reps, rest) in *Edit program*.
- **It rotates:** workouts go in order on your training days, and a missed day doesn't skip a workout. *Skip ⏭* moves to the next one.
- **During a workout:** last time's weights are filled in. Tick each set and a rest timer starts (+15s / Skip). The finish screen shows your sets and volume, and **NEW PR!** when you beat your best.
- A finished workout logs itself, ticks off "Training session" on Today, and counts toward the training quests and the 🏋️ *Iron will* and 🏆 *PR hunter* badges.
- The AI coach (Log → Workout coach) now sees your full program and your recent sets.

## 🃏 Card of the day
Tap the card on Today to reveal a motivational card (+5 XP). Collect all 30 across Discipline, Strength, Wisdom, Focus and Spirit. Your collection is in Quests.

## Navigation
The bottom bar is now **Today · Quests · Train · Learn · More**. *More* holds Routines, Medications, Log, Connections and Settings.

## 🌙 Dark mode
**More → Settings → Appearance:** *Auto* (follows your phone), *Light* or *Dark*. The 🌓 button at the top of **More** switches between them in one tap, and your choice is remembered, even on the lock screen. *(New file: `theme.js`, so upload it too.)*

## ⚔️ Hunter-style characters & STATUS window
- New default **Hunter** art style: a mature anime look with sharp eyes, ✨ glowing eyes (can be turned off), a dark high-collar coat and a glow in your class color. Switch back to **Chibi** in the character editor under *Art style*. Dark backgrounds were added.
- The **Quests** tab opens with a game-style **STATUS** window showing your level, class, EXP and 6 stats that grow with your real activity:
  💪 STR (workouts, runs) · ❤️ VIT (meds, meals, skin care) · 🧠 INT (reading, language) · 🌙 SPI (prayer) · 🎯 FOC (work and to-dos) · ⚔️ DIS (streaks and perfect days).

## 📋 To-do lists (new To-do tab)
- Starts with **Groceries 🛒, Work 💼 and Home 🏠** lists, and you can add your own with *＋ List*.
- Quick typing: `milk x2` adds a quantity, `pay bills !` marks it important ★, `call bank tomorrow` sets a due date. 📅 switches the due date between today, tomorrow and next week.
- **⭐ Today** collects starred and due tasks from every list, and they also appear on the Today screen with a quick-add box.
- *Share list* sends your grocery list to WhatsApp or anywhere else. *Clear done items* tidies the list.
- +5 XP per to-do (♟️ Tactician gets +5 more), daily and weekly to-do quests, and the 📋 *Getting it done* badge.

## 🌃 Night-city character look
The Hunter style now has a **black techwear jacket** (high zip collar, straps, orange accents), **rim lighting** on the hair, face and jacket, **amber eyes**, an earring, and a **night-city background** with blurred lights. You can change the *Light color* (orange, gold, blue, purple, red, green, white), switch the background to a plain color, and turn glowing eyes on or off.
**More → Settings → Accent color → 🟠 Night orange** gives the whole app the same orange-and-black look.

## 💰 Money (More → Money)
- **Import bank SMS:** paste one or many messages, use *Paste from clipboard*, or *Open file*. Kuestro reads the amount, whether it's spending or income, the shop, the date and the card, in **English and Arabic**. It skips OTP and balance-only messages and skips duplicates.
- **Auto-categories:** groceries, food, transport and fuel, bills, shopping, health, fitness, subscriptions, education, home, transfers, cash, gifts. Change a category once and it remembers that shop.
- **Android:** after installing from Chrome, long-press a bank SMS → **Share → Kuestro**.
- **iPhone:** a Shortcuts *Message* automation appends bank SMS to `bank.txt`, which you import with *Open file*.
- Monthly total, comparison with last month, a daily average, a **budget** bar with the daily amount you can spend to stay on track, and a "where it went" breakdown you can tap to filter.
- Foreign-currency charges (e.g. USD) are listed but kept out of your main-currency totals.

## 🎁 Wishlist (Money → Wishlist)
Add things you want with a price, priority and link. Track **how much you've saved** for each one. *Bought ✓* can also log it as spending.

## 🛒 Smarter groceries (To-do → Groceries)
Items are grouped by **aisle** automatically (English and Arabic). Add a price with `@`, e.g. `milk x2 @45`, to see an **estimated total**. **Done shopping** logs what you spent in Money and clears the checked items.

## 🖼️ Real anime illustration as your character
Character editor → **Character art → 🖼️ My own image → Upload your anime illustration**. A portrait or half-body works best. Your art becomes:
- a big **character card** on Quests (name, level, title, class, EXP and streak on top, with a glowing frame, a pulsing aura from Level 5, and 🌟/👑 at Levels 16/20),
- a **banner** at the top of Today,
- the hero of every **QUEST CLEAR / LEVEL UP** screen.
The image is stored only on your phone (encrypted with your passcode) and is never uploaded to GitHub.

## 📈 Progress (weekly & monthly)
Tap the progress bar on **Today**, the **📈 Weekly & monthly progress** button on Quests, or **More → Progress**.
- **Week / Month** with ‹ › to look back: overall completion ring, the change compared with the same point last week or month, XP earned, perfect days and your best day.
- **Day by day:** a bar chart for the week and a colour-coded calendar for the month. Tap a day to open it.
- **By area:** prayer, exercise, skin care, reading, language, meds and the rest.
- **Totals:** prayers, training sessions, km, pages, language minutes, flashcards, to-dos and spending.
- **Routines:** each one's done vs due, with weak spots marked *needs attention*.

## 🍡 Cute character style (default)
The character is now drawn in a soft **kawaii style**: rounded bangs, big glossy eyes, blush, a pastel background and rounded accessories (bow, cat ears, flower, curly ahoge). The Quests card is a soft pastel **Hero card** instead of the dark STATUS window. New characters start in the cute style. Existing characters keep their current style; switch any time in the character editor under *Art style* (**🍡 Cute** or **⚔️ Hunter**; the Hunter-only options like glowing eyes and night city appear only for Hunter). The Hunter style also got curtain bangs, thinner lashes and a rounder face. Hair names changed: *Spiky hero → Tufty*, *Wolf cut → Fluffy*. Bump the version in `sw.js` when you upload so phones refresh.

## 🎯 Planned weight per exercise
In **Train → Edit program**, each exercise has a **Weight** box (next to Sets, Reps and Rest). When you start that workout, every set is pre-filled with that weight and the card shows **🎯 62.5 kg**. Leave it empty to keep the old behavior (last time's weights are filled in). You can still change the weight on any set during the workout. The AI coach also sees the planned weights.

## 🥗 Meal calculator (Log → Meal)
Log what you ate and Kuestro adds up the **calories, protein, carbs and fat**.
- **Type your meal:** write it the way you'd say it, e.g. `2 eggs, 150g chicken breast, 1 cup rice, 1 tbsp olive oil` (Arabic names work too: `2 بيض, فول, عيش بلدي`), then tap **Calculate from my text**. Anything it can't find is listed so you can search it or add it yourself.
- **Or search:** start typing a food and tap it. Your recent foods show up when the box is empty. Change the amount in grams or in pieces/cups/spoons for each item.
- **Built-in foods:** about 110 common foods, including Egyptian ones (koshari, ful, ta'ameya, molokhia, baladi bread, mahshi, hawawshi, basbousa…). Values are approximate, per 100 g of cooked / ready-to-eat food.
- **Your own foods:** *＋ Add my own food* lets you copy the numbers from a package label. It is saved so you can find it by name next time (tap × on it to delete).
- **Daily summary & goals:** the top of the form shows today's calories, protein, carbs and fat. Tap 🎯 *Goals* to set a daily calorie and protein target and see progress bars. You can pick another date to see that day.
- Old meals you logged by hand still show up as before. Upload `foods.js` together with the other files.

## ⬆️ Progressive overload (Train)
Kuestro now tells you **when to add weight**.
- When you start a workout, each exercise looks at last time. If you hit the **top of the rep range on every set** (for example 8 reps on all sets of `6-8`) at your working weight, you get **⬆️ Time to add weight** and the sets are pre-filled with the heavier weight (+2.5 kg / +5 lb, or +1 kg / +2.5 lb for light weights).
- If you didn't hit every rep yet, it says **🎯 Stay at 60 kg until you hit 8 reps on every set**. Missing one set out of four still counts.
- The **Weight** box in *Edit program* is your current working weight and goes up automatically when you lift more. You can edit it any time (for example to lower it after a bad week).
- The next-workout card shows **⬆️ 2 ready for more weight**. Exercises with reps like "max", and bodyweight exercises, are skipped.

## 💧 Water & drinks (Today)
A **Water & drinks** card on Today: tap **Cup (250 ml)**, **Bottle (500 ml)**, **Coffee** or **Tea** every time you drink, or **More** for milk, juice, soda or any amount in ml. Everything counts toward your daily goal (pick **1.5, 2, 2.5, 3, 3.5 or 4 L** at the top right). See the time of every drink, delete a mistake, and see a breakdown (💧 1.75 L · ☕ 0.2 L). Reaching the goal ticks your **Drink water** routine automatically (and unticks it if you remove drinks or raise the goal). You can also open an earlier day to fill in drinks you forgot.

## 🌙 Evening check-in (More → Evening check-in)
A reminder before the day ends to log your progress. It is **on by default at 9:30 PM**; change the time or turn it off in *More → Evening check-in*.
- **In the app:** after the reminder time, a **🌙 The day is almost over** card appears at the top of Today showing how much is done, whether your 🔥 streak needs more ticks to survive, your water so far and whether you've logged a meal. Tap **Got it** to hide it for the day. It doesn't appear if everything is already done.
- **Notification:** tap **🔔 Allow notifications** once. Kuestro then sends one notification while it is open or in the background. The text is generic ("Time to log today's progress") so nothing private shows on a locked screen.
- **When Kuestro is fully closed:** a website can't push notifications without a server, so use **📅 Add a daily alert to my calendar**. Open the downloaded file once and your phone's calendar adds a daily alert at your chosen time; tapping it opens Kuestro. If you change the time, download and open it again.

## 🎨 New app icon
A purple quest-scroll logo: a checklist scroll with a golden ribbon and a glowing star. `icon.svg` is the rounded version (browser tab and the app's lock screen), and `icon-192.png` / `icon-512.png` are full-square versions for the home screen (phones round the corners themselves). To see it on your phone after updating, remove Kuestro from your Home Screen and add it again; some phones cache the old icon.

## ℹ️ The name change (DayFlow → Kuestro)
The app was renamed from DayFlow to Kuestro. A few internal names were kept on purpose so nothing you saved is lost: your data, theme and accent are still stored under the old `dayflow-…` keys, the calendar events keep their old IDs, and the Apple Health Shortcut works with either the old header `DAYFLOW` or the new `KUESTRO`. Existing backups still import.

## 🥗 Meals card on Today
Right under the **Water & drinks** card there is now a **Meals** card, followed by your **Meals & health** routines.
- Today's calories, protein, carbs and fat, with progress bars if you set goals (🎯 Goals in *More → Log → Meal*).
- **🌅 Breakfast · 🍽️ Lunch · 🌙 Dinner · 🍎 Snack** buttons open the meal calculator with that meal already chosen. After you save, you come straight back to Today.
- The meals you logged today are listed with their calories (× removes one).
- **Log again with one tap:** your last few meals appear as buttons, and one tap logs the same meal again for the day you're viewing.

## ↕️ Collapse and pin cards
Every card with a title has a **▾** arrow and a **📌** pin, on every screen:
- Tap **▾** to fold a card down to its title (the rest of the card hides, so there's less scrolling). Tap again to open it. Your choice is remembered.
- Tap **📌** to **pin a card open**. A pinned card stays expanded and is skipped by *Collapse all*. Unpin it to be able to fold it again.
- **⇕ Collapse all** and **Expand all** appear at the top of any screen with three or more cards.
- Cards that already fold by themselves (the "How to…" sections) and navigation cards (month/week arrows) are left as they are.
