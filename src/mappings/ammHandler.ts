import { GenericEventData } from '@polkadot/types'
import { bigIntStr } from './util'

type LiquidityRemoved = {
    sender: string,
    base_currency_id: number,
    quote_currency_id: number,
    liquidity: string,
    base_amount_removed: string,
    quote_amount_removed: string,
    lp_token_id: number,
    new_base_amount: string,
    new_quote_amount: string
}

type LiquidityAdded = {
    sender: string,
    base_currency_id: number,
    quote_currency_id: number,
    base_amount_added: number,
    quote_amount_added: number,
    lp_token_id: number,
    new_base_amount: number,
    new_quote_amount: number
}

type Traded = {
    trader: string,
    currency_id_in: number,
    currency_id_out: number,
    amount_in: string,
    amount_out: string,
    lp_token_id: number,
    new_quote_amount: string,
    new_base_amount: string
}

type PoolCreated = {
    trader: string,
    currency_id_in: number,
    currency_id_out: number,
    lp_token_id: number
}

export type HandleOptions = {
    data: any[],
    block: number,
    hash: string,
    timestamp: string
}

export async function handleAddLiquidity(opt: HandleOptions) {
    const [
        sender,
        base_currency_id,
        quote_currency_id,
        base_amount_added,
        quote_amount_added,
        lp_token_id,
        new_base_amount,
        new_quote_amount
    ] = opt.data

}

export async function handleRmoveLiquidity(opt: HandleOptions) {
    
}

export async function handleCreatePool(opt: HandleOptions) {

}

export async function handleSwapTrade(opt: HandleOptions) {

}