import { useEffect, useState, useMemo, useCallback } from "react";
import {
  readAndParseXML,
  saveObj2XML,
  generateBinFromBuffers,
  uInt8ToHexStr
} from "../../helpers";

const { watch: fsWatch } = require("fs");

const components = {
  Option: "Select",
  Range: "InputNumber"
};

export function useDealXML(filePath) {
  let [XMLObj, setXMLObj] = useState();
  const [deleted, setDeleted] = useState(false);
  const result = useMemo(() => {
    function parseDBItem(DBItem, haveRoot) {
      let {
        $: { PayLoadName: name, PayLoadCode: code },
        Ins: configs = []
      } = DBItem;
      let initialValues = {};

      configs = configs.map((config) => {
        const {
          $: { InsName, InsCode },
          Byte
        } = config;
        let result = {
          name: InsName,
          pathName: [name, InsName],
          code: InsCode,
          componentTypes: []
        };
        initialValues[InsName] = {};

        if (Byte) {
          let componentTypes = Byte;

          componentTypes = componentTypes.map((componentType) => {
            let code;
            let {
              $: { ByteName, Type, Value, ByteStart, ByteEnd },
              [Type]: children
            } = componentType;
            initialValues[InsName][ByteName] = Value;

            switch (Type) {
              case "Option":
                children = children.map(({ $: child }) => {
                  const { Sel, Val: value } = child;

                  if (value === Value) code = Sel;

                  return { key: value, value };
                });
                break;
              case "Range": {
                let {
                  Precision: precision,
                  Unit: unit,
                  limit_lower: min,
                  limit_upper: max
                } = children[0].$;

                if (Value) {
                  code = Math.ceil(Value / precision).toString(16);
                }

                const step = Number(precision);
                // 组件的精度=小数点后有多少个数字
                precision = precision.length - 1 - precision.indexOf(".");
                min = Number(min);
                max = Number(max);
                children = { precision, unit, min, max, step };
                break;
              }
              default:
            }
            return {
              name: ByteName,
              pathName: haveRoot
                ? [name, InsName, ByteName]
                : [InsName, ByteName],
              type: components[Type],
              children,
              byteStart: ByteStart,
              byteEnd: ByteEnd,
              code
            };
          });
          result.componentTypes = componentTypes;
        }
        return result;
      });

      return {
        name,
        code,
        configs,
        initialValues
      };
    }
    try {
      if (XMLObj) {
        const { DBItem, Ins = [] } = XMLObj;

        if (DBItem) {
          const results = DBItem.map((item) => parseDBItem(item, true));
          let initialValues = {};
          let payloads = [];

          for (let {
            name,
            code,
            initialValues: tInitialValues,
            configs
          } of results) {
            initialValues[name] = tInitialValues;
            payloads.push({ name, code, configs });
          }

          return {
            payloads,
            initialValues
          };
        } else if (Ins) {
          return parseDBItem(XMLObj);
        }
      }
      return {};
    } catch (e) {
      return {
        error: "你打开的XML文件格式存在问题，请打开符合规范的XML文件！"
      };
    }
  }, [XMLObj]);
  const saveXML = useCallback(
    (path, data, flag) => saveObj2XML(path, XMLObj, data, flag),
    [XMLObj]
  );
  const changeXMLObj = useCallback(
    (payloadName, insName, action) => {
      function dealByte(payload) {
        const { Ins } = payload;
        const instruction = Ins.find((tIns) => tIns.$.InsName === insName);
        const { type, data } = action;
        const {
          ByteName,
          widgetType,
          ByteStart,
          ByteEnd,
          children,
          removedBytes
        } = data;

        if (type === "add") {
          const { Option } = children;
          const doWithByte = () => {
            const newByte = {
              $: {
                ByteName,
                Type: widgetType,
                ByteStart,
                ByteEnd
              }
            };

            if (widgetType === "Option") {
              newByte.Option = Option.map((Val, idx) => {
                const hex = idx.toString(16);
                const Sel = hex.length === 1 ? `0x0${hex}` : `0x${hex}`;
                return { $: { Sel, Val } };
              });
            } else if (widgetType === "Range") {
              newByte.Range = [{ $: children }];
            }

            instruction.Byte.push(newByte);
          };

          if (instruction.Byte) {
            doWithByte();
          } else {
            instruction.Byte = [];
            doWithByte();
          }
        } else if (type === "remove") {
          instruction.Byte = instruction.Byte.filter(
            ({ $: { ByteName } }) =>
              removedBytes.find((name) => name === ByteName) === undefined
          );
        }
      }

      function dealIns(payload) {
        const { Ins } = payload;
        let {
          type,
          data: { InsName, InsCode, removedInses }
        } = action;

        InsCode = uInt8ToHexStr(InsCode);

        const insObj = { $: { InsName, InsCode } };
        if (type === "add") {
          if (Ins) {
            Ins.push(insObj);
          } else {
            payload.Ins = [insObj];
          }
        } else if (type === "remove") {
          payload.Ins = payload.Ins.filter(
            ({ $: { InsName } }) =>
              removedInses.find((name) => name === InsName) === undefined
          );
        }
      }

      function dealPayLoad(haveReturn) {
        const { type, data } = action;
        let { PayLoadName, PayLoadCode, removedPayLoads } = data;

        PayLoadCode = uInt8ToHexStr(PayLoadCode);
        if (type === "add") {
          if (haveReturn) {
            const newDBItem = {
              $: { PayLoadName, PayLoadCode }
            };
            let newXMLObj = { $: {}, DBItem: [XMLObj, newDBItem] };

            return newXMLObj;
          } else {
            const newDBItem = {
              $: { PayLoadName, PayLoadCode }
            };
            DBItem.push(newDBItem);
          }
        } else if (type === "remove") {
          XMLObj.DBItem = XMLObj.DBItem.filter(
            ({ $: { PayLoadName } }) =>
              removedPayLoads.find((name) => name === PayLoadName) === undefined
          );
          if (XMLObj.DBItem.length === 1) {
            XMLObj = XMLObj.DBItem[0];
          }
        }
      }

      const { DBItem, Ins = [] } = XMLObj;
      // 如果是多负载
      if (DBItem) {
        const payload = DBItem.find(
          (tPayload) => tPayload.$.PayLoadName === payloadName
        );
        if (insName) {
          dealByte(payload);
          setXMLObj({ ...XMLObj });
        } else if (payloadName) {
          dealIns(payload);
          setXMLObj({ ...XMLObj });
        } else {
          dealPayLoad();
          setXMLObj({ ...XMLObj });
        }
      }
      // 如果是单负载
      else if (Ins) {
        if (insName) {
          dealByte(XMLObj);
          setXMLObj({ ...XMLObj });
        } else if (payloadName) {
          dealIns(XMLObj);
          setXMLObj({ ...XMLObj });
        } else {
          setXMLObj(dealPayLoad(true));
        }
      }
    },
    [XMLObj]
  );
  const generateBin = useCallback(() => {
    const haveRoot = result.payloads ? true : false;
    function getCodeFromPayload(payload) {
      const { code: pCode, configs } = payload;

      const buffers = configs.map((config) => {
        const { code: cCode, componentTypes } = config;

        // 1byte PayLoadCode + 1byte InsCode + 16byte ByteData
        const buffer = new ArrayBuffer(18);
        const view = new DataView(buffer);

        view.setInt8(0, parseInt(pCode, 16));
        view.setInt8(1, parseInt(cCode, 16));

        componentTypes &&
          componentTypes.forEach(({ byteStart, byteEnd, code }) => {
            const pos = 2 + Number(byteStart);
            const len = 1 + (byteEnd - byteStart);
            const value = parseInt(code, 16);

            switch (len) {
              case 1:
                view.setInt8(pos, value);
                break;
              case 2:
                view.setInt16(pos, value);
                break;
              case 4:
                view.setInt32(pos, value);
                break;
              default:
            }
          });
        return buffer;
      });
      return buffers;
    }
    let buffers;

    if (haveRoot) {
      const { payloads } = result;
      buffers = payloads.map((payload) => getCodeFromPayload(payload)).flat();
    } else {
      buffers = getCodeFromPayload(result);
    }

    return generateBinFromBuffers(filePath, buffers);
  }, [result, filePath]);
  const read = useCallback((filePath) => {
    readAndParseXML(filePath)
      .then((results) => {
        setXMLObj(results);
      })
      .catch((err) => {
        console.warn(err);
      });
  }, []);

  useEffect(() => {
    if (filePath) {
      read(filePath);
    }
  }, [filePath, read]);

  useEffect(() => {
    const watcher = fsWatch(filePath, { persistent: false }, (eventType) => {
      if (eventType === "change") {
        read(filePath);
      } else if (eventType === "rename") {
        setDeleted(true);
      }
    });

    return () => {
      watcher.close();
    };
  }, [filePath, read]);

  return { ...result, deleted, saveXML, generateBin, changeXMLObj };
}
