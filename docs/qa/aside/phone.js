// QA walk-through for docs/qa. Run: aside repl "$(cat docs/qa/aside/lib.js docs/qa/aside/phone.js)"
const p = await openTab(APP + '/');
try {
  await phone(p);
  await signedIn(p);
  await shot(p, 'f7-01-needs-you-390');
  await tap(p, /radio "All/);
  await shot(p, 'f7-02-all-390');
  await tap(p, /button "Stage"/);
  await shot(p, 'f7-03-filter-sheet-390');
  await p.keyboard.press('Escape');
  await sleep(200);
  await tap(p, /button "Mei Tanaka/);
  await shot(p, 'f7-04-detail-390');
  await tap(p, /button "Close"/);
  await tap(p, /button "Add"/);
  await p.locator('textarea').first().fill('Lena Fischer\nYesterday 4:10 PM\nOne more thing: I pushed the tests to https://github.com/ex-lena/ledger. Is that OK?');
  await tap(p, /button "Read"/);
  await sleep(400);
  await shot(p, 'f7-05-paste-confirm-390');
  await tap(p, /button "Close"/);
  await p._sendToTarget('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  await shot(p, 'f7-06-all-320');
  await tap(p, /button "Mei Tanaka/);
  await shot(p, 'f7-07-detail-320');
  await tap(p, /button "Close"/);
  await phone(p);
  await tap(p, /button "Sign out"/);
  await sleep(1500);
  await shot(p, 'f8-03-signed-out-390');
} finally {
  await closeTab(p);
}
