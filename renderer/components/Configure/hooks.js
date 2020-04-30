import { useEffect, useState, useMemo, useCallback } from "react";
import {
  readAndParseXML,
  saveObj2XML,
  generateBinFromBuffers,
  md5
} from "../../helpers";

const { watch: fsWatch } = require("fs");

const components = {
  Option: "Select",
  Range: "InputNumber"
};

export function useDealXML(filePath) {
  const [XMLObj, setXMLObj] = useState();
  const [deleted, setDeleted] = useState(false);
  const result = useMemo(() => {
    function parseDBItem(XMLObj, haveRoot) {
      let {
        $: { PayLoadName: name, PayLoadCode: code },
        Ins: configs
      } = XMLObj;
      let initialValues = {};

      configs = configs.map((config) => {
        const {
          $: { InsName, InsCode },
          Byte
        } = config;
        let result = {
          name: InsName,
          pathName: [name, InsName],
          code: InsCode
        };
        initialValues[InsName] = {};

        if (Byte) {
          let componentTypes = Byte;
          let code;
          componentTypes = componentTypes.map((componentType) => {
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
        const { DBItem, Ins } = XMLObj;

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
  const generateBin = useCallback(() => {
    const haveRoot = result.payloads ? true : false;
    function getCodeFromPayload(payload) {
      const { code: pCode, configs } = payload;

      const buffers = configs.map((config) => {
        const { code: cCode, componentTypes } = config;

        // 1byte PayLoadCode + 1byte InsCode + 16byte ByteData + 16Byte md5
        const buffer = new ArrayBuffer(34);
        const view = new DataView(buffer);
        const byteDataView = new Uint8Array(buffer, 2, 16);

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
        const md5Str = md5(Buffer.from(byteDataView));
        for (let i = 0; i < md5Str.length; i = i + 2) {
          let value = parseInt(md5Str.substr(i, 2), 16);
          view.setUint8(i / 2 + 18, value);
        }
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
    const watcher = fsWatch(
      filePath,
      { persistent: false },
      (eventType) => {
        if (eventType === "change") {
          read(filePath);
        } else if (eventType === "rename") {
          setDeleted(true);
        }
      }
    );

    return () => {
      watcher.close();
    };
  }, [filePath, read]);

  return { ...result, deleted, saveXML, generateBin };
}
