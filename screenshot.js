const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { offscreen: true } });
  try {
    await win.loadURL('https://www.habbo.com/');
    await new Promise(r => setTimeout(r, 8000));
    const img = await win.capturePage();
    require('fs').writeFileSync('habbo.png', img.toPNG());
    console.log('Habbo screenshot saved');
  } catch(e) { console.log('Habbo error:', e.message); }
  try {
    const win2 = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { offscreen: true } });
    await win2.loadURL('https://www.hartico.tv/');
    await new Promise(r => setTimeout(r, 8000));
    const img2 = await win2.capturePage();
    require('fs').writeFileSync('hartico.png', img2.toPNG());
    console.log('Hartico screenshot saved');
  } catch(e) { console.log('Hartico error:', e.message); }
  app.quit();
});
