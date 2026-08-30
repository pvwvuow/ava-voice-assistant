/* Reproduce the exact electron-updater 6.8.9 GitHub check that the installed
   AVA v0.12.0 performs, in plain Node (same HTTP flow, same provider config). */
const { NsisUpdater } = require('/home/z/my-project/download/ava-voice-assistant/node_modules/electron-updater/out/NsisUpdater');

const stubApp = {
  whenReady: () => Promise.resolve(),
  version: '0.12.0',
  name: 'ava-voice-assistant',
  isPackaged: true,
  userDataPath: '/tmp/ava-test-userdata',
  baseCachePath: '/tmp/ava-test-cache',
  appUpdateConfigPath: null,
  getAppPath: () => '/tmp/ava-test-app',
  onQuit: () => {},
  quit: () => {},
};

const updater = new NsisUpdater({
  provider: 'github',
  owner: 'pvwvuow',
  repo: 'ava-voice-assistant',
  releaseType: 'release',
}, stubApp);

updater.autoDownload = false;

updater.on('checking-for-update', () => console.log('EVENT: checking-for-update'));
updater.on('update-available', (i) => console.log('EVENT: update-available →', i && i.version));
updater.on('update-not-available', (i) => console.log('EVENT: update-not-available →', i && i.version));
updater.on('download-progress', (p) => console.log('EVENT: download-progress', p && p.percent));
updater.on('update-downloaded', (i) => console.log('EVENT: update-downloaded →', i && i.version));
updater.on('error', (e) => console.log('EVENT: error →', e && (e.stack || e.message)));

updater.checkForUpdates()
  .then((r) => {
    console.log('RESOLVED:', r && r.updateInfo && r.updateInfo.version, '| isUpdateAvailable:', r && r.isUpdateAvailable);
    process.exit(0);
  })
  .catch((e) => {
    console.log('REJECTED:', e && (e.stack || e.message));
    process.exit(1);
  });

setTimeout(() => { console.log('TIMEOUT after 30s'); process.exit(2); }, 30000);
