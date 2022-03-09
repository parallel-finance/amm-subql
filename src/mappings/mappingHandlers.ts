import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from "@subql/types";
import { Balance } from "@polkadot/types/interfaces";
import { LiquidityPool, Token, TokenSwap } from "../types";
import { LiquidityDeposit } from "../types/models/LiquidityDeposit";
import { LiquidityWithdrawal } from "../types/models/LiquidityWithdrawal";
import * as uuid from "uuid";

// Token:Create
export const handleTokenCreate = async (event: SubstrateEvent) => {
  const {
    event: { method, data },
  } = event;
  const [assetId] = data;
  console.log("Token Created Event: ", method, " ", assetId);
  if (method === "Created" || method === "ForceCreated") {
    try {
      const token = new Token(assetId.toString());
      token.tokenId = assetId.toString();
      await token.save();
    } catch (e) {
      console.error("failed to create token: ", e);
    }
  }
};

export const NATIVE_TOKEN = {
  decimals: 12,
  name: "Heiko",
  symbol: "HKO",
  supply: BigInt("1000000000000000000000"),
  isFrozen: "false",
};

// Token:SetMeta
export const handleTokenMeta = async (event: SubstrateEvent) => {
  const {
    event: { data },
  } = event;
  const [assetId, name, symbol, decimals, isFrozen] = data;
  try {
    console.log("Token Meta Event: ", assetId);
    const [token] = await Token.getByTokenId(assetId.toString());
    token.name = name.toHuman() as string;
    token.symbol = symbol.toHuman() as string;
    token.decimals = Number.parseInt(decimals.toString());
    token.isFrozen = isFrozen.toString() === "true";
    await token.save();
  } catch (e) {
    let foo = JSON.stringify(e, undefined, 2);
    console.error("failed to add meta: ", foo);
  }
};
const createNativeToken = async () => {
  const nativeToken = new Token("0");
  nativeToken.tokenId = "0";
  nativeToken.decimals = NATIVE_TOKEN.decimals;
  nativeToken.symbol = NATIVE_TOKEN.symbol;
  nativeToken.name = NATIVE_TOKEN.name;
  nativeToken.supply = NATIVE_TOKEN.supply;
  nativeToken.isFrozen = NATIVE_TOKEN.isFrozen === "true";
  await nativeToken.save();
};

const fetchToken = async (id) => {
  const [token] = await Token.getByTokenId(id);
  if (!token) {
    if (id === "0") {
      await createNativeToken();
      const [nativeToken] = await Token.getByTokenId(id);
      return nativeToken;
    } else {
      throw new Error("token not found: " + id);
    }
  }
  return token;
};
// Pool:Create
export const handlePoolCreate = async (event: SubstrateEvent) => {
  const {
    event: { data, method },
  } = event;

  const [sender, tokenBase, tokenQuote, tokenLP] = data;
  if (method === "PoolCreated") {
    try {
      console.log("Pool Created Event: ", tokenLP);
      const pool = new LiquidityPool(`999000${tokenLP.toString()}`);
      const base = await fetchToken(tokenBase.toString());
      const quote = await fetchToken(tokenQuote.toString());
      const lp = await fetchToken(tokenLP.toString());
      pool.baseTokenId = base.id;
      pool.quoteTokenId = quote.id;
      pool.poolTokenId = lp.id;
      pool.baseTokenVolume = BigInt(0);
      pool.quoteTokenVolume = BigInt(0);
      await pool.save();
    } catch (e) {
      console.error("failed to create pool: ", e);
    }
  }
};

// Pool:AddLiquidity
// should have both quantities of token
// should have pool id / lp token id
export const handlePoolAddLiquidity = async (event: SubstrateEvent) => {
  const {
    event: {
      data: [
        sender,
        tokenBase,
        tokenQuote,
        tokenLP,
        quantityBase,
        quantityQuote,
      ],
    },
  } = event;
  console.log("Pool Add Liquidity Event: ", tokenLP);
  try {
    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    if (
      pool.baseTokenId === tokenBase.toString() &&
      pool.quoteTokenId === tokenQuote.toString()
    ) {
      const deposit = new LiquidityDeposit(uuid.v4());
      const qtyBase = BigInt(quantityBase.toHuman() as string);
      const qtyQuote = BigInt(quantityQuote.toHuman() as string);
      deposit.account = sender.toString();
      deposit.timestamp = new Date();
      deposit.quantityBaseTokenProvided = qtyBase;
      deposit.quantityQuoteTokenProvided = qtyQuote;

      deposit.poolId = pool.id;
      pool.baseTokenVolume += qtyBase;
      pool.quoteTokenVolume += qtyQuote;
      await deposit.save();
      await pool.save();
    } else {
      // log error when unmatched
    }
  } catch (e) {}
};

