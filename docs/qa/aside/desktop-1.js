// QA walk-through for docs/qa. Run: aside repl "$(cat docs/qa/aside/lib.js docs/qa/aside/desktop-1.js)"
const p = await openTab(APP + '/');
try {
  await signedIn(p);
  await tap(p, /button "Sign out"/);
  await sleep(1500);
  await shot(p, 'f8-01-signed-out-1440');
  await tap(p, /link "Continue with Google"/);
  await sleep(800);
  await shot(p, 'f8-02-google-chooser-1440');
  await tap(p, /link "Avery Stone"/);
  await sleep(2500);
  await shot(p, 'f5-01-needs-you-1440');
  await tap(p, /radio "All/);
  await shot(p, 'f4-01-all-flags-1440');
  await tap(p, /button "Stage"/);
  await shot(p, 'f6-01-stage-filter-counts-1440');
  await tap(p, /checkbox "Submitted/);
  await p.keyboard.press('Escape');
  await sleep(200);
  await tap(p, /button "Flag/);
  await tap(p, /checkbox "Needs reply/);
  await p.keyboard.press('Escape');
  await sleep(300);
  await shot(p, 'f6-02-stage-and-flag-1440');
  await p.locator('input[placeholder^="Name"]').first().fill('zzz');
  await sleep(500);
  await shot(p, 'f6-03-no-match-ways-back-1440');
  await tap(p, /button "Clear every filter/);
  await tap(p, /radio "All/);
  await tap(p, /button "Mei Tanaka"/);
  await shot(p, 'f4-02-late-detail-1440');
  await tap(p, /button "Close"/);
  await tap(p, /button "Diego Alvarez"/);
  await shot(p, 'f3-01-submitted-before-click-1440');
  await tap(p, /button "Advanced"/);
  await sleep(300);
  await shot(p, 'f3-02-advanced-after-click-1440');
  await tap(p, /button "Close"/);
} finally {
  await closeTab(p);
}
