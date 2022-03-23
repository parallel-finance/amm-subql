import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from "@subql/types";
import { Balance } from "@polkadot/types/interfaces";
import { LiquidityPool, Token, TokenSwap } from "../types";
import { LiquidityDeposit } from "../types/models/LiquidityDeposit";
import { LiquidityWithdrawal } from "../types/models/LiquidityWithdrawal";
const { v4 } = require("uuid");

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
      const pool = new LiquidityPool(v4());
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
      //         sender: T::AccountId,
      //         base_currency_id: AssetIdOf<T, I>,
      //         quote_currency_id: AssetIdOf<T, I>,
      //         base_amount_added: BalanceOf<T, I>,
      //         quote_amount_added: BalanceOf<T, I>,
      //         lp_token_id: AssetIdOf<T, I>,
      //         new_base_amount: BalanceOf<T, I>,
      //         new_quote_amount: BalanceOf<T, I>,
      data: [
        sender,
        tokenBase,
        tokenQuote,
        quantityBase,
        quantityQuote,
        tokenLP,
        newBaseAmount,
        newQuoteAmount,
      ],
    },
  } = event;
  console.log("Pool Add Liquidity Event: ", tokenLP);
  try {
    const pooldata = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    const [pool] = pooldata;
    if (
      pool?.baseTokenId === tokenBase.toString() &&
      pool?.quoteTokenId === tokenQuote.toString()
    ) {
      const deposit = new LiquidityDeposit(v4());
      const qtyBase = BigInt(quantityBase.toString());
      const qtyQuote = BigInt(quantityQuote.toString());
      deposit.account = sender.toString();
      deposit.timestamp = new Date();
      deposit.quantityBaseTokenProvided = qtyBase;
      deposit.quantityQuoteTokenProvided = qtyQuote;

      deposit.poolId = pool.id;
      pool.baseTokenVolume = BigInt(newBaseAmount.toString());
      pool.quoteTokenVolume = BigInt(newQuoteAmount.toString());
      await Promise.all([deposit.save(), pool.save()]);
    } else {
      console.error("didnt work::");
      // log error when unmatched
    }
  } catch (e) {
    console.error("failed:!:", e);
  }
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
        quantityLP,
        quantityBase,
        quantityQuote,
        tokenLP,
        newBaseAmount,
        newQuoteAmount,
      ],
    },
  } = event;
  try {
    console.log("Pool Remove Liquidity Event: ", tokenLP);

    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    if (
      pool?.baseTokenId === tokenBase.toString() &&
      pool?.quoteTokenId === tokenQuote.toString()
    ) {
      //         sender: T::AccountId,
      //         base_currency_id: AssetIdOf<T, I>,
      //         quote_currency_id: AssetIdOf<T, I>,
      //         liquidity: BalanceOf<T, I>,
      //         base_amount_removed: BalanceOf<T, I>,
      //         quote_amount_removed: BalanceOf<T, I>,
      //         lp_token_id: AssetIdOf<T, I>,
      //         new_base_amount: BalanceOf<T, I>,
      //         new_quote_amount: BalanceOf<T, I>,
      const withdrawal = new LiquidityWithdrawal(v4());
      const qtyBase = BigInt(quantityBase.toString());
      const qtyQuote = BigInt(quantityQuote.toString());
      const qtyLP = BigInt(quantityLP.toString());

      withdrawal.account = sender.toString();
      withdrawal.timestamp = new Date();
      withdrawal.poolId = pool.id;
      withdrawal.quantityBaseTokenReceived = qtyBase;
      withdrawal.quantityQuoteTokenReceived = qtyQuote;
      withdrawal.quantityLPTokenProvided = qtyLP;

      pool.baseTokenVolume = BigInt(newBaseAmount.toString());
      pool.quoteTokenVolume = BigInt(newQuoteAmount.toString());
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
        quantityBase,
        quantityQuote,
        tokenLP,
        newBaseAmount,
        newQuoteAmount,
      ],
    },
  } = event;
  console.log("AMM Trade Event: ", tokenLP);
  //         trader: T::AccountId,
  //         currency_id_in: AssetIdOf<T, I>,
  //         currency_id_out: AssetIdOf<T, I>,
  //         amount_in: BalanceOf<T, I>,
  //         amount_out: BalanceOf<T, I>,
  //         lp_token_id: AssetIdOf<T, I>,
  //         new_quote_amount: BalanceOf<T, I>,
  //         new_base_amount: BalanceOf<T, I>,
  try {
    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    if (
      (pool?.baseTokenId === tokenBase.toString() &&
        pool?.quoteTokenId === tokenQuote.toString()) ||
      (pool?.quoteTokenId === tokenBase.toString() &&
        pool?.baseTokenId === tokenQuote.toString())
    ) {
      const trade = new TokenSwap(v4());
      const qtyBase = BigInt(quantityBase.toString());
      const qtyQuote = BigInt(quantityQuote.toString());
      trade.account = sender.toString();
      trade.timestamp = new Date();
      trade.fromTokenId = tokenBase.toString();
      trade.toTokenId = tokenQuote.toString();
      trade.qtyFrom = qtyBase;
      trade.qtyTo = qtyQuote;
      trade.poolId = pool.id;

      pool.baseTokenVolume = BigInt(newBaseAmount.toString());
      pool.quoteTokenVolume = BigInt(newQuoteAmount.toString());
      await Promise.all([trade.save(), pool.save()]);
    } else {
      // log error when unmatched
    }
  } catch (e) {}
};

// #[pallet::generate_deposit(pub (crate) fn deposit_event)]
// pub enum Event<T: Config<I>, I: 'static = ()> {
//     /// Add liquidity into pool
//     LiquidityAdded {
//         sender: T::AccountId,
//         base_currency_id: AssetIdOf<T, I>,
//         quote_currency_id: AssetIdOf<T, I>,
//         base_amount_added: BalanceOf<T, I>,
//         quote_amount_added: BalanceOf<T, I>,
//         lp_token_id: AssetIdOf<T, I>,
//         new_base_amount: BalanceOf<T, I>,
//         new_quote_amount: BalanceOf<T, I>,
//     },
//     /// Remove liquidity from pool
//     LiquidityRemoved {
//         sender: T::AccountId,
//         base_currency_id: AssetIdOf<T, I>,
//         quote_currency_id: AssetIdOf<T, I>,
//         liquidity: BalanceOf<T, I>,
//         base_amount_removed: BalanceOf<T, I>,
//         quote_amount_removed: BalanceOf<T, I>,
//         lp_token_id: AssetIdOf<T, I>,
//         new_base_amount: BalanceOf<T, I>,
//         new_quote_amount: BalanceOf<T, I>,
//     },
//     /// A Pool has been created
//     PoolCreated {
//         trader: T::AccountId,
//         currency_id_in: AssetIdOf<T, I>,
//         currency_id_out: AssetIdOf<T, I>,
//         lp_token_id: AssetIdOf<T, I>,
//     },
//     /// Trade using liquidity
//     Traded {
//         trader: T::AccountId,
//         currency_id_in: AssetIdOf<T, I>,
//         currency_id_out: AssetIdOf<T, I>,
//         amount_in: BalanceOf<T, I>,
//         amount_out: BalanceOf<T, I>,
//         lp_token_id: AssetIdOf<T, I>,
//         new_quote_amount: BalanceOf<T, I>,
//         new_base_amount: BalanceOf<T, I>,
//     },
// }
