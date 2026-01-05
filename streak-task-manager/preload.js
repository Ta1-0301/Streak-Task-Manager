// プリロードスクリプト
// セキュリティのため、contextIsolationが有効な状態で
// レンダラプロセスとメインプロセスの橋渡しを行う

const { contextBridge, ipcRenderer } = require('electron');

// 必要に応じてAPIを公開
// 現在のアプリはローカルストレージを使用しているため、
// 追加のAPIは必要ありませんが、将来の拡張のために準備

contextBridge.exposeInMainWorld('electronAPI', {
    // プラットフォーム情報
    platform: process.platform,

    // アプリがElectronで動作しているかどうか
    isElectron: true,

    // バージョン情報
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});

// DOMContentLoadedイベントで初期化処理
window.addEventListener('DOMContentLoaded', () => {
    // Electronアプリとして動作していることをコンソールに表示
    console.log('🚀 Streak Task Manager - Electron Desktop App');
    console.log(`📦 Electron v${process.versions.electron}`);
    console.log(`⚙️ Node v${process.versions.node}`);
    console.log(`🌐 Chrome v${process.versions.chrome}`);
});
