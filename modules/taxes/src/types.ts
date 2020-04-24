import {
  AddressBookJson,
  Event,
  enumify,
} from "@finances/types";

import { Field, Forms } from "./mappings";
export { Field, Forms };

export const Modes = enumify({
  example: "example",
  personal: "personal",
  test: "test",
});
export type Modes = (typeof Modes)[keyof typeof Modes];

export type Env = {
  etherscanKey: string;
  logLevel: number;
  mode: Modes;
  outputFolder: string;
  taxYear: string;
  username: string;
}

export type InputData = {
  addressBook?: AddressBookJson;
  env: Partial<Env>;
  events: Array<Event | string>;
  formData: Forms;
  forms: string[];
}