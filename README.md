# Take-homes

Take-homes keeps the take-home assignments of all your candidates in one list.
It shows who has one, when it is due, what came back, and what needs you now.
You add a candidate by pasting a message from email, iMessage, LinkedIn, X, WhatsApp, Slack, or anywhere else.
Take-homes keeps your list in a Google Sheet in your own Google Drive.

It is free and open source (MIT).

## Start using it

You need a Google account. You do not need a new password.

1. Open the web address that the person who runs your copy sent you.
2. Click **Continue with Google**, and pick your Google account.
3. Google asks if Take-homes can "see, edit, create, and delete only the specific Google Drive files you use with this app".
   Leave that box ticked, and click **Continue**.
   Take-homes can then open only the one Sheet that it makes for you, and no other file in your Drive.
4. The list opens. A Google Sheet named **Take-home tracker** is now in your Google Drive.

Everyone who signs in gets their own Sheet, and nobody else can see yours.
Your browser reads and writes your Sheet at Google directly. The app's server keeps no copy of your list.

On an iPhone, open the address in Safari, tap the Share button, then **Add to Home Screen**.

## Every day

**Needs you** is the first view.
It shows the candidates who wait on you.
That is a submission you have not opened, a question you have not answered, or a deadline that passed with nothing in.
**All** shows everyone.

To add a candidate or a message:

1. Click **Add**.
2. Copy the message, with the name and date lines, and paste it into the box.
3. Check what Take-homes found: the name, the links, the dates, and the deadline. Change anything that is wrong.
4. Click **Save**.

A message from someone who is already on your list goes on their timeline.
If Take-homes picks the wrong person, change **Attach to** before you save.
If you see it later, open the message on the timeline and click **Move**.
To type everything yourself, click **By hand**.

Stages:

- **Sent**: you gave the candidate the take-home.
- **Submitted**: a submission link came in.
- **Reviewing**: you opened the submission from the app.
- **Advanced** and **Passed**: only you set these. Click the stage at the top of a candidate.

Flags:

- **Overdue**: the deadline passed, and nothing came in.
- **Late**: the submission came in after the deadline.
- **Needs reply**: the candidate's last message waits for your answer.
  Click **Replied** when you answered it somewhere else.

Deadlines keep the time zone that you agreed with the candidate.
"By Friday" ends at the end of Friday in that zone.
"48 hours" is 48 hours from when you sent the take-home.

Use the filters at the top to show only some stages, flags, roles, sources, or dates. The filters combine.

## Your data

- Everything is in the **Take-home tracker** Sheet in your Google Drive.
  The `candidates` tab is easy to read and to share. The app writes it again after each change.
  The `records` tab is what the app reads. Do not edit it.
- When you delete a candidate, Take-homes also removes their details and messages from the Sheet.
- **Sign out** signs you out on every device, and removes your list from that browser.
  If a change did not reach your Sheet yet, Take-homes asks before it signs you out.
- To remove Take-homes from your Google account, open your Google Account settings.
  Find the third-party apps that can use your account, pick **Take-homes**, and remove its access.
  Your Sheet stays in your Drive.
- If the app cannot reach Google, your changes stay on your device, and the top of the page shows **Not synced**.
  Click **Retry**, or wait. Your changes go out when the app reaches Google again.

## Run your own copy

Use these steps if you want a copy that you run yourself.
It costs nothing, and it takes about 30 minutes.
You type a few commands in the Terminal app. Copy each one exactly.

You need:

- a Mac or a Linux computer with [Node.js](https://nodejs.org) 24 or later,
- a Google account,
- a free Cloudflare account. It needs no card, and the free plan stops instead of billing you.

### 1. Get the code

1. Download this repository and open the folder in Terminal.
2. Run `corepack enable`, then `pnpm install`.

### 2. Make a Google sign-in client

1. At console.cloud.google.com, make a project named `take-home-tracker`.
2. In **APIs and Services**, then **Library**, turn on **Google Sheets API** and **Google Drive API**.
3. In **Google Auth Platform**, set up the consent screen:
   - App name `Take-homes`, and your email as the support and developer contact.
   - Audience: **External**.
   - Data access: add only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `.../auth/drive.file`.
4. Publish the app, so that its status is **In production**.
   With only these scopes, Google does not ask for a review.
   In **Testing** status, only listed people can sign in, and each sign-in ends after 7 days.
5. In **Clients**, make an OAuth client of the type **Web application**.
   Keep its client ID and client secret for step 3.

### 3. Put it on the web

1. Run `npx wrangler login`, and sign in to Cloudflare.
2. Run `pnpm run deploy`. At the end it shows your web address, which ends in `workers.dev`.
3. Set three secrets. Run each command, and paste the value when it asks:
   ```
   npx wrangler secret put GOOGLE_CLIENT_ID --name take-home-tracker
   npx wrangler secret put GOOGLE_CLIENT_SECRET --name take-home-tracker
   npx wrangler secret put SESSION_SECRET --name take-home-tracker
   ```
   For `SESSION_SECRET`, paste the output of `openssl rand -base64 48`.
4. Back in the Google console, open your OAuth client.
   Add the authorized redirect URI `https://<your web address>/auth/google/callback`, and save.
5. Open your web address, and sign in.

To get a new version later, download the code again, and run `pnpm install` and `pnpm run deploy`.

## For developers

```
pnpm install
pnpm dev        # the app at http://localhost:5173, with a fake Google for sign-in
pnpm demo       # adds fictional candidates for the fake "Avery Stone" account
pnpm verify     # lint, types, unit tests, browser tests, and the production build check
pnpm eval       # measures how well pastes are read (see eval/)
```

`pnpm dev` needs no Google account and no keys.
Before the first `pnpm verify`, run `pnpm exec playwright install chromium webkit` once.
Sign in as one of the fictional people on the fake account page.

- `DECISIONS.md` explains each design decision and the reason for it.
- `docs/qa/` has browser screenshots of each feature.
- `src/core` holds the rules: stages, flags, deadlines, filters, and reading a paste. It has no browser code.
- `src/client` is the React app. `src/worker` is the Cloudflare Worker for sign-in and the optional model.
- Fixed rules read each paste.
  A language model can also read it. It is off until the person who runs the copy turns it on (`DECISIONS.md`, D6 and D17).
