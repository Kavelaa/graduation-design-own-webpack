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
  Input,
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
  Modal,
  Checkbox
} from "antd";
import {
  FolderOpenOutlined,
  DownOutlined,
  PlusOutlined,
  MinusCircleOutlined
} from "@ant-design/icons";

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
  const [editType, setEditType] = useState();
  const [editForm] = useForm();
  const [haveEditPayload, setHaveEditPayload] = useState(false);
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
    changeXMLObj,
    error
  } = useDealXML(configPath || filePath);

  const mInitialValues = useRef(initialValues);

  const [isSaving, setIsSaving] = useState(false);
  // 以下ref配合useEffect
  const canSaveRef = useRef(() => false);
  const getFieldsValueRef = useRef(() => false);

  const editModal = useMemo(() => {
    const shouldShow = !!editType;
    const handleFinish = (values) => {
      const { name } = choosedPayload;
      const configName = config && config.name;
      const {
        PayLoadName,
        PayLoadCode,
        InsName,
        InsCode,
        widgetType,
        ByteName,
        ByteStart,
        ByteEnd,
        action,
        removedPayLoads,
        removedInses,
        removedBytes
      } = values;

      if (action === "add") {
        // 如果增加的是负载
        if (PayLoadName) {
          const action = { type: "add" };
          action.data = {
            PayLoadName,
            PayLoadCode
          };
          changeXMLObj(null, null, action);
        }
        // 如果增加的是指令
        else if (InsName) {
          const action = { type: "add" };
          action.data = {
            InsName,
            InsCode
          };
          changeXMLObj(name, null, action);
        }
        // 如果增加的是指令下的配置
        else if (widgetType && ByteName) {
          const { Option, Range } = values;
          const action = {
            type: "add",
            data: { ByteName, widgetType, ByteStart, ByteEnd }
          };
          if (widgetType === "Option") {
            action.data.children = { Option };
          } else if (widgetType === "Range") {
            Range.Precision = String(10 ** -Range.Precision);
            Range.Unit = Range.Unit === undefined ? "" : Range.Unit;
            action.data.children = { ...Range };
          }
          changeXMLObj(name, configName, action);
        }
      } else if (action === "remove") {
        const action = { type: "remove" };
        if (removedPayLoads) {
          action.data = { removedPayLoads };
          changeXMLObj(null, null, action);
        } else if (removedInses) {
          action.data = { removedInses };
          changeXMLObj(name, null, action);
        } else if (removedBytes) {
          action.data = { removedBytes };
          changeXMLObj(name, configName, action);
        }
      }
      setEditType();
      setHaveEditPayload(true);
      forceUpdateParent();
      editForm.resetFields();
    };
    const handleCancel = () => {
      editForm.resetFields();
      setEditType();
    };

    let title;
    let head = null;
    let content;
    if (editType === "PayLoad") {
      title = "编辑负载";
      head = (
        <Item
          label="选择操作"
          name="action"
          rules={[{ required: true, message: "请选择一个操作" }]}
        >
          <Select>
            {payloads ? (
              <>
                <Option value="add">新增</Option>
                <Option value="remove">删除</Option>
              </>
            ) : (
              <Option value="add">新增</Option>
            )}
          </Select>
        </Item>
      );
      content = (
        <Item shouldUpdate>
          {({ getFieldValue }) => {
            const action = getFieldValue("action");

            if (action === "add")
              return (
                <>
                  <Item
                    label="负载名称"
                    name="PayLoadName"
                    rules={[
                      { required: true, message: "此处必填", whitespace: true },
                      {
                        validator(rule, value) {
                          if (
                            (payloads &&
                              payloads.find(({ name }) => name === value)) ||
                            (name && name === value)
                          )
                            return Promise.reject("名称发生重复");
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <Input />
                  </Item>
                  <Item
                    name="PayLoadCode"
                    label="负载编号"
                    extra="请输入在0-255之间的整数"
                    rules={[
                      { required: true, message: "此处必填" },
                      {
                        validator(rule, value) {
                          const tip = "已有该编号的负载";
                          if (payloads) {
                            return payloads.find(
                              ({ code }) => parseInt(code, 16) === value
                            )
                              ? Promise.reject(tip)
                              : Promise.resolve();
                          } else {
                            return parseInt(code, 16) === value
                              ? Promise.reject(tip)
                              : Promise.resolve();
                          }
                        }
                      }
                    ]}
                  >
                    <InputNumber min={0} max={255} />
                  </Item>
                </>
              );
            else if (action === "remove") {
              return (
                <Item
                  name="removedPayLoads"
                  label="选择你要删除的负载"
                  rules={[
                    { required: true, message: "至少选择一个" },
                    {
                      validator(rule, value) {
                        if (value && value.length === payloads.length)
                          return Promise.reject("不可全部删除");
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Checkbox.Group
                    options={payloads && payloads.map(({ name }) => name)}
                  />
                </Item>
              );
            }
          }}
        </Item>
      );
    } else if (editType === "Ins") {
      title = "编辑指令";
      head = (
        <>
          <Item label="负载名称">{choosedPayload.name}</Item>
          <Item
            label="选择操作"
            name="action"
            rules={[{ required: true, message: "请选择一个操作" }]}
          >
            <Select>
              {choosedPayload.configs.length > 0 ? (
                <>
                  <Option value="add">新增</Option>
                  <Option value="remove">删除</Option>
                </>
              ) : (
                <Option value="add">新增</Option>
              )}
            </Select>
          </Item>
        </>
      );
      content = (
        <Item shouldUpdate>
          {({ getFieldValue }) => {
            const action = getFieldValue("action");

            if (action === "add")
              return (
                <>
                  <Item
                    label="指令名称"
                    name="InsName"
                    rules={[
                      { required: true, message: "此处必填", whitespace: true },
                      {
                        validator(rule, value) {
                          if (
                            configs &&
                            configs.find(({ name }) => name === value)
                          )
                            return Promise.reject("名称发生重复");
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <Input />
                  </Item>
                  <Item
                    name="InsCode"
                    label="指令编号"
                    extra="请输入在0-255之间的整数"
                    rules={[
                      { required: true, message: "此处必填" },
                      {
                        validator(rule, value) {
                          const tip = "已有该编号的指令";
                          const { configs = [] } = choosedPayload;

                          return configs.find(
                            ({ code }) => parseInt(code, 16) === value
                          )
                            ? Promise.reject(tip)
                            : Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <InputNumber min={0} max={255} />
                  </Item>
                </>
              );
            else if (action === "remove") {
              return (
                <Item
                  name="removedInses"
                  label="选择你要删除的指令"
                  rules={[{ required: true, message: "至少选择一个" }]}
                >
                  <Checkbox.Group
                    options={choosedPayload.configs.map(({ name }) => name)}
                  />
                </Item>
              );
            }
          }}
        </Item>
      );
    } else if (editType === "Byte") {
      title = "编辑当前指令下的行为";
      head = (
        <>
          <Item label="指令名称">{config.name}</Item>
          <Item
            label="选择操作"
            name="action"
            rules={[{ required: true, message: "请选择一个操作" }]}
          >
            <Select>
              {config.componentTypes.length > 0 ? (
                <>
                  <Option value="add">新增</Option>
                  <Option value="remove">删除</Option>
                </>
              ) : (
                <Option value="add">新增</Option>
              )}
            </Select>
          </Item>
        </>
      );
      content = (
        <Item shouldUpdate>
          {({ getFieldValue, setFieldsValue }) => {
            const action = getFieldValue("action");

            if (action === "add") {
              const byteSpaceConfigure = () => {
                const type = getFieldValue("widgetType");
                let showByteControl = false;
                let component;

                switch (type) {
                  case "Option":
                    showByteControl = true;
                    component = (
                      <>
                        <Form.List name="Option">
                          {(fields, { add, remove }) => {
                            return (
                              <>
                                {fields &&
                                  fields.map((field) => (
                                    <Item key={field.key}>
                                      <Item
                                        {...field}
                                        rules={[
                                          {
                                            required: true,
                                            message: "此处必填",
                                            whitespace: true
                                          }
                                        ]}
                                        noStyle
                                      >
                                        <Input
                                          style={{ width: "60%" }}
                                          placeholder="输入Option控件可选项的名称"
                                        />
                                      </Item>
                                      {fields.length > 1 && (
                                        <MinusCircleOutlined
                                          style={{ margin: "0 8px" }}
                                          onClick={() => {
                                            remove(field.name);
                                          }}
                                        />
                                      )}
                                    </Item>
                                  ))}
                                <Item noStyle>
                                  <Button
                                    type="dashed"
                                    onClick={() => {
                                      add();
                                    }}
                                    style={{ width: "60%" }}
                                  >
                                    <PlusOutlined /> 增加
                                  </Button>
                                </Item>
                              </>
                            );
                          }}
                        </Form.List>
                      </>
                    );
                    break;
                  case "Range": {
                    const DataType = getFieldValue(["Range", "DataType"]);
                    if (DataType) showByteControl = true;

                    component = (
                      <>
                        <Item
                          label="数据类型"
                          name={["Range", "DataType"]}
                          rules={[{ required: true, message: "此处必填" }]}
                        >
                          <Select>
                            <Option value="INT16">INT16</Option>
                            <Option value="INT32">INT32</Option>
                          </Select>
                        </Item>
                        <Item label="精度" required>
                          10^(-
                          <Item
                            name={["Range", "Precision"]}
                            rules={[{ required: true, message: "此处必填" }]}
                            normalize={(val) => String(val)}
                            noStyle
                          >
                            <InputNumber min={0} max={12} />
                          </Item>
                          )
                        </Item>
                        <Item
                          label="最小值"
                          name={["Range", "limit_lower"]}
                          dependencies={[["Range", "limit_upper"]]}
                          rules={[
                            {
                              required: true,
                              message: "此处必填"
                            },
                            {
                              validator(rule, value) {
                                const max = getFieldValue([
                                  "Range",
                                  "limit_upper"
                                ]);
                                if (max === undefined || value <= max)
                                  return Promise.resolve();

                                return Promise.reject(
                                  "最小值应该小于或等于最大值！"
                                );
                              }
                            }
                          ]}
                          normalize={(val) => String(val)}
                        >
                          <InputNumber />
                        </Item>
                        <Item
                          label="最大值"
                          name={["Range", "limit_upper"]}
                          dependencies={[["Range", "limit_lower"]]}
                          rules={[
                            {
                              required: true,
                              message: "此处必填"
                            },
                            {
                              validator(rule, value) {
                                const min = getFieldValue([
                                  "Range",
                                  "limit_lower"
                                ]);
                                if (min === undefined || value >= min)
                                  return Promise.resolve();

                                return Promise.reject(
                                  "最大值应该大于或等于最小值！"
                                );
                              }
                            }
                          ]}
                          normalize={(val) => String(val)}
                        >
                          <InputNumber />
                        </Item>
                        <Item
                          label="单位"
                          name={["Range", "Unit"]}
                          rules={[{ whitespace: true }]}
                        >
                          <Input />
                        </Item>
                      </>
                    );
                  }
                }
                return (
                  <>
                    {component}
                    {showByteControl && (
                      <>
                        <Divider />
                        <Item
                          name="ByteStart"
                          label="数据写入起点"
                          extra="请输入0-15的整数"
                          rules={[
                            { required: true, message: "此处必填" },
                            {
                              validator(rule, value) {
                                const { componentTypes } = config;
                                let byteLength;

                                if (type === "Option") byteLength = 1;
                                else if (type === "Range") {
                                  byteLength =
                                    parseInt(
                                      getFieldValue([
                                        "Range",
                                        "DataType"
                                      ]).slice(3)
                                    ) / 8;
                                }

                                let ByteEnd = value
                                  ? value + byteLength - 1
                                  : "";

                                for (
                                  let i = 0;
                                  i < componentTypes.length;
                                  i++
                                ) {
                                  const {
                                    byteStart: cByteStart,
                                    byteEnd: cByteEnd
                                  } = componentTypes[i];
                                  if (
                                    !(
                                      (value < cByteStart &&
                                        ByteEnd < cByteStart) ||
                                      (value > cByteStart && ByteEnd > cByteEnd)
                                    )
                                  )
                                    return Promise.reject("空间已被占用");
                                }
                                return Promise.resolve();
                              }
                            }
                          ]}
                        >
                          <InputNumber
                            min={0}
                            max={15}
                            onChange={(v) => {
                              let byteLength;
                              if (type === "Option") byteLength = 1;
                              else if (type === "Range") {
                                byteLength =
                                  parseInt(
                                    getFieldValue(["Range", "DataType"]).slice(
                                      3
                                    )
                                  ) / 8;
                              }

                              setFieldsValue({
                                ByteEnd: v + byteLength - 1
                              });
                            }}
                          />
                        </Item>
                        <Item
                          name="ByteEnd"
                          label="数据写入终点"
                          rules={[
                            { required: true, message: "此处必填" },
                            {
                              validator(rule, value) {
                                if (value > 15)
                                  return Promise.reject("数据超过了空间边界");
                                return Promise.resolve();
                              }
                            }
                          ]}
                        >
                          <InputNumber disabled />
                        </Item>
                      </>
                    )}
                  </>
                );
              };
              return (
                <>
                  <Item
                    label="配置名称"
                    name="ByteName"
                    rules={[
                      {
                        required: true,
                        message: "此处必填",
                        whitespace: true
                      },
                      {
                        validator(rule, value) {
                          const { componentTypes } = config;
                          if (
                            componentTypes &&
                            componentTypes.find(({ name }) => name === value)
                          )
                            return Promise.reject("名称发生重复");
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <Input />
                  </Item>
                  <Item
                    label="控件类型"
                    name="widgetType"
                    rules={[{ required: true, message: "此处必填" }]}
                  >
                    <Select
                      onChange={() =>
                        editForm.resetFields([
                          "Option",
                          "Range",
                          "ByteStart",
                          "ByteEnd"
                        ])
                      }
                    >
                      <Option value="Option">Option</Option>
                      <Option value="Range">Range</Option>
                    </Select>
                  </Item>
                  <Divider />
                  {byteSpaceConfigure()}
                </>
              );
            } else if (action === "remove") {
              const { componentTypes } = config;
              const options = componentTypes.map(({ name }) => name);

              return (
                <Item
                  name="removedBytes"
                  label="选择你要删除的行为配置"
                  rules={[{ required: true, message: "至少选择一项" }]}
                >
                  {options.length > 0 && <Checkbox.Group options={options} />}
                </Item>
              );
            }
          }}
        </Item>
      );
    }

    return (
      <Modal
        title={title}
        visible={shouldShow}
        maskClosable={false}
        footer={null}
        onCancel={handleCancel}
      >
        <Form
          form={editForm}
          initialValues={{ Option: [""] }}
          size="middle"
          layout="vertical"
          onFinish={handleFinish}
        >
          {head}
          {content}
          <Item>
            <Button type="primary" htmlType="submit">
              确定
            </Button>
          </Item>
        </Form>
      </Modal>
    );
  }, [
    editForm,
    editType,
    changeXMLObj,
    choosedPayload,
    config,
    configs,
    name,
    code,
    payloads,
    forceUpdateParent
  ]);

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
      return fieldsValue
        ? Object.entries(fieldsValue).map(([insKey, insValue], idx) => {
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
        : null;
    }
    const fieldsValue = getFieldsValueRef.current();
    if (!fieldsValue || Object.keys(fieldsValue).length === 0) return;

    const haveRoot = !!payloads;
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
  }, [name, drawerPayloadName, drawerVisible, payloads]);

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
              setHaveEditPayload(false);
              changeFileObj({ filePath: result, configPath: undefined });
            });
          } else {
            setIsSaving(false);
          }
        });
      } else {
        saveXML(filePath, values).then(() => {
          setIsSaving(false);
          setHaveEditPayload(false);
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
    () => ({
      needSave: () => form.isFieldsTouched() || haveEditPayload,
      isDeleted: deleted
    }),
    [deleted, form, haveEditPayload]
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

      forceUpdateParent();
      let newPayload;
      configs
        ? (newPayload = { name, code, configs })
        : choosedPayload
        ? (newPayload = payloads.find(
            ({ name }) => name === choosedPayload.name
          ))
        : (newPayload = payloads[0]);

      setChoosedPayload(newPayload);

      if (config && config.name) {
        const tConfig = newPayload.configs.find(
          (tConfig) => tConfig.name === config.name
        );
        setConfig(tConfig);
      }
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
        <Button
          style={{
            marginLeft: "5px",
            overflowX: "hidden",
            textOverflow: "ellipsis"
          }}
          onClick={() => setEditType("PayLoad")}
        >
          编辑负载
        </Button>
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
              const disabled = !haveEditPayload && !canSaveRef.current();
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
                  {canSaveRef.current() && (
                    <Col span={4}>
                      <Button
                        block
                        style={{
                          overflowX: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() => {
                          form.resetFields();
                          forceUpdateParent();
                        }}
                      >
                        撤消所有值的更改
                      </Button>
                    </Col>
                  )}
                </>
              );
            }}
          </Item>
        )}
      </Row>
      <Item label={"指令名称"} wrapperCol={24}>
        <Row gutter={16}>
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
          <Col span={3}>
            <Button
              block
              style={{ overflowX: "hidden", textOverflow: "ellipsis" }}
              onClick={() => setEditType("Ins")}
            >
              编辑指令
            </Button>
          </Col>
          {config && (
            <Col span={4}>
              <Button
                block
                style={{ overflowX: "hidden", textOverflow: "ellipsis" }}
                onClick={() => setEditType("Byte")}
              >
                编辑当前指令下的行为
              </Button>
            </Col>
          )}
        </Row>
      </Item>
      <Divider style={{ backgroundColor: "#0000002f", flexShrink: "0" }} />
      {configure}
      {editModal}
      {(configs || payloads) && showFormInfo}
    </Form>
  ) : (
    <Spin size="large" />
  );
});
