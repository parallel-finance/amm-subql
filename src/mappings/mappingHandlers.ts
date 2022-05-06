import { SubstrateEvent, SubstrateBlock } from '@subql/types';
import { u128 } from '@polkadot/types';
import { BN_QUINTILL, BN } from '@polkadot/util';
import { AssetValue, LiquidityPool, Pool } from '../types';
import {
  handleAddLiquidity,
  handleCreatePool,
  handleRmoveLiquidity,
  handleSwapTrade
} from './ammHandler';
import { bigIntStr, handlePolicy } from './util';
import { getLpTokens } from './lpTokenPriceHandler';
import BigNumber from 'bignumber.js';

const relayAssetId = api.consts.crowdloans.relayCurrency.toString();
const liquidStakingAssetId = api.consts.liquidStaking.liquidCurrency.toString();

async function handlePool(pkeys: string[][], blockNumber: number, timestamp: Date) {
  try {
    let kps = [];
    let poolQueries = [];
    pkeys.map(kp => {
      kps.push(kp);
      poolQueries.push(api.query.amm.pools(...kp));
    });
    const poolRes = await Promise.all(poolQueries);

    for (let ind in poolRes) {
      const kp = kps[ind];
      const {
        baseAmount,
        quoteAmount,
        baseAmountLast,
        quoteAmountLast,
        lpTokenId,
        blockTimestampLast,
        price0CumulativeLast,
        price1CumulativeLast
      } = poolRes[ind].toJSON();

      const t = new Date(timestamp).valueOf() / 1000;
      const lpid = `${lpTokenId}-${blockNumber}-${t}`;
      const pool = await Pool.get(lpTokenId);
      if (!pool) {
        await Pool.create({
          id: `${lpTokenId}`,
          blockHeight: blockNumber,
          trader: '',
          baseTokenId: kp[0],
          quoteTokenId: kp[1],
          timestamp
        }).save();
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
        timestamp
      });
      logger.debug(`dump new pool info at[${blockNumber}] pool[${lpTokenId}]`);
      await record.save();
    }
  } catch (e: any) {
    logger.error(`handle pool info error: ${e.message}`);
  }
}

async function handleValue(valueKeys: [string, string][], blockNumber: number) {
  try {
    // wrap api query
    const valueRes = await api.query.oracle.rawValues.multi(valueKeys);
    const lpTokens = await getLpTokens();
    const lpTokenAssetIds = lpTokens.map(i => i.id.toString());
    const excludeAssets = [...lpTokenAssetIds, liquidStakingAssetId];

    // group by assetId
    let groups = {};
    for (let index in valueKeys) {
      const assetId = valueKeys[index][1];
      if (!excludeAssets.includes(assetId)) {
        groups[assetId] = groups[assetId] || [];
        groups[assetId].push(valueRes[index]);
      }
    }

    for (let assetId of Object.keys(groups)) {
      // sort by value
      groups[assetId].sort((a, b) => {
        const ja = a.toJSON();
        const jb = b.toJSON();
        const n = Number(BigInt(ja.value) - BigInt(jb.value));
        return n;
      });
      const grp = groups[assetId];
      const len = grp.length;
      const isEven = len % 2 === 0;
      let data: { value: string; timestamp: number };
      // handle middle
      if (isEven) {
        const ind = Math.floor(len / 2);
        const it1 = JSON.parse(grp[ind]);
        const it2 = JSON.parse(grp[ind - 1]);
        //
        data = {
          value: ((BigInt(it1.value) + BigInt(it2.value)) / BigInt(2)).toString(),
          timestamp: it1.timestamp
        };
      } else {
        const { value, timestamp } = JSON.parse(grp[Math.floor(len / 2)]);
        data = {
          value: BigInt(value).toString(),
          timestamp
        };
      }

      const record = AssetValue.create({
        id: `${blockNumber}-${assetId}`,
        blockHeight: blockNumber,
        assetId: Number(assetId),
        value: data.value,
        blockTimevalue: Math.floor(data.timestamp / 1000).toString()
      });
      logger.info(
        `dump new asset value at[${blockNumber}] assetId[${assetId}] value[${data.value}]`
      );
      await record.save();

      if (relayAssetId === assetId) {
        // add LP token price

        lpTokens.forEach(async lp => {
          const value = new BigNumber(lp.baseAssetAmount)
            .times(data.value)
            .times(2)
            .dividedBy(lp.supply)
            .toFixed(0);

          logger.info(
            `dump lpToken asset value at[${blockNumber}] assetId[${assetId}] value[${data.value}]`
          );

          const record = AssetValue.create({
            id: `${blockNumber}-${lp.id}`,
            blockHeight: blockNumber,
            assetId: Number(lp.id),
            value,
            blockTimevalue: Math.floor(data.timestamp / 1000).toString()
          });
          await record.save();
        });

        // add sKSM price
        const liquidStakingExchangeRate = (await api.query.liquidStaking.exchangeRate()) as u128;
        const liquidRecord = AssetValue.create({
          id: `${blockNumber}-${liquidStakingAssetId}`,
          blockHeight: blockNumber,
          assetId: Number(liquidStakingAssetId),
          value: liquidStakingExchangeRate.div(BN_QUINTILL).mul(new BN(data.value)).toString(),
          blockTimevalue: Math.floor(data.timestamp / 1000).toString()
        });

        logger.info(
          `dump liquidStaking asset value at[${blockNumber}] assetId[${liquidStakingAssetId}] value[${data.value}]`
        );
        await liquidRecord.save();
      }
    }
  } catch (e: any) {
    logger.error(`handle asset value polling error: ${e.message} ${e.name}`);
  }
}

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  try {
    const blockNumber = block.block.header.number.toNumber();
    const timestamp = block.timestamp;
    if (!handlePolicy(timestamp)) {
      return;
    }
    logger.info(`start to handle block[${blockNumber}]: ${timestamp}`);
    const [poolKeys, valueKeys] = await Promise.all([
      api.query.amm.pools.keys(),
      api.query.oracle.rawValues.keys()
    ]);

    await Promise.all([
      handlePool(
        poolKeys.map(({ args: [v1, v2] }) => [v1.toString(), v2.toString()]),
        blockNumber,
        timestamp
      ),
      handleValue(
        valueKeys.map(({ args: [v1, v2] }) => [v1.toString(), v2.toString()]),
        blockNumber
      )
    ]);
  } catch (e: any) {
    logger.error(`block error: %o`, e.message);
  }
}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
  const {
    event: { data }
  } = event;
  const method = event.event.method;
  const jsdata = JSON.parse(data.toString());
  const ext = event.extrinsic.extrinsic;
  const hash = ext.hash.toString();
  const block = event.block.block.header.number.toNumber();
  const timestamp = event.block.timestamp;
  const handleOptions = { data: jsdata, block, timestamp, hash };

  logger.info(`start to handle event[${method}]`);
  switch (method) {
    case 'LiquidityAdded':
      await handleAddLiquidity(handleOptions);
      break;
    case 'LiquidityRemoved':
      await handleRmoveLiquidity(handleOptions);
      break;
    case 'PoolCreated':
      await handleCreatePool(handleOptions);
      break;
    case 'Traded':
      await handleSwapTrade(handleOptions);
      break;
    default:
      logger.error(`unknow event[${method}] to handle`);
  }
}
