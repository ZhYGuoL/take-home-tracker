const APP = 'http://localhost:5173';
async function phone(p) {
  await p._sendToTarget('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
}
async function desktop(p) {
  await p._sendToTarget('Emulation.clearDeviceMetricsOverride', {});
  await sleep(400);
}
async function shot(p, name) {
  const [w, h] = await p.evaluate(() => [innerWidth, innerHeight]);
  const r = await p._sendToTarget('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  await fs.writeFile('tht-' + name + '.png', Buffer.from(r.data, 'base64'));
}
async function refOf(p, re) {
  const s = await snapshot(p);
  const line = s.tree.split('\n').find((l) => re.test(l));
  const m = line && line.match(/\[ref=(e\d+)\]/);
  if (!m) throw new Error('no ref for ' + re + '\n' + s.tree);
  return m[1];
}
async function tap(p, re) {
  await p.locator(await refOf(p, re)).click();
  await sleep(350);
}
async function signedIn(p) {
  await sleep(2500);
  if (/Continue with Google/.test((await snapshot(p)).tree)) {
    await tap(p, /link "Continue with Google"/);
    await sleep(800);
    await tap(p, /link "Avery Stone"/);
    await sleep(2500);
  }
}
async function tapLast(p, re) {
  const lines = (await snapshot(p)).tree.split('\n').filter((l) => re.test(l));
  const m = lines.at(-1)?.match(/\[ref=(e\d+)\]/);
  if (!m) throw new Error('no ref for ' + re);
  await p.locator(m[1]).click();
  await sleep(350);
}
async function fillField(p, re, text) {
  await p.locator(await refOf(p, re)).fill(text);
  await sleep(150);
}
