import { SubstrateEvent, SubstrateBlock } from "@subql/types";
import { AssetValue, LiquidityPool, Pool } from "../types";
import { handleAddLiquidity, handleCreatePool, handleRmoveLiquidity, handleSwapTrade } from './ammHandler'
import { bigIntStr, parseId } from "./util";

export async function handleBlock(block: SubstrateBlock): Promise<void> {
    try {
        const start  = Date.now()
        const blockNumber = block.block.header.number.toNumber()
        const timestamp = block.timestamp
        const [pkeys, vkeys] = await Promise.all([
            api.query.amm.pools.keys(),
            api.query.oracle.rawValues.keys()
        ])
        logger.warn(`fetch keys time: ${Date.now()-start}`)

        for (let k of pkeys) {
            const kp = (k.toHuman() as string[]).map(s => parseId(s))
            const {
                baseAmount,
                quoteAmount,
                baseAmountLast,
                quoteAmountLast,
                lpTokenId,
                blockTimestampLast,
                price0CumulativeLast,
                price1CumulativeLast
            } = (await api.query.amm.pools(kp[0], kp[1])).toJSON() as any

            const t = (new Date(timestamp)).valueOf() / 1000
            const lpid = `${lpTokenId}-${blockNumber}-${t}`
            const pool = await Pool.get(lpTokenId)
            if (!pool) {
                await Pool.create({
                    id: `${lpTokenId}`,
                    blockHeight: blockNumber,
                    trader: '',
                    baseTokenId: kp[0],
                    quoteTokenId: kp[1],
                    timestamp
                }).save()
            }
            const record = LiquidityPool.create({
                id: lpid,
                blockHeight: blockNumber,
                poolId: lpTokenId,
                action: 'Polling',
                baseVolume: bigIntStr(baseAmount),
                quoteVolume: bigIntStr(quoteAmount),
                baseVolumeLast: bigIntStr(baseAmountLast),
                quoteVolumnLase: bigIntStr(quoteAmountLast),
                basePriceCumulativeLast: bigIntStr(price0CumulativeLast),
                quotePriceCumulativeLast: bigIntStr(price1CumulativeLast),
                blockTimestampLast,
                timestamp,
            })
            record.save()
        }
        logger.warn(`save pool time: ${Date.now()-start}`)
        logger.debug(`raw values key length ${pkeys.length}-${vkeys.length}`)
        for (let key of vkeys) {
            let [owner, assetId] = key.toHuman() as any[]
            assetId = parseId(assetId)
            const {
                value,
                timestamp
            } = (await api.query.oracle.rawValues(owner, assetId)).toJSON() as any

            AssetValue.create({
                id: `${blockNumber}-${owner}-${assetId}`,
                account: owner,
                assetId,
                value: bigIntStr(value),
                blockTimevalue: Math.floor(timestamp/1000).toString()
            }).save()
        }
        logger.warn(`handle timeout: ${Date.now()-start}`)
    } catch (e: any) {
        logger.error(`block error: %o`, e.message)
    }
}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const { event: { data } } = event;
    const method = event.event.method
    const jsdata = JSON.parse(data.toString())
    const ext = event.extrinsic.extrinsic
    const hash = ext.hash.toString()
    const block = event.block.block.header.number.toNumber()
    const timestamp = event.block.timestamp
    const handleOptions = { data: jsdata, block, timestamp, hash }

    logger.info(`start to handle event[${method}]`)
    switch (method) {
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

