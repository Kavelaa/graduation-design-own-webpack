const path = require("path");
const fs = require("fs");
const {
  shell,
  remote: { dialog, getCurrentWindow }
} = require("electron");
const { parseStringPromise: parseStringP, Builder } = require("xml2js");
export const md5 = require("md5");

const { promises: fsP } = fs;

/**
 *
 * @param {string} filePath 一般来说传入的只会是绝对路径，也可以传入相对路径，根据项目运行路径解析为绝对路径
 * @returns {Promise}
 */
export function readAndParseXML(filePath) {
  if (path.extname(filePath) !== ".xml")
    return Promise.reject(new Error("不是xml文件！"));

  filePath = path.resolve(filePath);

  return fsP.readFile(filePath, { encoding: "utf8" }).then((str) => {
    return parseStringP(str, { explicitRoot: false });
  });
}

export function saveObj2XML(filePath, XMLObj, data, flag = "w") {
  function dealConfig(DBItem, haveRoot) {
    const {
      $: { PayLoadName: payloadName },
      Ins
    } = DBItem;
    if (Ins) {
      Ins.forEach(({ $: { InsName }, Byte }) => {
        Byte &&
          Byte.forEach(({ $: attr }) => {
            const { ByteName } = attr;
            attr.Value = haveRoot
              ? data[payloadName][InsName][ByteName]
              : data[InsName][ByteName];
          });
      });
    }
  }
  let builder = new Builder({ headless: true, explicitRoot: false });

  const { DBItem } = XMLObj;
  if (DBItem) {
    DBItem.forEach((item) => dealConfig(item, true));
  } else {
    builder = new Builder({
      headless: true,
      explicitRoot: false,
      rootName: "DBItem"
    });
    dealConfig(XMLObj);
  }

  const tObj = { $: {}, ...XMLObj };

  const XMLString = builder.buildObject(tObj);
  const absolutePath = path.resolve(filePath);

  return fsP.writeFile(absolutePath, XMLString, { flag });
}

/**
 *
 * @param {string} filePath 绝对路径
 * @param {ArrayBuffer[]} buffers
 */
export function generateBinFromBuffers(filePath, buffers) {
  const typedArrays = buffers.map((buffer) => new Uint8Array(buffer));
  const allArrays = concatenate(Uint8Array, ...typedArrays);
  return fsP.writeFile(`${filePath}.bin`, allArrays, {
    encoding: "binary"
  });
}

function concatenate(resultConstructor, ...arrays) {
  let totalLength = 0;
  for (let arr of arrays) {
    totalLength += arr.length;
  }
  let result = new resultConstructor(totalLength);
  let offset = 0;
  for (let arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 *
 * @param {string} filePath 绝对路径
 * @description 判断是否已存在该文件
 */
export function alreadyHaveFile(filePath) {
  return fsP
    .readFile(filePath, { flag: "r" })
    .then(() => false)
    .catch(() => true);
}

/**
 *
 * @param {string} fPath 绝对路径
 */
export function openFileManager(fPath) {
  // 简单判断是否是xml文件
  const haveExt = !!path.extname(fPath);
  haveExt ? shell.showItemInFolder(fPath) : shell.openItem(fPath);
}

/**
 *
 * @param {string} defaultPath 默认路径
 */
export function openSaveDialog(defaultPath) {
  const mainWindow = getCurrentWindow();
  globalMask.open();
  return dialog
    .showSaveDialog(mainWindow, {
      title: "保存配置文件",
      defaultPath,
      filters: [{ name: "XML File", extensions: ["xml"] }]
    })
    .then(({ filePath }) => {
      globalMask.close();
      return filePath;
    });
}

export function openOpenDialog() {
  const mainWindow = getCurrentWindow();
  globalMask.open();
  return dialog
    .showOpenDialog(mainWindow, {
      title: "打开文件夹",
      properties: ["openDirectory"]
    })
    .then(({ filePaths, canceled }) => {
      globalMask.close();
      if (canceled) return;
      else return filePaths[0] || undefined;
    });
}

/**
 *
 * @param {() => string|void} callback
 */
export function listenToWindowClose(callback) {
  const solve = (e) => {
    const message = callback();

    if (message) {
      const mainWindow = getCurrentWindow();
      dialog
        .showMessageBox(mainWindow, {
          message,
          title: "提示",
          buttons: ["确定", "取消"],
          defaultId: 1,
          noLink: true,
          cancelId: 1
        })
        .then(({ response }) => {
          response === 0 && mainWindow.destroy();
          globalMask.close();
        });
      globalMask.open();
      e.returnValue = false;
    }
  };
  window.addEventListener("beforeunload", solve);
  return () => window.removeEventListener("beforeunload", solve);
}

/**
 *
 * @param {string} fileName 文件名
 * @description 判断是否是一个合法的文件名
 */
export function isFileName(fileName) {
  if (fileName.startsWith(".")) return false;

  const obj = path.parse(fileName);

  for (let keyValPair of Object.entries(obj)) {
    if (
      keyValPair[0] !== "name" &&
      keyValPair[0] !== "base" &&
      keyValPair[1] !== ""
    ) {
      return false;
    }
  }

  return true;
}

export const globalMask = {
  open() {
    if (!this.node) {
      this.node = document.createElement("div");
      this.node.className = "global-mask";
      document.body.appendChild(this.node);
    } else {
      this.node.style.display = "block";
    }
  },
  close() {
    if (this.node) {
      this.node.style.display = "none";
    }
  }
};
