import { useEffect, useState, useCallback } from "react";
const fs = require("fs");
const path = require("path");

const { promises: fsP } = fs;

/**
 *
 * @param {string} dirPath
 * @description fs异步获取`dirPath`下的各文件和文件夹路径，以数组方式返回，如果没读取到则返回`null`，获取到时会触发重渲
 */
export function useGetDirectory(dirPath) {
  const noDirPath = dirPath === "" ? true : false;
  let absolutePath = path.resolve(dirPath);
  const [filesPaths, setFilesPaths] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const read = useCallback(() => {
    setIsReading(true);
    traverseRead(absolutePath).then((filesPaths) => {
      setIsReading(false);
      setFilesPaths(filesPaths);
    });
  }, [absolutePath]);

  // 这个副作用的read操作，只在有dirPath时，且dirPath发生变化时才会执行，即所读的文件夹路径发生变化时才执行
  // 其他文件夹内部的变化，都由下方副作用处理
  useEffect(() => {
    !noDirPath && read();
  }, [noDirPath, read]);

  // 监听文件夹内是否变化，有变化则触发一次重渲，因为文件夹有变化，上面的副作用必然会重读文件夹
  useEffect(() => {
    const watcher = fs.watch(
      absolutePath,
      { persistent: false, recursive: true },
      (eventType) => {
        if (eventType === "rename") {
          read();
        }
      }
    );

    return () => {
      watcher.close();
    };
  }, [absolutePath, read]);

  return { filesPaths, isReading, noDirPath };
}

/**
 *
 * @param {string} dirPath
 * @param {boolean} addParentKey
 * @returns {Promise}
 */
function traverseRead(dirPath) {
  return fsP.readdir(dirPath, { withFileTypes: true }).then((files) => {
    return Promise.all(
      files.map((file) => {
        const key = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          return traverseRead(path.resolve(dirPath, file.name)).then(
            (filesInDir) => {
              return {
                name: file.name,
                key,
                children: filesInDir
              };
            }
          );
        }
        return {
          name: file.name,
          key
        };
      })
    );
  });
}

/**
 *
 * @param {string} filesPaths 绝对路径
 * @param {boolean} forTreeSelect 转化的数据是否被用于`TreeSelect`组件
 * @param {string} ext 如果需要筛选某一类文件，输入扩展名（无需加点，比如只需`xml`即可）
 */
export function formatToTreeData(filesPaths, forTreeSelect, ext) {
  let result = filesPaths.map((filePath) => {
    let { name, key, children } = filePath;

    let result = {
      key,
      title: name,
      isLeaf: children === undefined,
      selectable: children === undefined
    };
    if (forTreeSelect) {
      result.value = key;
      result.disabled = !result.isLeaf;
      result.selectable = result.isLeaf;
    }
    if (children) {
      result.children = formatToTreeData(children, forTreeSelect, ext);
    }

    return result;
  });

  if (ext) {
    result = result.filter(
      ({ title, isLeaf }) => !isLeaf || title.endsWith(`.${ext}`)
    );
  }

  return result;
}
