import { MutableRefObject } from "react";

interface IFileObj {
  filePath?: string;
  fileTreePos?: string;
  configPath?: string;
  ref: MutableRefObject;
}
interface IInputObj {
  filePath?: string;
  fileTreePos?: string;
  configPath?: string;
}

function FileObj(obj: IInputObj | undefined): IFileObj;
