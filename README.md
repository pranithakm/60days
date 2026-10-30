# My 60-Day Transformation — Setup Guide

A free, mobile-first tracker for your 60-day diet and lifestyle plan.
It's built from plain **HTML + CSS + JavaScript**, hosted free on **GitHub Pages**, and stores every entry in **your own Google Sheet** through a small **Google Apps Script**.

This guide assumes you've never done this before. It takes about **20–30 minutes**, once.

---

## 0. What's in this folder

| File | What it does |
|---|---|
| `index.html` | The page itself |
| `style.css` | All the styling (pink / lavender / beige, iPhone-first) |
| `script.js` | All the app logic: checklists, calories, streaks, BMI, charts, syncing |
| `manifest.json` | Makes it installable as a Home Screen app |
| `service-worker.js` | Lets the app open quickly and work offline |
| `icons/` | App icons (PNG + SVG) |
| `apps-script/Code.gs` | The Google Sheets backend. Paste this into Apps Script; **don't** upload it to GitHub |
| `README.md` | This guide |

**How it works:**

```
iPhone (website)  ──►  Apps Script web app  ──►  Your Google Sheet
      ▲                    (checks token)              │
      └──────────── loads all records on open ◄────────┘
```

- **Google Sheets is the permanent database.** The phone keeps only a temporary copy so the app opens instantly, plus a queue of changes not yet saved. If you're offline, changes wait in the queue and upload once you're back online.
- The Apps Script URL and access token are typed into the app's **Settings** on each device. They are **never** put in the code, so your public GitHub repo has no way into your data.

---

## Step 1: Create the Google Sheet

1. Go to <https://sheets.google.com> and create a **Blank spreadsheet**.
2. Name it something like **My 60-Day Tracker**.
3. You don't need to create any tabs. The script creates them for you:
   `Daily_Logs`, `Routine_Logs`, `Food_Logs`, `Exercise_Logs`, `Weight_Logs`, `Weekly_Checkins`, `Settings`.

