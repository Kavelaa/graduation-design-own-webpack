import React, { useState, useCallback, createContext, useEffect } from "react";
import { Layout } from "antd";

import FileTree from "./components/FileTree";
import Configure from "./components/Configure";

import "./App.css";
import { FileObj } from "./helpers/fileObj";
import { globalMask } from "./helpers";
import { changeConfig } from "./index";

const nPath = require("path");
const { ipcRenderer } = require("electron");

const { Sider, Content } = Layout;

export const Context = createContext();

function App({ fileDirPath: pFileDirPath, configDirPath: pConfigDirPath }) {
  const [currentFileObj, setCurrentFileObj] = useState(() => new FileObj());
  const [fileDirPath, setFileDirPath] = useState(pFileDirPath);
  const [configDirPath, setConfigDirPath] = useState(pConfigDirPath);

  const handleSetCurrentFileObj = useCallback((fileObj) => {
    const { filePath, configPath } = fileObj;

    // 如果有filePath则代表文件已保存，如果有configPath代表文件为新建
    const path = filePath || configPath;

    // 如果path为undefined，代表这个时候最后一个标签页被关闭
    // 选择的文件 不是xml文件 则不做任何行为
    const doNothing =
      path === undefined ? false : nPath.extname(path) !== ".xml";
    if (doNothing) return;

    setCurrentFileObj(fileObj);
  }, []);

  const handleSetFileDirPath = useCallback((dirPath) => {
    changeConfig({
      fileDirPath: dirPath
    });
    setFileDirPath(dirPath);
  }, []);

  const handleSetConfigDirPath = useCallback((dirPath) => {
    changeConfig({
      configDirPath: dirPath
    });
    setConfigDirPath(dirPath);
  }, []);

  useEffect(() => {
    ipcRenderer.addListener("open-mask", () => {
      globalMask.open();
    });
    ipcRenderer.addListener("close-mask", () => {
      globalMask.close();
    });
    ipcRenderer.addListener("open-file", (sender, filePath) => {
      setCurrentFileObj(new FileObj({ filePath }));
    });
    ipcRenderer.addListener("open-file-folder", (sender, fileDirPath) => {
      handleSetFileDirPath(fileDirPath);
    });
    return () => ipcRenderer.removeAllListeners();
  }, []);

  return (
    <Context.Provider
      value={{
        currentFileObj,
        setCurrentFileObj: handleSetCurrentFileObj,
        configDirPath,
        setConfigDirPath: handleSetConfigDirPath,
        fileDirPath,
        setFileDirPath: handleSetFileDirPath
      }}
    >
      <Layout style={{ height: "100vh" }}>
        <Sider
          theme="light"
          width="266px"
          style={{
            overflowX: "hidden",
            overflowY: "auto",
            padding: "5px",
            borderRight: "1px solid #f0f0f0"
          }}
        >
          <FileTree />
        </Sider>
        <Content style={{ backgroundColor: "white", padding: "0 3px" }}>
          <Configure />
        </Content>
      </Layout>
    </Context.Provider>
  );
}

export default App;
