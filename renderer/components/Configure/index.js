import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useReducer
} from "react";
import { Tabs, Layout, Modal, Empty } from "antd";

import Configure from "./configure";
import { Context } from "../../App";
import { FileObj } from "../../helpers/fileObj";

import "./index.css";
import { listenToWindowClose } from "../../helpers";

const nPath = require("path");

const { TabPane } = Tabs;
const { Content } = Layout;

export default function ConfigureControl() {
  const { currentFileObj, setCurrentFileObj } = useContext(Context);
  // 这个地方使用useReducer模仿强制渲染，函数式组件没有专门的API，这也是官方给的替代方案
  // eslint-disable-next-line
  const [ignore, forceUpdate] = useReducer((state) => !state, true);
  const [fileObjList, setFileObjList] = useState([]);
  const handleTabClick = useCallback(
    (key) => {
      const fileObj = fileObjList.find(({ key: tKey }) => tKey === key);
      setCurrentFileObj({ ...fileObj });
    },
    [fileObjList, setCurrentFileObj]
  );
  const handleTabEdit = useCallback(
    (key, action) => {
      if (action === "remove") {
        const close = () => {
          const newFileObjList = fileObjList.filter(
            (targetObj) => targetObj.key !== key
          );
          setFileObjList(newFileObjList);

          const tFileObj = fileObjList.find(({ key: tKey }) => key === tKey);
          const { filePath: tFilePath, configPath: tConfigPath } = tFileObj;

          if (
            (tFilePath && tFilePath === currentFileObj.filePath) ||
            (tConfigPath && tConfigPath === currentFileObj.configPath)
          ) {
            let newFileObj;

            if (fileObjList.length === 1) {
              newFileObj = new FileObj();
            } else {
              if (fileObjIdx === fileObjList.length - 1) {
                newFileObj = fileObjList[fileObjIdx - 1];
              } else {
                newFileObj = fileObjList[fileObjIdx + 1];
              }
            }
            setCurrentFileObj({ ...newFileObj });
          }
        };
        const fileObjIdx = fileObjList.findIndex(
          ({ key: tKey }) => tKey === key
        );
        const {
          configPath,
          ref: { current: configure }
        } = fileObjList[fileObjIdx];

        const isNewConfig = configPath !== undefined;
        const needSave = configure.needSave();
        if (needSave || isNewConfig) {
          let content = needSave
            ? "当前配置尚未保存，是否放弃保存？"
            : "当前新建配置还未保存，是否放弃保存？";
          Modal.confirm({
            content,
            cancelText: "取消",
            okText: "放弃保存",
            okType: "danger",
            onOk: close
          });
        } else close();
      }
    },
    [currentFileObj, setCurrentFileObj, fileObjList]
  );

  useEffect(() => {
    const callback = () => {
      for (let i = 0; i < fileObjList.length; i++) {
        const needSave = fileObjList[i].ref.current.needSave();
        if (needSave) {
          return "你有配置未保存，确定要退出吗？";
        }
      }
    };
    return listenToWindowClose(callback);
  }, [fileObjList]);

  useEffect(() => {
    const { filePath, configPath } = currentFileObj;
    if (filePath || configPath) {
      const targetObj = fileObjList.find((targetObj) => {
        const { filePath: tFilePath, configPath: tConfigPath } = targetObj;
        if (filePath) return filePath === tFilePath;
        if (configPath) return configPath === tConfigPath;
        return false;
      });
      if (targetObj === undefined) {
        setFileObjList([...fileObjList, currentFileObj]);
      }
    }
  }, [currentFileObj, fileObjList, setCurrentFileObj]);

  const existFileObj = fileObjList.find(
    ({ filePath, configPath }) =>
      (filePath && filePath === currentFileObj.filePath) ||
      (configPath && configPath === currentFileObj.configPath)
  );
  const activeKey = existFileObj ? existFileObj.key : currentFileObj.key;

  return fileObjList.length > 0 ? (
    <Tabs
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      type="editable-card"
      tabBarGutter={5}
      hideAdd
      activeKey={activeKey}
      onTabClick={handleTabClick}
      onEdit={handleTabEdit}
    >
      {fileObjList.map((fileObj) => {
        const { filePath, configPath, key, ref } = fileObj;
        const changeFileObj = (obj) => {
          const { filePath } = obj;
          const newFileObjList = filePath
            ? fileObjList.filter(
                ({ filePath: tFilePath, configPath: tConfigPath }) =>
                  !(tFilePath === filePath && tConfigPath === undefined)
              )
            : [...fileObjList];
          Object.assign(fileObj, obj);
          setFileObjList(newFileObjList);
        };
        const fileName = nPath.basename(filePath);
        const newTag = configPath !== undefined ? "[新建]" : "";
        const isDeleted = ref.current
          ? ref.current.isDeleted
            ? newTag
              ? "[模板已被删除]"
              : "[已删除]"
            : ""
          : "";
        const modified = ref.current
          ? ref.current.needSave()
            ? "(未保存)"
            : ""
          : "";
        const tab = `${isDeleted}${newTag}${fileName}${modified}`;

        return (
          <TabPane style={{ height: "100%" }} tab={tab} key={key}>
            <Content
              style={{
                height: "100%",
                padding: "5px 10px",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <Configure
                ref={ref}
                filePath={filePath}
                configPath={configPath}
                forceUpdateParent={forceUpdate}
                changeFileObj={changeFileObj}
              />
            </Content>
          </TabPane>
        );
      })}
    </Tabs>
  ) : (
    <Empty
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
      }}
    />
  );
}
