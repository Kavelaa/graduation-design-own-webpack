// 用一个计数器来做key，以保证绝对唯一
let counter = 0;
export function FileObj(inputObj) {
  if (inputObj) {
    const { filePath, configPath } = inputObj;
    this.filePath = filePath;
    this.configPath = configPath;
  }
  this.key = String(counter);
  counter++;
  this.ref = { current: undefined };
}