// Pool:RemoveLiquidity
// shyould have the pool id / lptoken id
// should have both quantities of token
// should we include the new balances here as well?
export const handlePoolRemoveLiquidity = async (event: SubstrateEvent) => {
  const {
    event: {
      data: [
        sender,
        tokenBase,
        tokenQuote,
        tokenLP,
        quantityBase,
        quantityQuote,
        quantityLP,
      ],
    },
  } = event;
  try {
    console.log("Pool Remove Liquidity Event: ", tokenLP);

    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    if (
      pool.baseTokenId === tokenBase.toString() &&
      pool.quoteTokenId === tokenQuote.toString()
    ) {
      const withdrawal = new LiquidityWithdrawal(uuid.v4());
      const qtyBase = (quantityBase as Balance).toBigInt();
      const qtyQuote = (quantityQuote as Balance).toBigInt();
      const qtyLP = (quantityLP as Balance).toBigInt();

      withdrawal.account = sender.toString();
      withdrawal.timestamp = new Date();
      withdrawal.poolId = pool.id;
      withdrawal.quantityBaseTokenReceived = qtyBase;
      withdrawal.quantityQuoteTokenReceived = qtyQuote;
      withdrawal.quantityLPTokenProvided = qtyLP;

      pool.baseTokenVolume -= qtyBase;
      pool.quoteTokenVolume -= qtyQuote;
      await withdrawal.save();
      await pool.save();
    } else {
      // log error when unmatched
    }
  } catch (e) {}
};

// Swap
// should have pool asset id for this event
// should include the fees?

export const handleAmmTrade = async (event: SubstrateEvent) => {
  const {
    event: {
      data: [
        sender,
        tokenBase,
        tokenQuote,
        tokenLP,
        quantityBase,
        quantityQuote,
        poolBalanceBase,
        poolBalanceQuote,
      ],
    },
  } = event;
  console.log("AMM Trade Event: ", tokenLP);

  const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
  if (
    pool.baseTokenId === tokenBase.toString() &&
    pool.quoteTokenId === tokenQuote.toString()
  ) {
    const trade = new TokenSwap(uuid.v4());
    const qtyBase = (quantityBase as Balance).toBigInt();
    const qtyQuote = (quantityQuote as Balance).toBigInt();
    const balanceBase = (poolBalanceBase as Balance).toBigInt();
    const balanceQuote = (poolBalanceQuote as Balance).toBigInt();
    trade.account = sender.toString();
    trade.timestamp = new Date();
    trade.fromTokenId = tokenBase.toString();
    trade.toTokenId = tokenQuote.toString();
    trade.qtyFrom = qtyBase;
    trade.qtyTo = qtyQuote;
    trade.poolId = pool.id;

    pool.baseTokenVolume = balanceBase;
    pool.quoteTokenVolume = balanceQuote;
    await trade.save();
    await pool.save();
  } else {
    // log error when unmatched
  }
};

// // Add Liquidity
// - include both pool token balances?
// - include pool asset id to identify the pool added to

// // Remove Liquidity
// - include both pool token balances after?
// - include the pool asset id?
// - include both quantities of token removed (currently says 'liquidity')

// // Trade
// - include the pool asset id
// - include the fees amount ? I could pull this from a state object to track the current fees

// export async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
//     const record = await StarterEntity.get(extrinsic.block.block.header.hash.toString());
//     //Date type timestamp
//     record.field4 = extrinsic.block.timestamp;
//     //Boolean tyep
//     record.field5 = true;
//     await record.save();
// }
// GenerateDailyPoolTVL?

// Default Handlers

// Not handling any data by block
// export async function handleBlock(block: SubstrateBlock): Promise<void> {
//     //Create a new starterEntity with ID using block hash
//     let record = new StarterEntity(block.block.header.hash.toString());
//     //Record block number
//     record.field1 = block.block.header.number.toNumber();
//     await record.save();
// }

// export async function handleEvent(event: SubstrateEvent): Promise<void> {
//     const {event: {data: [account, balance]}} = event;
//     //Retrieve the record by its ID
//     const record = await StarterEntity.get(event.block.block.header.hash.toString());
//     record.field2 = account.toString();
//     //Big integer type Balance of a transfer event
//     record.field3 = (balance as Balance).toBigInt();
//     await record.save();
// }
