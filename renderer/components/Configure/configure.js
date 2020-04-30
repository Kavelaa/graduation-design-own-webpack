import React, {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useRef,
  useEffect,
  useState,
  useMemo,
  useLayoutEffect
} from "react";
import {
  Typography,
  Row,
  Col,
  Form,
  Menu,
  InputNumber,
  Select,
  Divider,
  Empty,
  Button,
  Spin,
  Descriptions,
  Tooltip,
  message,
  Dropdown,
  Drawer,
  Modal
} from "antd";
import { FolderOpenOutlined, DownOutlined } from "@ant-design/icons";

import { useDealXML } from "./hooks";
import { openFileManager, openSaveDialog } from "../../helpers";

const { Title } = Typography;
const { Item, useForm } = Form;
const { Option } = Select;
const { Item: DescItem } = Descriptions;

export default forwardRef(function Configure(
  { filePath, configPath, changeFileObj, forceUpdateParent },
  ref
) {
  const [form] = useForm();
  const [choosedPayload, setChoosedPayload] = useState();
  const [config, setConfig] = useState();
  const [drawerPayloadName, setDrawerPayloadName] = useState();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 有configPath，则代表是基于模板新建的配置文件，则应该读模板文件
  // 没有configPath就是已经保存了的配置文件，当然直接读filePath也只能读filePath
  const {
    name,
    code,
    payloads,
    configs,
    initialValues,
    deleted,
    saveXML,
    generateBin,
    error
  } = useDealXML(configPath || filePath);

  const mInitialValues = useRef(initialValues);

  const [isSaving, setIsSaving] = useState(false);
  // 以下ref配合useEffect
  const canSaveRef = useRef(() => false);
  const getFieldsValueRef = useRef(() => false);

  const configure = useMemo(() => {
    function dealConfigs(configs) {
      return configs
        .map((config1) => {
          const shouldShow =
            config && config.pathName.join("") === config1.pathName.join("");

          return (
            config1 &&
            config1.componentTypes &&
            config1.componentTypes.length > 0 &&
            config1.componentTypes.map((componentType) => {
              const { name, pathName, type, children } = componentType;
              let Component;

              switch (type) {
                case "Select":
                  Component = (
                    <Select>
                      {children.map((child) => (
                        <Option key={child.value} {...child}>
                          {child.value}
                        </Option>
                      ))}
                    </Select>
                  );
                  break;
                case "InputNumber": {
                  const { unit, ...validChildren } = children;
                  Component = (
                    <InputNumber
                      formatter={(value) => `${value} ${unit}`}
                      parser={(str) => str.replace(` ${unit}`, "")}
                      {...validChildren}
                    />
                  );
                  break;
                }
                default:
                  Component = "";
              }

              return (
                <Item
                  key={pathName}
                  name={pathName}
                  label={name}
                  style={shouldShow ? undefined : { display: "none" }}
                >
                  {Component}
                </Item>
              );
            })
          );
        })
        .flat();
    }
    const showNull =
      config && config.componentTypes
        ? config.componentTypes.length > 0
          ? false
          : true
        : true;
    const allConfigs = configs
      ? dealConfigs(configs)
      : payloads
      ? Object.values(payloads)
          .map(({ configs }) => dealConfigs(configs))
          .flat()
      : null;

    return (
      <div style={{ flex: "auto", overflowY: "auto" }}>
        {allConfigs}
        {showNull && (
          <Empty
            description={"暂无可配置项"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    );
  }, [config, configs, payloads]);

  const showFormInfo = useMemo(() => {
    function renderDrawer({ title, width, children }) {
      return (
        <Drawer
          title={title}
          width={width || 0.2 * window.innerWidth}
          closable={false}
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
        >
          {children}
        </Drawer>
      );
    }
    function renderPayloadConfig(fieldsValue) {
      return (
        fieldsValue &&
        Object.entries(fieldsValue).map(([insKey, insValue], idx) => {
          const items = Object.entries(insValue).map(([label, value]) => {
            return (
              <DescItem key={label} label={label}>
                {value}
              </DescItem>
            );
          });
          return (
            <Descriptions bordered key={idx} layout="vertical" title={insKey}>
              {items}
            </Descriptions>
          );
        })
      );
    }
    const fieldsValue = getFieldsValueRef.current();
    if (!fieldsValue || Object.keys(fieldsValue).length === 0) return;

    const haveRoot = !Array.isArray(configs);
    if (haveRoot) {
      const payloadNameArr = Object.keys(fieldsValue);
      return renderDrawer({
        title: "选择负载",
        children: (
          <>
            {payloadNameArr &&
              payloadNameArr.map((name) => (
                <Button
                  key={name}
                  type="link"
                  onClick={() => {
                    setDrawerPayloadName(name);
                  }}
                >
                  {name}
                </Button>
              ))}
            <Drawer
              title={drawerPayloadName}
              width={window.innerWidth * 0.4}
              closable={false}
              visible={!!drawerPayloadName}
              onClose={() => setDrawerPayloadName()}
            >
              {renderPayloadConfig(fieldsValue[drawerPayloadName])}
            </Drawer>
          </>
        )
      });
    }
    return renderDrawer({
      title: name,
      width: 0.4 * window.innerWidth,
      children: renderPayloadConfig(fieldsValue)
    });
  }, [name, configs, drawerPayloadName, drawerVisible]);

  const handleDropdownSelect = useCallback(
    ({ key }) => {
      const newChoosedPayload = Object.values(payloads).find(
        ({ name }) => name === key
      );
      setChoosedPayload(newChoosedPayload);
      setConfig();
    },
    [payloads]
  );

  const handleSelect = useCallback(
    (name) => {
      const config = choosedPayload.configs.find(
        (config) => config.name === name
      );
      setConfig(config);
    },
    [choosedPayload, setConfig]
  );

  const handleSubmit = useCallback(
    (values) => {
      setIsSaving(true);

      if (configPath) {
        openSaveDialog(filePath).then((result) => {
          if (result) {
            saveXML(result, values).then(() => {
              setIsSaving(false);
              changeFileObj({ filePath: result, configPath: undefined });
            });
          } else {
            setIsSaving(false);
          }
        });
      } else {
        saveXML(filePath, values).then(() => {
          setIsSaving(false);
          changeFileObj({});
        });
      }
    },
    [filePath, configPath, saveXML, changeFileObj]
  );

  const handleGenerateBin = useCallback(() => {
    const generate = () =>
      generateBin()
        .then(() => message.success("生成成功！"))
        .catch((err) => message.error(err.message));

    if (form.isFieldsTouched()) {
      Modal.confirm({
        content: "当前配置暂未保存，要现在生成吗？",
        okText: "是",
        onOk: generate,
        cancelText: "否"
      });
    } else {
      generate();
    }
  }, [generateBin, form]);

  const handleOpenFolder = useCallback(() => {
    openFileManager(filePath);
  }, [filePath]);

  useImperativeHandle(
    ref,
    () => ({ needSave: () => form.isFieldsTouched(), isDeleted: deleted }),
    [deleted, form]
  );

  // 用副作用主要为了保证第一次渲染Form时，form还没有匹配到Form实例，就使用了FormInstance方法导致弹warning的问题
  useEffect(() => {
    if (configs || payloads) {
      canSaveRef.current = () => form.isFieldsTouched();
      getFieldsValueRef.current = () => form.getFieldsValue();
    }
  }, [configs, payloads, form]);

  // initialValues如果变化，代表重读了文件。这个地方用下面的注释方式，把eslint的warning主动关闭了，因为eslint判断存在无限循环渲染的风险。
  // 实际上是没有这个风险的，如果用官方的依赖项数组，会带来过多的不必要的数据缓存。
  // eslint-disable-next-line
  useEffect(() => {
    if (mInitialValues.current !== initialValues) {
      form.resetFields();
      mInitialValues.current = initialValues;

      if (config && config.name) {
        const tConfig = choosedPayload.configs.find(
          (tConfig) => tConfig.name === config.name
        );
        setConfig(tConfig);
      }

      forceUpdateParent();
      configs
        ? setChoosedPayload({ name, code, configs })
        : choosedPayload
        ? setChoosedPayload(
            payloads.find(({ name }) => name === choosedPayload.name)
          )
        : setChoosedPayload(payloads[0]);
    }
  });

  // 如果发现文件名更改或文件被删除，则强制父级更新tabBar的状态
  useLayoutEffect(() => {
    deleted && forceUpdateParent();
  }, [deleted, forceUpdateParent]);

  // 如果有error，则显示error的提示
  useLayoutEffect(() => {
    error && message.error(error, 3);
  }, [error]);

  //******************************************************************************* 渲染相关
  let titleItem;
  if (configs || payloads) {
    if (name) {
      titleItem = name;
    } else {
      const name = choosedPayload ? choosedPayload.name : "(空)";
      const menu = (
        <Menu selectedKeys={[name]} onClick={handleDropdownSelect}>
          {payloads.map(({ name: cName }) => (
            <Menu.Item key={cName}>{cName}</Menu.Item>
          ))}
        </Menu>
      );
      titleItem = (
        <Dropdown trigger={["click"]} overlay={menu}>
          <a className="ant-dropdown-link">
            {name}
            <DownOutlined style={{ fontSize: "80%" }} />
          </a>
        </Dropdown>
      );
    }
  }

  // configPath如果有值，代表是从配置文件新建的，此时还不存在实际的文件
  // deleted如果为`true`，代表该文件已经被删除或者被改名

  return configs || payloads ? (
    <Form
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "auto",
        overflow: "hidden"
      }}
      form={form}
      colon={false}
      layout="vertical"
      wrapperCol={{ span: 6 }}
      initialValues={initialValues}
      onFieldsChange={forceUpdateParent}
      onFinish={handleSubmit}
    >
      <Title level={3}>
        {titleItem}{" "}
        {!configPath && !deleted && (
          <Tooltip title="在文件资源管理器中显示" placement="right">
            <FolderOpenOutlined
              className="own-icon"
              onClick={handleOpenFolder}
            />
          </Tooltip>
        )}
      </Title>
      <Row gutter={16} justify="end">
        <Col span={4}>
          <Button
            block
            style={{ overflowX: "hidden", textOverflow: "ellipsis" }}
            onClick={() => setDrawerVisible(true)}
          >
            查看当前配置情况
          </Button>
        </Col>
        {!configPath && !deleted && (
          <Col span={4}>
            <Tooltip title="二进制文件会默认生成到和配置文件同一目录下">
              <Button
                block
                style={{ overflowX: "hidden", textOverflow: "ellipsis" }}
                onClick={handleGenerateBin}
              >
                生成二进制文件
              </Button>
            </Tooltip>
          </Col>
        )}
        {!deleted && (
          <Item shouldUpdate noStyle>
            {() => {
              const disabled = !canSaveRef.current();
              return (
                <>
                  <Col span={4}>
                    <Button
                      block
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      type="primary"
                      htmlType="submit"
                      disabled={disabled}
                      loading={isSaving}
                    >
                      保存
                    </Button>
                  </Col>
                  {!disabled && (
                    <Col span={4}>
                      <Button
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() => {
                          form.resetFields();
                          forceUpdateParent();
                        }}
                      >
                        取消当前未保存的更改
                      </Button>
                    </Col>
                  )}
                </>
              );
            }}
          </Item>
        )}
      </Row>
      <Item label={"选择配置项"} wrapperCol={24}>
        <Row>
          <Col span={6}>
            <Select
              style={{ width: "100%" }}
              value={config ? config.name : null}
              onChange={handleSelect}
            >
              {choosedPayload &&
                choosedPayload.configs.map((config) => {
                  const { name } = config;
                  return (
                    <Option key={name} value={name}>
                      {name}
                    </Option>
                  );
                })}
            </Select>
          </Col>
        </Row>
      </Item>
      <Divider style={{ backgroundColor: "#0000002f", flexShrink: "0" }} />
      {configure}
      {(configs || payloads) && showFormInfo}
    </Form>
  ) : (
    <Spin size="large" />
  );
});
