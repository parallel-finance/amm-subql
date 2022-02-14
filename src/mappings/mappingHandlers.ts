import {SubstrateExtrinsic,SubstrateEvent,SubstrateBlock} from "@subql/types";
import {Balance} from "@polkadot/types/interfaces";
import { LiquidityPool, Token, TokenSwap } from "../types";
import { LiquidityDeposit } from "../types/models/LiquidityDeposit";
import { LiquidityWithdrawal } from "../types/models/LiquidityWithdrawal";
import { v4 as uuid } from 'uuid';



// Token:Create
export const handleTokenCreate = async (event: SubstrateEvent) => {
    const { event: { data: [assetId] } } = event;
    const token = new Token(uuid());
    token.tokenId = assetId.toString();
    token.save()
}

// Token:SetMeta
export const handleTokenMeta = async (event: SubstrateEvent) => {
    const { event: { data: [assetId, name, symbol, decimals, isFrozen ] }} = event; 
    const [token] = await Token.getByTokenId(assetId.toString());
    token.name = name.toString();
    token.symbol = symbol.toString();
    token.decimals = Number.parseInt(decimals.toString()) ;
    token.isFrozen = isFrozen.toString() === '1';
    await token.save()
} 


// Pool:Create
export const handlePoolCreate = async (event: SubstrateEvent) => {
    const { event: { data: [sender, tokenBase, tokenQuote, tokenLP] } } = event;
    const pool = new LiquidityPool(uuid());
    pool.created = new Date()
    const [base] = await Token.getByTokenId(tokenBase.toString())
    const [quote] = await Token.getByTokenId(tokenQuote.toString()) 
    const [lp] = await Token.getByTokenId(tokenLP.toString())
    pool.baseTokenId = base.id
    pool.quoteTokenId = quote.id
    pool.poolTokenId = lp.id
    pool.baseTokenVolume = BigInt(0); 
    pool.quoteTokenVolume = BigInt(0); 
    await pool.save()
}


// Pool:AddLiquidity
// should have both quantities of token
// should have pool id / lp token id
export const handlePoolAddLiquidity = async (event: SubstrateEvent) => {
    const { event: { data: [sender, tokenBase, tokenQuote, tokenLP, quantityBase, quantityQuote] } } = event;
    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString())
    if (pool.baseTokenId === tokenBase.toString() && pool.quoteTokenId === tokenQuote.toString()) {

        const Deposit = new LiquidityDeposit(uuid());
        const qtyBase = (quantityBase as Balance).toBigInt();
        const qtyQuote = (quantityQuote as Balance).toBigInt();
        Deposit.account = sender.toString();
        Deposit.timestamp = new Date();
        Deposit.quantityBaseTokenProvided = qtyBase;
        Deposit.quantityQuoteTokenProvided = qtyQuote;
        Deposit.poolId = pool.id;
        pool.baseTokenVolume += qtyBase;
        pool.quoteTokenVolume += qtyQuote;
        await Deposit.save();
        await pool.save();
    } else {
        // log error when unmatched
    }
} 

// Pool:RemoveLiquidity
// shyould have the pool id / lptoken id
// should have both quantities of token
export const handlePoolRemoveLiquidity = async (event: SubstrateEvent) => {
    const { event: { data: [sender, tokenBase, tokenQuote, tokenLP, quantityBase, quantityQuote, quantityLP] } } = event;
    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString())
    if (pool.baseTokenId === tokenBase.toString() && pool.quoteTokenId === tokenQuote.toString()) {    
        const Withdrawal = new LiquidityWithdrawal(uuid());
        const qtyBase = (quantityBase as Balance).toBigInt();
        const qtyQuote = (quantityQuote as Balance).toBigInt();
        const qtyLP = (quantityLP as Balance).toBigInt();

        Withdrawal.account = sender.toString();
        Withdrawal.timestamp = new Date();
        Withdrawal.poolId = pool.id;
        Withdrawal.quantityBaseTokenReceived = qtyBase;
        Withdrawal.quantityQuoteTokenReceived = qtyQuote;
        Withdrawal.quantityLPTokenProvided = qtyLP;
        
        pool.baseTokenVolume -= qtyBase;
        pool.quoteTokenVolume -= qtyQuote;
        await Withdrawal.save();
        await pool.save();
    } else {
        // log error when unmatched
    }
}

// Swap
// should have pool asset id for this event
// should include the fees? 

export const handleAmmTrade = async (event: SubstrateEvent) => {
    const { event: { data: [sender, tokenBase, tokenQuote, tokenLP, quantityBase, quantityQuote, poolBalanceBase, poolBalanceQuote ] } } = event;
    const [pool] = await LiquidityPool.getByPoolTokenId(tokenLP.toString());
    if (pool.baseTokenId === tokenBase.toString() && pool.quoteTokenId === tokenQuote.toString()) {    
        const trade = new TokenSwap(uuid())
        const qtyBase = (quantityBase as Balance).toBigInt();
        const qtyQuote = (quantityQuote as Balance).toBigInt();
        const balanceBase = (poolBalanceBase as Balance).toBigInt();
        const balanceQuote = (poolBalanceQuote as Balance).toBigInt();
        trade.account = sender.toString()
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
}  


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