> Keep the spreadsheet **private** (don't share it). The website never needs the sheet to be public.

---

## Step 2: Add the Apps Script backend

### 2a. Paste the code
1. In your Google Sheet, open **Extensions → Apps Script**.
2. Delete whatever is in `Code.gs`.
3. Open `apps-script/Code.gs` from this folder in Notepad, copy **all** of it, and paste it in.
4. Click the **Save** icon 💾. Name the project **60-Day Tracker API**.

> *Optional:* the line `const SPREADSHEET_ID = '';` can stay empty because the script lives inside the sheet. Only fill it in if you made the script separately at script.google.com. The ID is the long part of the sheet URL between `/d/` and `/edit`.

### 2b. Create the tabs
1. In the function dropdown at the top (next to **Run** / **Debug**), choose **`setup`**.
2. Click **Run**.
3. Google will ask for permission: **Review permissions** → pick your account → you may see "Google hasn't verified this app". Click **Advanced → Go to 60-Day Tracker API (unsafe)** → **Allow**.
   *(It says "unsafe" only because you wrote the script yourself and didn't submit it to Google for review. It only accesses this spreadsheet.)*
4. Go back to your sheet. You should now see the 7 tabs with headers.

### 2c. Create your private access token
1. Choose **`generateApiToken`** in the function dropdown → **Run**.
2. Open **View → Execution log** (or the log panel at the bottom). It prints a line like:
   `Your new access token (copy it into the website Settings): 3f9c…`
3. Copy that token somewhere safe for a moment (you'll paste it into the app in Step 4). It is stored in **Project Settings → Script properties** as `API_TOKEN`.
   - Running `generateApiToken` again creates a new token, and the old one stops working everywhere.

### 2d. Deploy as a web app
1. Click **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" → **Web app**.
3. Fill in:
   - **Description:** `v1`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Click **Deploy** → authorize again if asked.
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

> **Changed `Code.gs` later?** Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. That keeps the same URL. Making a *New deployment* gives you a different URL.

### 🔐 Security: please read before you deploy

- **Why "Anyone"?** A website on GitHub Pages can't sign in to Google for you, so the web app has to accept requests without a Google login. With **Execute as: Me**, the script runs with *your* permission and only touches this one spreadsheet.
- **What protects your data:** every request must include your secret token, and requests without it are rejected. The spreadsheet itself stays private and is **not** shared with anyone.
- **Limits you should know about:**
  - Anyone who has **both** the URL and the token can read and change your tracker data. Don't post them anywhere, put them in GitHub or send them in screenshots.
  - The token is saved in the browser storage on each phone where you enter it. Anyone using your unlocked phone could see it.
  - This is "good enough for a personal tracker" security. It is not bank-grade. Don't store anything here that you wouldn't want exposed if the token leaked.
  - If you think the token leaked, run `generateApiToken` again and enter the new token in the app.
- Google Apps Script has free daily usage limits that are far above what one person's tracker uses.

---

## Step 3: Publish the website on GitHub Pages (free)

### 3a. Create a GitHub account and repository
1. Sign up at <https://github.com> (free).
2. Click **+ → New repository**.
3. **Repository name:** e.g. `my-60-days`
4. Choose **Public** (free GitHub Pages needs a public repo. That's fine, because the code has no secrets).
5. Click **Create repository**.

### 3b. Upload the files
1. On the new repo page, click **uploading an existing file** (or **Add file → Upload files**).
2. Drag these in from this folder:
   - `index.html`, `style.css`, `script.js`, `manifest.json`, `service-worker.js`, `README.md`
   - the whole **`icons`** folder (drag the folder itself so the files land in `icons/`)
3. **Don't upload the `apps-script` folder.** It isn't secret, but it doesn't belong on the website.
4. Click **Commit changes**.

### 3c. Turn on GitHub Pages
1. In the repo, open **Settings → Pages**.
2. Under **Build and deployment**: Source = **Deploy from a branch**, Branch = **main**, folder **/ (root)** → **Save**.
3. Wait 1–2 minutes, then refresh. You'll see: **Your site is live at `https://<your-username>.github.io/my-60-days/`**
4. Open that link to check it loads.

> **Updating the site later:** upload the changed file(s) again (same names) and commit. If you changed `index.html`, `style.css` or `script.js`, also change `CACHE_VERSION` in `service-worker.js` (e.g. `mt60-v1` → `mt60-v2`) so phones pick up the new version straight away.

---

## Step 4: Connect the website to your sheet

1. Open your GitHub Pages link.
2. The welcome screen asks for your **Day 1 start date**. Pick it and tap **Start my 60 days**.
3. Tap the ⚙️ **Settings** icon (top right).
4. Under **Google Sheets connection**:
   - paste the **Web app URL** from Step 2d
   - paste the **Access token** from Step 2c
   - tap **Save & test**
5. You should see **"Connected to Google Sheets ✓"**, and the status pill at the top turns green (**Saved / Synced**). Anything you entered before connecting is uploaded automatically.
6. Check your Google Sheet: a `Settings` tab with rows like `start_date`, `meal_plan`, … means it's working.

**Status pill (top right):**
- 🟢 **Saved / Synced**: everything is in your Google Sheet.
- 🟠 **Saving… / N unsaved**: uploading, or waiting to upload.
- 🔴 **Not saved / Offline**: couldn't reach Google. Your changes are kept on the phone and retried automatically. Tap the pill to retry now.
- ⚪ **Local**: not connected yet.

---

## Step 5: Add it to your iPhone Home Screen

1. On your iPhone, open **Safari** (it must be Safari) and go to your GitHub Pages link.
2. Tap the **Share** button (square with an arrow ↑).
3. Scroll down and tap **Add to Home Screen**.
   *(On newer iOS you may need **⋯ More → Add to Home Screen**.)*
4. Make sure **Open as Web App** is on, if you see that option.
5. Name it **My 60 Days** → **Add**.
6. Open it from the Home Screen. It runs full-screen like an app.
7. **Enter the URL and token in Settings again inside the Home Screen app.** iPhone keeps Home Screen apps separate from Safari, so the app doesn't see what you typed in Safari.

The site still works fine if you just open it in Safari.

---

## Using the app

**Bottom tabs:** Routine · Food · Exercise · Progress. The summary card at the top shows day X/60, program %, calories, protein, water, streak, weight and routine %.

**Date bar:** use ‹ › or tap the date to go to any earlier day. You can view and edit past days.

### Routine
- Tick / untick each habit. Tap ✏️ to add a note.
- Hair wash shows only on **Mon & Fri**, hair/body oil only on **Thursday**, the night oil only on **Sunday**.
- Filters: **All / To do / Done**. On past days "To do" becomes **Missed**.
- Nothing is ever ticked automatically based on the time.

### Food
- The weekly meal plan repeats every week. Tick an item to add its calories, protein and fibre. Untick to subtract them.
- **Skip** marks a meal as skipped. It doesn't count toward calories and doesn't count as a failure.
- **+ (pink button)** adds anything else you ate. Quick picks (banana, apple, guava, almonds, walnuts, seeds laddu) fill in typical values. You can enter calories only if you don't know the rest. Added foods can be edited ✏️ or deleted 🗑️.
- "Flex used X / 300" shows how much of your flexible allowance your extra foods used.
- **Water:** +250 ml, +500 ml, +1 L, or a custom amount. "Undo 250 ml" fixes mistakes.

> The default calories, protein and fibre per dish are **typical home-cooked estimates**. Adjust them to your real portions in **Settings → Weekly meal schedule**. Days you've already ticked keep the values they were recorded with.

### Exercise
- Enter your total steps, tap +500 / +1,000 / +2,000, or type any number into **Add steps** (e.g. 1,250 after a walk) to add it to the day's total. Also log walking minutes, exercise minutes, exercise type(s) and optional calories burned. Everything saves automatically.

### Progress
- Day X / 60, % completed, days remaining, start date and end date, all worked out from your start date. **Missing a day never resets your progress.**
- **Streaks:** a day counts as "completed" when you meet the minimum number of goals (default **4 of 6**: routine ≥ 80%, calories within target, protein, water, steps, exercise). Change this in **Settings → Streak rules**, so one missed optional habit doesn't break your streak.
- **60-day calendar:** pink = completed, lavender = partial, grey = missed. Tap any day to open it.
- **Weight & BMI:** BMI = weight (kg) ÷ height (m)², using your height (161 cm, editable). The charts show only weights you actually entered, never estimates. Use **+ Log** to add a weight on any day (e.g. your Day 1 weight).
- **Sunday check-in:** opens automatically on Sundays. If you miss Sunday, it appears the next time you open the app. Once you submit it, it stops asking. The averages are filled in from your logs, and you can edit them.

### Settings
Start date, calorie/protein/fibre/water/step/exercise targets, flexible allowance, height, weight unit (kg/lb), streak rules, routine timings, the weekly meal schedule (edit, add, remove, or copy one day to all days), the Google Sheets connection, and **CSV export** for each tab.

---

## About Google Fit / automatic step sync

I looked into it. **A website on iPhone can't sync steps automatically**, for these reasons:

- **Google Fit APIs:** Google deprecated them. New developer sign-ups stopped in 2024, the APIs are being shut down, and Google points developers to Health Connect.
- **Health Connect:** an **on-device Android** API. It has no web or REST access, so a website can't use it, and it doesn't exist on iPhone.
- **Apple Health (HealthKit):** only native iOS apps can use it. **Websites (including Home Screen web apps) can't read your steps.**

So the app uses **manual step entry**, and works fully without any integration.

### Optional: a free iPhone Shortcut that sends steps for you
The Shortcuts app *can* read Apple Health, so you can make a one-tap shortcut (or a daily automation) that sends today's steps straight to your Google Sheet:

1. Open **Shortcuts** → **+** (new shortcut).
2. Add **Find Health Samples**: Type = **Steps**, Start Date = **is today**.
3. Add **Calculate Statistics**: **Sum** of Health Samples.
4. Add **Get Contents of URL**:
   - URL: your **Apps Script web app URL**
   - Method: **POST**
   - Request Body: **JSON** with these fields:
     - `token` (Text) = your access token
     - `action` (Text) = `setSteps`
     - `steps` (Number) = the **Statistics** result from step 3
5. Name it "Send steps" and run it. Next time you open the tracker, today's steps appear.
6. *(Optional)* **Automation → Time of Day** (e.g. 9 PM) → run "Send steps".

> Action names can vary slightly between iOS versions. The shortcut holds your token, so don't share it.

Another way: open the site with `?steps=6200` on the end (e.g. `https://<you>.github.io/my-60-days/?steps=6200`) to fill in today's steps.

---

## Testing checklist

Already checked while building (headless Chrome, iframes at fixed sizes):
- ✅ 320 × 568, 375 × 812, **402 × 874 (iPhone 17)**, 430 × 932 on all four tabs: no horizontal scrolling, no content clipped, and the bottom navigation never covers content.
- ✅ Ticking a meal updates the calorie, protein and fibre totals immediately. The add-food form, Sunday check-in and Settings all render correctly at 320 px.

Please check yourself after deploying:
1. Tick a routine item and a meal → refresh the page → they're still ticked.
2. Open the Google Sheet → see rows in `Routine_Logs`, `Food_Logs` and `Daily_Logs`.
3. Untick the same item → the existing row updates (no duplicate row).
4. Add, edit and delete a manual food.
5. Open on a second device (enter the URL + token) → the same data loads.
6. Turn on Airplane mode, tick something, turn it off → the pill goes back to green.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Invalid access token" | Paste the token again (no spaces). If you ran `generateApiToken` again, use the newest token. |
| "API_TOKEN not set" | Run `generateApiToken` in Apps Script (Step 2c). |
| "HTTP 401/403" or a Google sign-in page | Deployment access must be **Anyone** (not "Anyone with Google account"). Redeploy. |
| Changes to `Code.gs` have no effect | **Manage deployments → Edit → New version → Deploy**. |
| Dates look odd in the sheet | Run `setup` again. It sets the date/id columns to plain text. |
| Old version of the site keeps showing | Bump `CACHE_VERSION` in `service-worker.js`, upload it, then close and reopen the app. |
| Home Screen app shows "Local" | The Home Screen app has its own storage. Enter the URL + token in its Settings. |
| Wrong data on one phone | Settings → **Clear local cache** (only clears that phone, then reloads from the sheet). |

---

*A reminder: nutrition values and BMI categories are general estimates, not medical advice. Review what the app shows before acting on it.*
