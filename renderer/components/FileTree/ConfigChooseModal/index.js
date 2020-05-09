import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useContext
} from "react";
import {
  Form,
  Modal,
  TreeSelect,
  Button,
  Alert,
  Input,
  Typography
} from "antd";

import { useGetDirectory, formatToTreeData } from "../hooks";
import { openFileManager, isFileName, openOpenDialog } from "../../../helpers";
import { FileObj } from "../../../helpers/fileObj";

import { Context } from "../../../App";

const nPath = require("path");

const { Title } = Typography;
const { Item } = Form;

export default function ConfigChooseModal({ visible, closeModal }) {
  const { configDirPath, setConfigDirPath, setCurrentFileObj } = useContext(
    Context
  );
  const { filesPaths: configFilesPaths } = useGetDirectory(configDirPath);
  const [firstStepNow, setFirstStepNow] = useState(true);
  const treeData = useMemo(() => {
    if (!Array.isArray(configFilesPaths)) {
      return [];
    } else {
      return formatToTreeData(configFilesPaths, true, "xml");
    }
  }, [configFilesPaths]);
  // Select相关
  const [selectedOption, setSelectedOption] = useState();
  const loading = configFilesPaths === null;

  // Input相关
  const [inputValue, setInputValue] = useState("");
  const handleInputChange = useCallback((e) => {
    const {
      target: { value }
    } = e;
    setInputValue(value.trim());
  }, []);

  // Modal相关
  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);
  const createFileObj = useCallback(
    (fileName, configPath) => {
      let filePath = fileName + ".xml";

      const obj = new FileObj({ filePath, configPath });
      setCurrentFileObj(obj);
      handleCancel();
    },
    [setCurrentFileObj, handleCancel]
  );
  const goLastStep = useCallback(() => {
    setFirstStepNow(true);
  }, []);
  const handleOk = useCallback(() => {
    if (firstStepNow) {
      setFirstStepNow(false);
    } else {
      createFileObj(inputValue, selectedOption);
    }
  }, [firstStepNow, inputValue, selectedOption, createFileObj]);

  // 和dom同步，初始化一部分状态
  useEffect(() => {
    if (visible) {
      setInputValue("");
      setFirstStepNow(true);
    }
  }, [visible]);

  const absoluteConfigDirPath = nPath.resolve(configDirPath);

  const validateStatus =
    inputValue !== ""
      ? isFileName(inputValue)
        ? "success"
        : "error"
      : "success";
  const hasFeedback = validateStatus === "error";
  const disabled = !(inputValue && isFileName(inputValue));
  const help = validateStatus === "error" ? "请确认输入了有效的文件名" : "";
  const handlePressEnter = () => {
    !disabled && handleOk();
  };

  // 这里都是Button组件，需要加`key`让React能够正确的协调
  // 否则React会认为更新后“下一步”按钮重渲成“上一步”按钮，而“确认”按钮是新增的
  // 实际上，新增的按钮是“上一步”按钮，更新后，“下一步”按钮被重渲成“确认”按钮
  const footer = firstStepNow ? (
    <>
      <Button key="1" onClick={handleCancel}>
        取消
      </Button>
      <Button
        key="3"
        disabled={!selectedOption}
        type="primary"
        onClick={handleOk}
      >
        下一步
      </Button>
    </>
  ) : (
    <>
      <Button key="1" onClick={handleCancel}>
        取消
      </Button>
      <Button key="2" onClick={goLastStep}>
        上一步
      </Button>
      <Button key="3" disabled={disabled} type="primary" onClick={handleOk}>
        确定
      </Button>
    </>
  );

  return (
    <Modal
      title={
        <Title level={4} style={{ margin: 0 }}>
          {firstStepNow ? "选择配置模板文件" : "设置配置文件名"}
        </Title>
      }
      visible={visible}
      maskClosable={false}
      closable={false}
      footer={footer}
      closeModal={handleCancel}
    >
      {firstStepNow ? (
        <>
          <Alert
            type="info"
            message="你可以基于已有的配置文件，来快速地生成一个新的配置"
          />
          <br></br>
          <Alert
            type="warning"
            message={
              <span>
                目前在
                <Button
                  type="link"
                  size="small"
                  onClick={() => openFileManager(absoluteConfigDirPath)}
                >
                  {absoluteConfigDirPath}
                </Button>
                搜索配置模板文件
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    openOpenDialog().then((dirPath) => {
                      if (dirPath) setConfigDirPath(dirPath);
                    });
                  }}
                >
                  修改搜索位置
                </Button>
              </span>
            }
          />
          <br></br>
          <TreeSelect
            style={{ minWidth: "200px" }}
            placeholder={"请选择"}
            loading={loading}
            value={selectedOption}
            onSelect={setSelectedOption}
            treeData={treeData}
          />
        </>
      ) : (
        <>
          <Item
            validateStatus={validateStatus}
            help={help}
            hasFeedback={hasFeedback}
          >
            <Input
              autoFocus
              value={inputValue}
              placeholder={"请输入文件名（无需后缀扩展名）"}
              onChange={handleInputChange}
              onPressEnter={handlePressEnter}
            />
          </Item>
        </>
      )}
    </Modal>
  );
}
