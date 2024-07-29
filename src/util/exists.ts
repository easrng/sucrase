import {access} from "fs/promises";

export const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );
