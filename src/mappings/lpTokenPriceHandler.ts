import { zipWith } from 'lodash';
import { u32 } from '@polkadot/types';
import { divDecs } from './util';

const relayAssetId = (api.consts.crowdloans.relayCurrency as u32).toNumber();
const nativeAssetId = api?.consts?.currencyAdapter?.getNativeCurrencyId?.toString();

export const getLpTokens = async () => {
  const metadatas = await api.query.assets.metadata.entries();
  const allAssets = [
    ...metadatas.map(([{ args }, metadata]) => {
      const [assetId] = args;
      const { symbol, decimals } = metadata;
      return {
        assetId: assetId.toNumber(),
        symbol: symbol.toHuman().toString(),
        decimals: decimals.toNumber()
      };
    }),
    {
      assetId: api?.consts?.currencyAdapter?.getNativeCurrencyId?.toString(),
      symbol: nativeAssetId === '0' ? 'HKO' : 'PARA' // hard code, cuz rpc is not available in subquery
    }
  ];

  const lpTokens = allAssets?.filter(asset => asset.symbol.startsWith('LP-')) || [];
  const lpTokenMappings = lpTokens
    .map(token => {
      const symbols = token.symbol.replace('LP-', '').split(/\/(.*)/s);
      const assets = symbols.map(symbol => allAssets.find(asset => asset.symbol === symbol));
      const relayAsset = assets.find(asset => asset?.assetId === relayAssetId);
      const otherAsset = assets.find(asset => asset?.assetId !== relayAssetId);
      return (
        relayAsset &&
        otherAsset && {
          token,
          relayAsset,
          otherAsset
        }
      );
    })
    .filter(Boolean);

  if (lpTokenMappings.length > 0) {
    const lpTokenDetails = await api.query.assets.asset.multi(
      lpTokenMappings.map(mapping => mapping.token.assetId)
    );

    const lpTokenPools = await api.query.amm.pools.multi(
      lpTokenMappings.map(mapping => [mapping.relayAsset.assetId, mapping.otherAsset.assetId])
    );

    const lpTokenPoolsReverse = await api.query.amm.pools.multi(
      lpTokenMappings.map(mapping => [mapping.otherAsset.assetId, mapping.relayAsset.assetId])
    );

    const infos = zipWith(
      lpTokenMappings,
      lpTokenDetails,
      lpTokenPools,
      lpTokenPoolsReverse,
      ({ token, relayAsset, otherAsset }, tokenDetail, tokenPool, reverseTokenPool) => {
        const supply = tokenDetail?.isSome ? tokenDetail.unwrap().supply : undefined;
        const definedPool = [tokenPool, reverseTokenPool].find(p => p?.isSome);
        const amount =
          definedPool &&
          (parseInt(relayAsset.assetId, 10) > parseInt(otherAsset.assetId, 10)
            ? definedPool.unwrap().baseAmount
            : definedPool.unwrap().quoteAmount);
        return (
          supply &&
          amount && {
            id: token.assetId,
            supply: divDecs(supply, token.decimals),
            baseAssetAmount: divDecs(amount, relayAsset.decimals)
          }
        );
      }
    ).filter(Boolean) as {
      id: number;
      supply: number;
      baseAssetAmount: number;
    }[];

    return infos;
  } else {
    return [];
  }
};
