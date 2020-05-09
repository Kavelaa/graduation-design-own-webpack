import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
  useContext
} from "react";
import { Tree, Empty, Typography, Tooltip, Spin, Button } from "antd";
import { FolderViewOutlined } from "@ant-design/icons";

import { useGetDirectory, formatToTreeData } from "../hooks";
import { Context } from "../../../App";
import { FileObj } from "../../../helpers/fileObj";
import { openFileManager, openOpenDialog } from "../../../helpers";

const nPath = require("path");

const { Text } = Typography;
const { DirectoryTree } = Tree;

export default function OwnDirectoryTree() {
  const {
    fileDirPath,
    setFileDirPath,
    currentFileObj,
    setCurrentFileObj
  } = useContext(Context);
  const { filesPaths, isReading, noDirPath } = useGetDirectory(fileDirPath);

  const [expandedKeys, setExpandedKeys] = useState([]);

  const mCurrentFileObj = useRef(currentFileObj);

  const treeData = useMemo(
    () => filesPaths && formatToTreeData(filesPaths, false, "xml"),
    [filesPaths]
  );
  const handleSelect = useCallback(
    (selectedKeys) => {
      const fileObj = new FileObj({
        filePath: selectedKeys[0]
      });

      setCurrentFileObj(fileObj);
    },
    [setCurrentFileObj]
  );
  const handleExpand = useCallback((keys) => {
    setExpandedKeys(keys);
  }, []);
  const handleOpenFolder = useCallback(() => {
    openFileManager(nPath.resolve(fileDirPath));
  }, [fileDirPath]);

  // currentFileObj变化时走的副作用，这样做的效率比用依赖项数组要高，因为用到了expandedKeys，会导致更多的无意义计算
  // 此处不会出现无限循环，忽略eslint的提示
  // eslint-disable-next-line
  useEffect(() => {
    if (currentFileObj !== mCurrentFileObj.current && !noDirPath) {
      mCurrentFileObj.current = currentFileObj;

      const { filePath } = currentFileObj;
      if (filePath) {
        let dirPath = filePath;
        const incrementExpandedKeys = [];
        while (dirPath.includes(fileDirPath) && dirPath !== fileDirPath) {
          dirPath = nPath.dirname(dirPath);
          incrementExpandedKeys.push(dirPath);
        }
        setExpandedKeys((prevKeys) => {
          const set = new Set([...prevKeys, ...incrementExpandedKeys]);
          return Array.from(set);
        });
      }
    }
  });

  useEffect(() => {
    setExpandedKeys([]);
  }, [fileDirPath]);

  const folderName = nPath.basename(fileDirPath);
  const handleOpenFileFolder = () => {
    openOpenDialog().then((dirPath) => {
      if (dirPath) setFileDirPath(dirPath);
    });
  };

  return (
    <div style={{ padding: "5px 0" }}>
      {/* 没有打开任何文件夹，则提示`打开一个文件夹` */}
      {noDirPath ? (
        <Empty description="你可以打开一个文件夹">
          <Button type="primary" onClick={handleOpenFileFolder}>
            打开文件夹
          </Button>
        </Empty>
      ) : (
        <>
          <Text code style={{ userSelect: "none" }}>
            {folderName}
            <Tooltip placement="right" title="在文件资源管理器中显示">
              {" "}
              <FolderViewOutlined
                className="own-icon"
                onClick={handleOpenFolder}
              />
            </Tooltip>
          </Text>

          {filesPaths && filesPaths.length > 0 ? (
            isReading ? (
              <Spin />
            ) : (
              <DirectoryTree
                style={{ padding: "5px 0" }}
                autoExpandParent={false}
                selectedKeys={[currentFileObj.filePath]}
                treeData={treeData}
                expandedKeys={expandedKeys}
                onSelect={handleSelect}
                onExpand={handleExpand}
              />
            )
          ) : (
            <Empty />
          )}
        </>
      )}
    </div>
  );
}
