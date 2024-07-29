import {copyFile, mkdir, readdir, stat} from "fs/promises";
import {join} from "path";

import {exists} from "../src/util/exists.js";

export default async function mergeDirectoryContents(
  srcDirPath: string,
  destDirPath: string,
): Promise<void> {
  if (!(await exists(destDirPath))) {
    await mkdir(destDirPath);
  }
  for (const child of await readdir(srcDirPath)) {
    const srcChildPath = join(srcDirPath, child);
    const destChildPath = join(destDirPath, child);
    if ((await stat(srcChildPath)).isDirectory()) {
      await mergeDirectoryContents(srcChildPath, destChildPath);
    } else {
      await copyFile(srcChildPath, destChildPath);
    }
  }
}
