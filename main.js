const { app, BrowserWindow, ipcMain, session, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
  // Remove menu bar
  Menu.setApplicationMenu(null);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[UI] did-finish-load');
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer:${level}] ${message}`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'mouseDown' && input.button === 'left') {
      console.log('[UI] mouseDown');
    }
  });

  // Open DevTools in development
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Set custom user agent
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.on('will-download', (event, item) => {
    if (!mainWindow) return;

    const downloadsDir = app.getPath('downloads');
    const filename = item.getFilename();
    const savePath = getUniqueDownloadPath(downloadsDir, filename);

    item.setSavePath(savePath);

    const downloadId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    mainWindow.webContents.send('download-item', {
      id: downloadId,
      filename,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: 'progress',
      savePath
    });

    item.on('updated', (event, state) => {
      if (!mainWindow) return;

      if (state === 'interrupted') {
        mainWindow.webContents.send('download-item', {
          id: downloadId,
          filename,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          state: 'interrupted',
          savePath
        });
        return;
      }

      if (state === 'progressing') {
        mainWindow.webContents.send('download-item', {
          id: downloadId,
          filename,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          state: 'progress',
          savePath
        });
      }
    });

    item.once('done', (event, state) => {
      if (!mainWindow) return;

      const normalizedState = state === 'completed' ? 'completed' : 'failed';
      mainWindow.webContents.send('download-item', {
        id: downloadId,
        filename,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state: normalizedState,
        savePath
      });
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for tab management
ipcMain.on('new-tab', (event, url) => {
  event.reply('create-tab', url);
});

ipcMain.on('close-tab', (event, tabId) => {
  event.reply('remove-tab', tabId);
});

ipcMain.on('ui-debug', (event, payload) => {
  const timestamp = new Date().toISOString();
  console.log(`[UI] ${timestamp} ${payload}`);
});

ipcMain.on('download-show', (event, payload) => {
  if (payload?.path) {
    shell.showItemInFolder(payload.path);
  }
});

ipcMain.on('download-open', (event, payload) => {
  if (payload?.path) {
    shell.openPath(payload.path);
  }
});

function getUniqueDownloadPath(downloadsDir, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(downloadsDir, filename);
  let counter = 1;

  while (fs.existsSync(candidate)) {
    const nextName = `${parsed.name} (${counter})${parsed.ext}`;
    candidate = path.join(downloadsDir, nextName);
    counter += 1;
  }

  return candidate;
}
