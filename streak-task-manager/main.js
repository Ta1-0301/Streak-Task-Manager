const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow;
let isDev = false;

function createWindow() {
    // 開発モードかどうかを判定
    isDev = !app.isPackaged;

    // メインウィンドウを作成
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0a0a0f',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'default',
        autoHideMenuBar: true, // メニューバーを自動で隠す
        show: false // 準備ができるまで非表示
    });

    // index.htmlをロード
    mainWindow.loadFile('index.html');

    // ウィンドウの準備ができたら表示（スムーズなUI表示のため）
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // フォーカスを設定
        mainWindow.focus();
    });

    // 開発モードの場合はDevToolsを開く
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // 外部リンクをシステムのデフォルトブラウザで開く
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // ウィンドウが閉じられた時の処理
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electronの初期化が完了したらウィンドウを作成
app.whenReady().then(() => {
    createWindow();

    // macOSでは、ドックアイコンがクリックされ、他にウィンドウが開いていない場合、
    // 新しいウィンドウを作成するのが一般的です
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// すべてのウィンドウが閉じられた時にアプリを終了（macOS以外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// セキュリティ: ナビゲーションを制限
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        // ローカルファイル以外へのナビゲーションを防止
        if (parsedUrl.protocol !== 'file:') {
            event.preventDefault();
        }
    });
});
