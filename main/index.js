// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("path");
const os = require("os");

const CHANNEL = {
  OPEN_FILE: "open-file",
  OPEN_FILE_FOLDER: "open-file-folder",
  OPEN_MASK: "open-mask",
  CLOSE_MASK: "close-mask"
};

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the app.
  if (process.env.NODE_ENV === "production") mainWindow.loadFile("index.html");
  else {
    mainWindow.loadURL("http://localhost:9999");
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    // Add React Devtools
    try {
      // 引入Chrome插件React Devtools，因为别的设备上不一定有或者版本不同，所以需要用try catch包裹一下。
      BrowserWindow.addDevToolsExtension(
        path.join(
          os.homedir(),
          "/AppData/Local/Google/Chrome/User Data/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/4.7.0_0"
        )
      );
    } catch (e) {
      console.log(e);
    }
  }

  changeMenu(mainWindow);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

/**
 *
 * @param {Electron.BrowserWindow} win
 */
function changeMenu(win) {
  const template = [
    {
      label: "文件",
      submenu: [
        { label: "打开文件", click: () => openFile(win, CHANNEL.OPEN_FILE) },
        {
          label: "打开文件夹",
          click: () => openFile(win, CHANNEL.OPEN_FILE_FOLDER)
        }
      ]
    },
    {
      label: "关于",
      submenu: [
        {
          label: "作者信息",
          click: () =>
            dialog.showMessageBox(win, {
              buttons: [],
              title: "作者信息",
              message: "成都信息工程大学 信处163 陈潇宇"
            })
        }
      ]
    }
  ];
  if (process.env.NODE_ENV !== "production") {
    template.push({
      label: "窗口",
      submenu: [{ label: "重新加载", role: "reload" }]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 *
 * @param {Electron.BrowserWindow} win
 * @param {string} type
 */
function openFile(win, type) {
  let property;
  let channel;
  let title;
  let filters = [];
  switch (type) {
    case CHANNEL.OPEN_FILE:
      title = "打开文件";
      property = "openFile";
      channel = CHANNEL.OPEN_FILE;
      filters.push({ name: "XML File", extensions: ["xml"] });
      break;
    case CHANNEL.OPEN_FILE_FOLDER:
      title = "打开文件夹";
      property = "openDirectory";
      channel = CHANNEL.OPEN_FILE_FOLDER;
      break;
    default:
  }
  win.webContents.send(CHANNEL.OPEN_MASK);
  dialog
    .showOpenDialog(win, {
      title,
      filters,
      properties: [property]
    })
    .then(({ canceled, filePaths }) => {
      if (!canceled) win.webContents.send(channel, filePaths[0]);
      win.webContents.send(CHANNEL.CLOSE_MASK);
    });
}
