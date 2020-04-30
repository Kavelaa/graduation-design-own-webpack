import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";

const { readFileSync, writeFileSync } = require("fs");

const configJSONPath =
  process.env.NODE_ENV === "development"
    ? "./config.json"
    : "./resources/app/config.json";

const configProps = JSON.parse(readFileSync(configJSONPath, "utf8"));

ReactDOM.render(<App {...configProps} />, document.getElementById("root"));

export function changeConfig(config) {
  const fixedKeys = Object.keys(configProps);
  const newConfig = { ...configProps };

  for (let entries of Object.entries(config)) {
    const [key, value] = entries;
    if (fixedKeys.find((k) => k === key)) {
      newConfig[key] = value;
    }
  }
  Object.assign(configProps, newConfig);

  const newConfigJSON = JSON.stringify(newConfig);
  try {
    writeFileSync(configJSONPath, newConfigJSON);
  } catch {}
}
