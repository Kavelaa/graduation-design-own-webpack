import { MutableRefObject } from "react";

interface IFileObj {
  filePath?: string;
  configPath?: string;
  key: string;
  ref: MutableRefObject;
}
interface IInputObj {
  filePath?: string;
  configPath?: string;
}

function FileObj(obj: IInputObj | undefined): IFileObj;
