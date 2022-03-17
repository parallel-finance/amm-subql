import {SubstrateEvent,SubstrateBlock} from "@subql/types";
import { handleAddLiquidity, handleCreatePool, handleRmoveLiquidity, handleSwapTrade } from './ammHandler'

export async function handleBlock(block: SubstrateBlock): Promise<void> {

}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const {event: {data}} = event;
    const method = event.event.method
    const jsdata = JSON.parse(data.toString())
    const ext = event.extrinsic.extrinsic
    const hash = ext.hash.toString()
    const block = event.block.block.header.number.toNumber()
    const timestamp = event.block.timestamp
    const handleOptions = {data: jsdata, block, timestamp, hash}

    logger.info(`start to handle event[${method}]`)
    switch(method) {
        case 'LiquidityAdded':
            await handleAddLiquidity(handleOptions)
            break
        case 'LiquidityRemoved':
            await handleRmoveLiquidity(handleOptions)
            break
        case 'PoolCreated':
            await handleCreatePool(handleOptions)
            break
        case 'Traded':
            await handleSwapTrade(handleOptions)
            break
        default:
            logger.error(`unknow event[${method}] to handle`)
    }
}

