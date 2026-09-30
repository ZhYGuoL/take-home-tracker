// QA walk-through for docs/qa. Run: aside repl "$(cat docs/qa/aside/lib.js docs/qa/aside/desktop-2.js)"
const FG = 'http://127.0.0.1:8790';
const failNext = (p, times) => p.evaluate(async ([fg, n]) => {
  const sheets = await (await fetch(fg + '/__sheets')).json();
  const id = sheets.find((s) => s.owner === 'fake-avery').id;
  await fetch(fg + '/__fail', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: `/v4/spreadsheets/${id}/values/'records'!A1`, status: 503, times: n }) });
}, [FG, times]);
const p = await openTab(APP + '/');
try {
  await signedIn(p);
  await tap(p, /button "Add"/);
  await shot(p, 'f1-01-add-paste-1440');
  await p.locator('textarea').first().fill('Priya Raman\nYesterday 4:10 PM\nHi Avery! My take-home is done: https://priya-ledger.example.com and the code is at github.com/ex-priya/ledger');
  await tap(p, /button "Read"/);
  await sleep(400);
  await shot(p, 'f2-01-paste-attaches-1440');
  await tap(p, /button "Save"/);
  await sleep(900);
  await shot(p, 'f2-02-attached-detail-1440');
  await tap(p, /button "Close"/);
  await tap(p, /button "Add"/);
  await p.locator('textarea').first().fill('From: Theo Marsh <theo.marsh@example.com>\nDate: Tue, Sep 29, 2026 at 9:02 AM\nSubject: Take-home submission\n\nHi Avery,\n\nHere is my take-home for the founding engineer role: https://theo-ledger.example.com\nCode: https://github.com/ex-theo/ledger\n\nThanks,\nTheo');
  await tap(p, /button "Read"/);
  await sleep(400);
  await shot(p, 'f1-02-paste-proposes-new-1440');
  // She corrects the role, and checks the message part further down.
  await fillField(p, /textbox "Role"/, 'Founding full-stack engineer');
  await p.evaluate(() => { const b = document.querySelector('.form-body'); if (b) b.scrollTop = b.scrollHeight; });
  await sleep(300);
  await shot(p, 'f1-03-paste-message-and-correction-1440');
  await tap(p, /button "Save"/);
  await sleep(900);
  await shot(p, 'f1-04-saved-detail-1440');
  await tap(p, /button "Close"/);
  await tap(p, /button "Add"/);
  await tap(p, /radio "By hand"/);
  await shot(p, 'f9-01-by-hand-1440');
  await fillField(p, /textbox "Name"/, 'Rowan Okafor');
  await fillField(p, /textbox "Role"/, 'Founding engineer');
  await fillField(p, /textbox "Contact"/, 'rowan.okafor@example.com');
  await tap(p, /button "48h"/);
  await tapLast(p, /button "Add"/);
  await sleep(900);
  await shot(p, 'f9-02-by-hand-saved-1440');
  await tap(p, /button "Close"/);
  // Google fails: the save stays on this device, and the header says so, with the panel open.
  await tap(p, /radio "All/);
  await tap(p, /button "Nora Kim"/);
  await failNext(p, 50);
  await p.locator('textarea').first().fill('Asked about hosted databases.');
  await sleep(2500);
  await shot(p, 'sync-01-not-synced-panel-open-1440');
  await tap(p, /button "Close"/);
  await tap(p, /button "Sign out"/);
  await sleep(800);
  await shot(p, 'sync-02-sign-out-asks-1440');
  await tap(p, /button "Stay signed in"/);
  // Leave the browser clean for the next run: sign out, and let the refused save go.
  await tap(p, /button "Sign out"/);
  await sleep(800);
  await tap(p, /button "Sign out and lose/);
  await sleep(1500);
} finally {
  await closeTab(p);
}
