import { Field, Forms } from "./mappings";
import {
  AddressCategories,
  AddressTags,
  AssetTypes,
  CapitalGainsMethods,
  EventSources,
  EventTags,
} from "./enums";

export { Field, Forms };
export {
  AddressCategories,
  AddressTags,
  AssetTypes,
  CapitalGainsMethods,
  EventSources,
  EventTags,
};

export type DateString = string; // eg "2020-02-27" aka TimestampString.split("T")[0] 
export type DecimalString = string; // eg "-3.1415"
export type HexString = string; // eg "0xabc123"
export type TimestampString = string; // eg "2020-02-27T09:51:30.444Z" (ISO 8601 format)
export type Address = HexString | null;

export type Checkpoint = {
  account: Address;
  assetType: AssetTypes;
}

export type AssetChunk = {
  dateRecieved: TimestampString;
  purchasePrice: DecimalString; /* units of assetType per unit of account (USD/DAI) */
  quantity: DecimalString;
};

export type State = {
  [account: string]: {
    [assetType: string /* AssetTypes */]: Array<AssetChunk>;
  };
}

export type Event = {
  date: TimestampString;
  description: string;
  hash?: HexString;
  prices: { [assetType: string]: DecimalString };
  sources: EventSources[];
  tags: EventTags[];
  transfers: Transfer[];
}

export type Transfer = {
  assetType: AssetTypes;
  index?: number;
  quantity: DecimalString;
  fee?: DecimalString;
  from: HexString;
  to: HexString;
}

export type Log = F8949Log | any;

// aka row of f8949
export type F8949Log = {
  type: "f8949";
  Adjustment: string;
  Code: string;
  Cost: string;
  DateAcquired: string;
  DateSold: string;
  Description: string;
  GainOrLoss: string;
  Proceeds: string;
}

////////////////////////////////////////
// Helpers & Source Data

export interface AddressBook {
  addresses: Array<{
    address: HexString;
    category: AddressCategories;
    name; string;
    tags: string[];
  }>;
  getName(address: Address): string;
  isCategory(address: Address, category: string): boolean;
  isTagged(address: Address, tag: string): boolean;
  isSelf(address: Address): boolean;
  shouldIgnore(address: Address): boolean;
  pretty(address: Address): string;
}

export type PriceData = {
  ids: { [assetType: string]: string };
  [date: string]: {
    [assetType: string]: DecimalString;
  };
}

// format of chain-data.json
export type ChainData = {
  addresses: { [address: string]: DateString /* Date last updated */ };
  lastUpdated: TimestampString;
  transactions: { [txHash: string]: TransactionData };
  calls: CallData[]; // We can have multiple calls per txHash
};

// TODO use Partial<> type instead of making some props optional
export type TransactionData = {
  block: number;
  data: HexString;
  from: HexString;
  gasLimit: HexString;
  gasPrice: HexString;
  gasUsed?: HexString;
  hash: HexString;
  index?: number;
  logs?: Array<{
    address: HexString;
    data: HexString;
    index: number;
    topics: Array<HexString>;
  }>;
  nonce: number;
  status?: number | undefined;
  timestamp: TimestampString;
  to: HexString | null;
  value: DecimalString;
};

export type CallData = {
  block: number;
  contractAddress: HexString; // AddressZero if ETH
  from: HexString;
  hash: HexString;
  timestamp: TimestampString;
  to: HexString;
  value: DecimalString;
};

export type InputData = {
  addressBook?: Array<{
    address: HexString;
    category: AddressCategories;
    name; string;
    tags: string[];
  }>;
  env: Partial<Env>;
  events: Array<Event | string>;
  formData: Forms;
  forms: string[];
}

export type Env = {
  capitalGainsMethod: CapitalGainsMethods;
  etherscanKey: string;
  logLevel: number;
  mode: string;
  outputFolder: string;
  taxYear: string;
}

export type FinancialData = {
  expenses: Array<Log>;
  income: Array<Log>;
  trades: Array<Log>;
}
