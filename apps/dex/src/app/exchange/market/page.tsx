"use client";

import {Suspense, useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    IconButton,
    VisuallyHidden,
} from '@chakra-ui/react';
import { LuTrendingUp, LuTrendingDown, LuActivity, LuArrowLeft, LuX, LuInfo } from 'react-icons/lu';
import {useNavigationWithParams} from "@/hooks/useNavigation";
import {
    useMarket, useAsset,
    amountToBigNumberUAmount, prettyAmount, priceToBigNumberUPrice, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, uPriceToPrice,
    getAddressFullMarketOrders, getMarketBuyOrders, getMarketHistory, getMarketSellOrders,
    ActiveOrders, ORDER_TYPE_BUY, ORDER_TYPE_SELL,
    HistoryOrder,
    getAddressHistory, getTradingViewIntervals,
    getChainName,
    formatUsdAmount, intlDateFormat,
    useBalance, useBZETx, useToast, useAssetPrice,
    calculateAmountFromPrice, calculatePricePerUnit, calculateTotalAmount, getMinAmount,
    TradeViewChart,
    CHART_1D, CHART_1Y, CHART_30D, CHART_4H, CHART_7D, getChartIntervalsLimit, getChartMinutes,
    useConnectionType, CONNECTION_TYPE_WS,
    blockchainEventManager, getMarketOrderBookChangedEvent,
    addDebounce, cancelDebounce,
    HighlightText,
    HgCard, hgVariant,
    FeeEstimateRow, useTradingFees, useMaxSpendable, useGasFeeEstimator, useFeeEstimate, useBalances, canAffordTx,
    HaltedBadge, HaltedNotice, useHaltedDenoms,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";
import {AggregatedOrderSDKType, HistoryOrderSDKType, OrderSDKType} from "@bze/bzejs/bze/tradebin/store";
import {bze} from "@bze/bzejs";
import BigNumber from "bignumber.js";
import {FillOrderItem} from "@bze/bzejs/bze/tradebin/tx";
import {LightweightChart} from "@/components/ui/trading/chart";
import {balanceToFormValue} from "@/lib/trading-form";
import {VenueTag} from "@/components/ui/trading/venue";
import {ChangePill, SideBadge} from "@/components/ui/trading/badges";
import {PairLogo} from "@/components/ui/trading/pair-logo";
import {
    BalanceButton, Cell, DataTable, depthPercent, EmptyState, EmptyTableRow, MarketStat, OrderBookRow, OrderField, OrderForm, Panel,
} from "@/components/ui/trading/market-parts";

const {createOrder, fillOrders} = bze.tradebin.MessageComposer.withTypeUrl;

function getOrderTxMessages(activeOrders: ActiveOrders, marketId: string, address: string, isBuy: boolean, uAmount: string, uPrice: string) {
    const orderType = isBuy ? 'buy' : 'sell';

    const uPriceNum = new BigNumber(uPrice);
    const ordersFilter = (order: AggregatedOrderSDKType) => {
        const orderuPriceNum = new BigNumber(order.price);
        if (isBuy) {
            return uPriceNum.gt(orderuPriceNum);
        } else {
            return uPriceNum.lt(orderuPriceNum);
        }
    }
    const ordersToSearch = isBuy ? activeOrders.sellOrders.filter(ordersFilter) : activeOrders.buyOrders.filter(ordersFilter);

    //if we have no opposite orders we can create 1 message
    if (ordersToSearch.length === 0) {
        return [
            createOrder({
                creator: address,
                marketId: marketId,
                orderType: orderType,
                amount: uAmount,
                price: uPrice,
            })
        ];
    }

    const msgs = [];
    let uAmountNum = new BigNumber(uAmount);
    //check active orders prices and fill them one by one if needed
    for (let i = 0; i < ordersToSearch.length; i++) {
        const orderUAmountNum = new BigNumber(ordersToSearch[i].amount);
        let msgAmount = ordersToSearch[i].amount;
        if (orderUAmountNum.gt(uAmountNum)) {
            msgAmount = uAmountNum.toString();
        }

        msgs.push(
            createOrder({
                creator: address,
                marketId: marketId,
                orderType: orderType,
                amount: msgAmount,
                price: ordersToSearch[i].price,
            })
        )

        uAmountNum = uAmountNum.minus(msgAmount);
        if (uAmountNum.eq(0)) {
            break;
        }
    }

    if (uAmountNum.gt(0)) {
        msgs.push(
            createOrder({
                creator: address,
                marketId: marketId,
                orderType: orderType,
                amount: uAmountNum.toString(),
                price: uPrice,
            })
        )
    }

    return msgs;
}

const TradingPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TradingPageContent />
        </Suspense>
    );
};

const TradingPageContent = () => {
    const [historyTab, setHistoryTab] = useState('market');
    const [timeframe, setTimeframe] = useState('1D');

    // Form state
    const [buyPrice, setBuyPrice] = useState('');
    const [buyAmount, setBuyAmount] = useState('');
    const [buyTotal, setBuyTotal] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [sellTotal, setSellTotal] = useState('');

    const [chartData, setChartData] = useState<TradeViewChart[]>();
    const [activeOrders, setActiveOrders] = useState<ActiveOrders>();
    const [myHistory, setMyHistory] = useState<HistoryOrder[]>([]);
    const [historyOrders, setHistoryOrders] = useState<HistoryOrderSDKType[]>([]);
    const [myOrders, setMyOrders] = useState<OrderSDKType[]>([]);
    const [submittingCancel, setSubmittingCancel] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);

    const {idParam, toExchangePage} = useNavigationWithParams();

    const {marketData, market, marketId} = useMarket(idParam ?? '')
    const {asset: baseAsset} = useAsset(market?.base ?? '')
    const {asset: quoteAsset} = useAsset(market?.quote ?? '')
    // A governance-halted market keeps its order book, history and "Your Orders" (cancel works);
    // only the buy/sell forms give way to the notice, since the chain refuses new orders.
    const {isDenomHalted, isMarketHalted} = useHaltedDenoms()
    const isHalted = isMarketHalted(market)
    const haltedTickers = [baseAsset, quoteAsset]
        .filter(asset => asset && isDenomHalted(asset.denom))
        .map(asset => asset!.ticker)
    const {address} = useChain(getChainName())
    const {balance: baseBalance} = useBalance(market?.base ?? '')
    const {balance: quoteBalance} = useBalance(market?.quote ?? '')
    const {totalUsdValue, hasPrice} = useAssetPrice(market?.quote ?? '')
    const {tx} = useBZETx()
    const {fees: tradingFees, isLoading: tradingFeesLoading} = useTradingFees()
    const {toast} = useToast()
    const {connectionType} = useConnectionType()
    // Shared gas engine: a balance click fills the spendable amount (gas kept back when the
    // clicked balance is the fee coin) and submitting checks amount + gas + trading fee in the
    // chain's charging order. The gas is estimated for the final shape (one MsgCreateOrder, or
    // one MsgFillOrders with N orders) right before sending.
    const baseSpendable = useMaxSpendable(market?.base ?? '', 'create-order')
    const quoteSpendable = useMaxSpendable(market?.quote ?? '', 'create-order')
    const {estimate: estimateGasFee} = useGasFeeEstimator()
    const {getBalanceByDenom} = useBalances()
    const orderGasFee = useMemo(() => estimateGasFee('create-order'), [estimateGasFee])
    const takerFeeEstimate = useFeeEstimate(tradingFees.takerFee, {gasFee: orderGasFee})
    const makerFeeEstimate = useFeeEstimate(tradingFees.makerFee, {gasFee: orderGasFee})

    const timeframes = [CHART_4H, CHART_1D, CHART_7D, CHART_30D, CHART_1Y];

    const lastPrice = useMemo(() => {
        if (marketData && marketData.last_price > 0) {
            return marketData.last_price;
        }

        if (historyOrders && historyOrders.length > 0) {
            return uPriceToPrice(historyOrders[0].price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0);
        }

        return 0;
    }, [marketData, historyOrders, quoteAsset, baseAsset])
    const isNegative = useMemo(() => (marketData?.change || 0) < 0, [marketData]);
    const marketTicker = useMemo(() => {
        if (!baseAsset || !quoteAsset) return '?/?';

        return `${baseAsset?.ticker}/${quoteAsset?.ticker}`
    }, [baseAsset, quoteAsset]);
    const priceColor = useMemo(() => {
        if (!marketData || marketData.change === 0) {
            return 'hg.flat';
        }

        return marketData.change < 0 ? 'hg.down' : 'hg.up';
    }, [marketData])
    // Market History colours a buy trade red and a sell trade green, as it always has.
    const orderTypeColor = useCallback((type: string) => {
        return type === ORDER_TYPE_BUY ? 'hg.down' : 'hg.up';
    }, [])
    const formattedDateFromTimestamp = useCallback((timestamp: BigNumber|bigint|string, ms?: boolean) => {
        return intlDateFormat.format(new Date(toBigNumber(timestamp).multipliedBy(ms ? 1000 : 1).toNumber()))
    }, [])

    const dailyVolume = useMemo(() => {
        if (!marketData) return '0';

        return prettyAmount(marketData.quote_volume)
    }, [marketData])
    const displayBaseBalance = useMemo(() => {
        if (!baseBalance) return '0';
        return prettyAmount(uAmountToAmount(baseBalance.amount, baseAsset?.decimals ?? 0))
    }, [baseBalance, baseAsset])
    const displayQuoteBalance = useMemo(() => {
        if (!quoteBalance) return '0';
        return prettyAmount(uAmountToAmount(quoteBalance.amount, quoteAsset?.decimals ?? 0))
    }, [quoteBalance, quoteAsset])
    const quoteUsdValue = useCallback((value: number|bigint|BigNumber|string|undefined) => {
        if (!value) return '0';
        return formatUsdAmount(totalUsdValue(toBigNumber(value)))
    }, [totalUsdValue])
    const shouldShowUsdValues = useMemo(() => hasPrice && !quoteAsset?.stable, [hasPrice, quoteAsset])

    const fetchActiveOrders = useCallback(async () => {
        if (!marketId || marketId === '') {
            return;
        }

        const [buy, sell] = await Promise.all([getMarketBuyOrders(marketId), getMarketSellOrders(marketId)]);

        setActiveOrders(
            {
                buyOrders: buy.list,
                sellOrders: sell.list.reverse(),
            }
        );
    }, [marketId])
    const fetchMyHistory = useCallback(async () => {
        if (!address || !marketId || marketId === '') {
            return;
        }

        const data = await getAddressHistory(address, marketId);
        setMyHistory(data);
    }, [address, marketId])
    const fetchMarketHistory = useCallback(async () => {
        if (!marketId || marketId === '') {
            return;
        }
        const history = await getMarketHistory(marketId);
        setHistoryOrders(history.list);
    }, [marketId])
    const fetchMyOrders = useCallback(async () => {
        if (!marketId || marketId === '') {
            return;
        }

        if (address === undefined) {
            setMyOrders([]);
            return;
        }

        const ord = await getAddressFullMarketOrders(marketId, address);
        setMyOrders(ord);
    }, [marketId, address])
    const fetchChartData = useCallback(async (timeframe: string) => {
        if (!marketId || marketId === '') return;

        const chart = await getTradingViewIntervals(
            marketId,
            getChartMinutes(timeframe),
            getChartIntervalsLimit(timeframe),
        );

        setChartData(chart);
    }, [marketId])

    //on component mount
    const onMount = useCallback(async () => {
        fetchActiveOrders();
        fetchMyHistory();
        fetchMarketHistory();
        fetchMyOrders();
        fetchChartData(timeframe);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    // cancel order/s
    const onOrderCancelClick = useCallback(async (orders: OrderSDKType[]) => {
        if (orders.length === 0) return;

        const {cancelOrder} = bze.tradebin.MessageComposer.withTypeUrl;
        if (!address || !tx) {
            toast.error('Please connect your wallet');
            return;
        }

        setSubmittingCancel(true)
        const msgs = [];
        for (const order of orders) {
            const msg = cancelOrder({
                creator: address,
                marketId: order.market_id,
                orderId: order.id,
                orderType: order.order_type,
            });
            msgs.push(msg);
        }

        await tx(msgs);

        fetchMyOrders()
        setSubmittingCancel(false);
    }, [address, tx, toast, fetchMyOrders])

    //buy form
    const onBuyPriceChange = useCallback((price: string) => {
        setBuyPrice(price);
        if (price === '') {
            setBuyTotal('');
            return;
        }

        const total = calculateTotalAmount(price, buyAmount, quoteAsset?.decimals ?? 0);
        if (total !== '') {
            setBuyTotal(total);
        } else {
            setBuyAmount(calculateAmountFromPrice(price, buyTotal, baseAsset?.decimals ?? 0));
        }
    }, [buyAmount, buyTotal, quoteAsset, baseAsset])
    const onBuyAmountChange = useCallback((amount: string) => {
        setBuyAmount(amount);
        if (amount === '') {
            setBuyTotal('');
            return;
        }
        const amountBN = toBigNumber(amount);
        if (amountBN.isNaN() || amountBN.lte(0)) {
            return;
        }

        const total = calculateTotalAmount(buyPrice, amount, quoteAsset?.decimals ?? 0);
        if (total !== '') {
            setBuyTotal(total);
        } else {
            setBuyPrice(calculatePricePerUnit(amount, buyTotal, quoteAsset?.decimals ?? 0));
        }
    }, [buyPrice, buyTotal, quoteAsset])
    const onBuyTotalChange = useCallback((total: string) => {
        setBuyTotal(total);
        const amount = calculateAmountFromPrice(buyPrice, total, quoteAsset?.decimals ?? 0);
        if (amount !== '') {
            setBuyAmount(amount);
        } else {
            setBuyPrice(calculatePricePerUnit(buyAmount, total, baseAsset?.decimals ?? 0));
        }
    }, [buyPrice, buyAmount, quoteAsset, baseAsset])

    //sell form
    const onSellPriceChange = useCallback((price: string) => {
        setSellPrice(price);
        if (price === '') {
            setSellTotal('');
            return;
        }

        const total = calculateTotalAmount(price, sellAmount, quoteAsset?.decimals ?? 0);
        if (total !== '') {
            setSellTotal(total);
        } else {
            setSellAmount(calculateAmountFromPrice(price, sellTotal, baseAsset?.decimals ?? 0));
        }
    }, [sellAmount, sellTotal, quoteAsset, baseAsset])
    const onSellAmountChange = useCallback((amount: string) => {
        setSellAmount(amount);
        if (amount === '') {
            setSellTotal('');
            return;
        }
        const amountBN = toBigNumber(amount);
        if (amountBN.isNaN() || amountBN.lte(0)) {
            return;
        }

        const total = calculateTotalAmount(sellPrice, amount, quoteAsset?.decimals ?? 0);
        if (total !== '') {
            setSellTotal(total);
        } else {
            setSellPrice(calculatePricePerUnit(amount, sellTotal, quoteAsset?.decimals ?? 0));
        }
    }, [sellPrice, sellTotal, quoteAsset])
    const onSellTotalChange = useCallback((total: string) => {
        setSellTotal(total);
        const amount = calculateAmountFromPrice(sellPrice, total, quoteAsset?.decimals ?? 0);
        if (amount !== '') {
            setSellAmount(amount);
        } else {
            setSellPrice(calculatePricePerUnit(sellAmount, total, baseAsset?.decimals ?? 0));
        }
    }, [sellPrice, sellAmount, quoteAsset, baseAsset])
    //clicking a balance fills both forms, like an order book click does: the base balance goes into the
    //Amount inputs (base denominated), the quote balance into the Total inputs (quote denominated)
    const onBaseBalanceClick = useCallback(() => {
        if (submittingOrder) {
            return;
        }

        const amount = balanceToFormValue(baseSpendable.amount, baseAsset?.decimals ?? 0);
        if (amount === '') {
            return;
        }

        onBuyAmountChange(amount);
        onSellAmountChange(amount);
    }, [submittingOrder, baseSpendable.amount, baseAsset, onBuyAmountChange, onSellAmountChange])
    const onQuoteBalanceClick = useCallback(() => {
        if (submittingOrder) {
            return;
        }

        const total = balanceToFormValue(quoteSpendable.amount, quoteAsset?.decimals ?? 0);
        if (total === '') {
            return;
        }

        onBuyTotalChange(total);
        onSellTotalChange(total);
    }, [submittingOrder, quoteSpendable.amount, quoteAsset, onBuyTotalChange, onSellTotalChange])
    const onOrderBookClick = useCallback((price: string, orderType: 'buy' | 'sell', index: number) => {
        const transformedPrice = uPriceToPrice(price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0);
        setBuyPrice(transformedPrice);
        setSellPrice(transformedPrice);
        let amount = toBigNumber(0)

        //if the buy side is clicked we can slice the buy orders up to the clicked index
        let orders = activeOrders?.buyOrders.slice(0, index + 1) ?? [];
        if (orderType === ORDER_TYPE_SELL && activeOrders) {
            //if the sell order side is clicked we need to slice the sell orders from the clicked index onwards
            orders = activeOrders.sellOrders.slice(index) ?? [];
        }

        //sum up the amounts of the orders we have in the clicked range
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            if (order) {
                amount = amount.plus(uAmountToBigNumberAmount(order.amount, baseAsset?.decimals ?? 0));
            }
        }

        const amtStr = amount.toString()
        setBuyAmount(amtStr);
        setSellAmount(amtStr);

        const total = calculateTotalAmount(transformedPrice, amount, quoteAsset?.decimals ?? 0);
        setSellTotal(total);
        setBuyTotal(total);
    }, [quoteAsset, baseAsset, activeOrders])
    const onTimeframeChange = useCallback((timeframe: string) => {
        fetchChartData(timeframe);
        setTimeframe(timeframe)
        //if a debouce was waiting when we pressed the button, cancel it
        cancelDebounce(`update-trading-page-chart-${marketId}`);
    }, [fetchChartData, marketId])

    //order submit functions
    const getMatchingOrders = useCallback((orderType: string, uPrice: BigNumber, uAmount: BigNumber): AggregatedOrderSDKType[] => {
        if (!activeOrders) return [];

        if (uPrice.isNaN() || uPrice.lte(0) || uAmount.isNaN() || uAmount.lte(0)) {
            return [];
        }

        const isBuy = orderType === ORDER_TYPE_BUY;
        let toCheck: AggregatedOrderSDKType[];
        if (isBuy) {
            //reverse them to check from the lowest price to the highest one
            //unpack in a new array to avoid reversing the original one
            toCheck = [...activeOrders.sellOrders].reverse();
        } else {
            toCheck = activeOrders.buyOrders;
        }

        if (toCheck.length <= 1) {
            return [];
        }

        //check the provided price with the first order price in the order book
        const firstOrderPrice = new BigNumber(toCheck[0].price);
        if ((isBuy && firstOrderPrice.gte(uPrice)) || (!isBuy && firstOrderPrice.lte(uPrice))) {
            return [];
        }

        let finishFunc = (p: BigNumber, c: string) => p.gt(c);
        if (isBuy) {
            finishFunc = (p: BigNumber, c: string) => p.lt(c);
        }

        const result = [];
        for (let i = 0; i < toCheck.length; i++) {
            if (finishFunc(uPrice, toCheck[i].price)) {
                break;
            }
            if (uAmount.lte(0)) {
                break;
            }

            const orderCopy = {...toCheck[i]};
            if (uAmount.minus(toCheck[i].amount).lt(0)) {
                orderCopy.amount = uAmount.toString();
            }

            result.push(orderCopy);
            uAmount = uAmount.minus(orderCopy.amount);
        }

        return result;
    }, [activeOrders])
    const submitFillOrdersMsg = useCallback(async (toFill: AggregatedOrderSDKType[]) => {
        if (!marketId || marketId === '' || !address || !tx) {
            return;
        }

        setSubmittingOrder(true)
        const msgOrders: FillOrderItem[] = [];
        for (let i = 0; i < toFill.length; i++) {
            msgOrders.push({
                price: toFill[i].price,
                amount: toFill[i].amount,
            })
        }

        const msg = fillOrders({
            creator: address,
            marketId: marketId,
            orderType: toFill[0].order_type, //use first order to specify what orders we fill
            orders: msgOrders,
        })

        await tx([msg]);

        setSubmittingOrder(false);
    }, [marketId, address, tx])
    const submitCreateOrderMsg = useCallback(async (orderType: string, uPrice: BigNumber, uAmount: BigNumber) => {
        if (!address || !tx || !activeOrders || !marketId || marketId === '') {
            toast.error('Please connect your wallet');
            return;
        }

        const isBuy = orderType === ORDER_TYPE_BUY;
        if (isBuy) {
            if (activeOrders.sellOrders.length > 0) {
                const maxPrice = activeOrders.sellOrders[activeOrders.sellOrders.length - 1].price;
                if (uPrice.gt(maxPrice)) {
                    toast.error('Price is too high. You can buy at a lower price');
                    return;
                }
            }
        } else {
            if (activeOrders.buyOrders.length > 0) {
                const minPrice = activeOrders.buyOrders[0].price;
                if (uPrice.lt(minPrice)) {
                    toast.error('Price is too low. You can sell at a higher price');
                    return;
                }
            }
        }

        setSubmittingOrder(true);
        const msgs = getOrderTxMessages(activeOrders, marketId, address, isBuy, uAmount.toString(), uPrice.toString());

        await tx(msgs);

        setSubmittingOrder(false);
    }, [address, tx, activeOrders, toast, marketId])
    const onOrderSubmit = useCallback(async (orderType: string) => {
        if (!address || !tx) {
            toast.error('Please connect your wallet');
            return;
        }
        if (!quoteAsset || !baseAsset) {
            toast.error('Market is not tradeable');
            return;
        }

        //using only smallest amounts (uAmount, uPrice)
        let amount = amountToBigNumberUAmount(buyAmount, baseAsset.decimals ?? 0)
        let price = priceToBigNumberUPrice(buyPrice, quoteAsset.decimals, baseAsset.decimals)
        if (orderType === ORDER_TYPE_SELL) {
            amount = amountToBigNumberUAmount(sellAmount, baseAsset.decimals ?? 0)
            price = priceToBigNumberUPrice(sellPrice, quoteAsset.decimals, baseAsset.decimals)
        }

        if (!amount.isPositive()) {
            toast.error('Invalid amount');
            return;
        }
        if (!price.isPositive()) {
            toast.error('Invalid price');
            return;
        }

        //a buy locks quote, a sell locks base — plus the gas fee and the trading fee the chain
        //takes on top, from the same balances (chain charging order: gas, module fee, amount)
        const toFill = getMatchingOrders(orderType, price, amount);
        const txSpec = toFill.length > 1 ? {kind: 'fill-orders' as const, count: toFill.length} : 'create-order' as const;
        const moduleFee = (toFill.length > 0 ? takerFeeEstimate : makerFeeEstimate).resolvedFee;
        const spendAsset = orderType === ORDER_TYPE_BUY ? quoteAsset : baseAsset;
        const spendAmount = orderType === ORDER_TYPE_BUY ? amount.multipliedBy(price) : amount;
        const affordability = canAffordTx({
            spend: {denom: spendAsset.denom, amount: spendAmount},
            gasFee: estimateGasFee(txSpec),
            moduleFee,
            balanceOf: (denom) => getBalanceByDenom(denom).amount,
        });
        if (!affordability.canAfford) {
            const shortDenom = affordability.shortfalls[0]?.denom;
            const shortTicker = shortDenom === baseAsset.denom ? baseAsset.ticker : shortDenom === quoteAsset.denom ? quoteAsset.ticker : shortDenom;
            toast.error(affordability.shortOnFees
                ? `Not enough ${shortTicker} left for the network and trading fees`
                : `Insufficient ${shortTicker} balance`);
            return;
        }

        const minAmount = getMinAmount(price, baseAsset.decimals)
        if (amount.lt(minAmount)) {
            toast.error(`Minimum amount is ${prettyAmount(uAmountToAmount(minAmount, baseAsset.decimals))} ${baseAsset.ticker}`);
            return;
        }

        if (toFill.length === 0) {
            return submitCreateOrderMsg(orderType, price, amount);
        } else if (toFill.length === 1) {
            return submitCreateOrderMsg(orderType, toBigNumber(toFill[0].price), amount);
        }

        return submitFillOrdersMsg(toFill);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteAsset, baseAsset, buyAmount, buyPrice, sellAmount, sellPrice, getMatchingOrders, submitCreateOrderMsg, submitFillOrdersMsg, estimateGasFee, getBalanceByDenom, takerFeeEstimate.resolvedFee, makerFeeEstimate.resolvedFee])

    const multipleOrdersFillMessage = useCallback((orderType: string, price: string, amount: string) => {
        if (!activeOrders) return undefined;
        const toFill = getMatchingOrders(
            orderType,
            priceToBigNumberUPrice(price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0),
            amountToBigNumberUAmount(amount, baseAsset?.decimals ?? 0)
        );

        const toFillCount = toFill.length;
        if (toFillCount > 1) {
            return `Match orders with price from ${uPriceToPrice(toFill[0].price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)} to ${uPriceToPrice(toFill[toFillCount - 1].price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)}`
        }

        return undefined;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrders, baseAsset, quoteAsset])
    const buyFillMessage = useMemo(() => {
        if (buyPrice === '' || buyAmount === '') return undefined;

        return multipleOrdersFillMessage(ORDER_TYPE_BUY, buyPrice, buyAmount);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buyPrice, buyAmount])
    const sellFillMessage = useMemo(() => {
        if (sellPrice === '' || sellAmount === '') return undefined;
        return multipleOrdersFillMessage(ORDER_TYPE_SELL, sellPrice, sellAmount);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sellPrice, sellAmount])

    useEffect(() => {
        if (!marketId || marketId === '') return

        //loading is done from an inline async function so no state is set synchronously in the effect
        const load = async () => {
            await onMount();
        }

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketId]);

    useEffect(() => {
        if (!marketId || marketId === '' || connectionType === undefined) return
        let unsubscribe: () => void;
        let refreshInterval: NodeJS.Timeout;

        //depending on the connection type we have in this page we want to update the trading data
        if (connectionType === CONNECTION_TYPE_WS) {
            unsubscribe = blockchainEventManager.subscribe(getMarketOrderBookChangedEvent(marketId), () => {
                //after 200ms reload the entire page date
                addDebounce(`update-trading-page-${marketId}`, 200, onMount);

                // after 3 seconds reload the chart data - chart data comes from Aggregator API - it might get there
                // with some delay
                addDebounce(`update-trading-page-chart-${marketId}`, 1500, () => fetchChartData(timeframe));
            })
        } else {
            refreshInterval = setInterval(() => {
                onMount()
            }, 15 * 1000)
        }

        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval)
            }

            if (unsubscribe) {
                unsubscribe()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionType, marketId]);

    const maxAskAmount = useMemo(
        () => BigNumber.max(0, ...(activeOrders?.sellOrders ?? []).map(o => o.amount)),
        [activeOrders]
    );
    const maxBidAmount = useMemo(
        () => BigNumber.max(0, ...(activeOrders?.buyOrders ?? []).map(o => o.amount)),
        [activeOrders]
    );

    return (
        <Box maxW="1400px" mx="auto" px={{ base: '16px', md: '20px' }} pt="20px" pb="64px">
            <Flex direction="column" gap="16px">
                {/* Market Header */}
                <HgCard
                    as="section"
                    aria-label="Market"
                    position="relative"
                    overflow="hidden"
                    px={{ base: '16px', md: '22px' }}
                    py="18px"
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="20px"
                    flexWrap="wrap"
                >
                    <Box aria-hidden position="absolute" inset="0" bgImage="heroGlowInner" bgRepeat="no-repeat" pointerEvents="none" />
                    <Flex position="relative" align="center" gap={{ base: '10px', md: '18px' }} wrap={{ base: 'nowrap', md: 'wrap' }} minW="0" flex={{ base: '1', lg: 'initial' }}>
                        {/* On a phone the back arrow is icon-only and flush with the card edge, so the
                            price keeps its room and stays on one line. */}
                        <Button
                            size="md"
                            variant="ghost"
                            color="hg.text.secondary"
                            px={{ base: '0', md: '12px' }}
                            minW={{ base: '24px', md: '10' }}
                            aria-label="Back to markets"
                            data-testid="market-back"
                            onClick={() => toExchangePage()}
                        >
                            <LuArrowLeft />
                            <chakra.span display={{ base: 'none', md: 'inline' }}>Markets</chakra.span>
                        </Button>
                        <Box h="40px" w="1px" bg="hg.hairline" hideBelow="md" />
                        <PairLogo
                            baseLogo={baseAsset?.logo}
                            quoteLogo={quoteAsset?.logo}
                            baseTicker={baseAsset?.ticker || ''}
                            quoteTicker={quoteAsset?.ticker || ''}
                        />
                        <Flex direction="column" gap="4px" minW="0" data-testid="market-title">
                            <Flex align="center" gap={{ base: '6px', md: '8px' }} wrap="wrap">
                                <chakra.h1 m="0" fontSize={{ base: '18px', md: '22px' }} fontWeight="800" letterSpacing="-0.01em">
                                    {marketTicker}
                                </chakra.h1>
                                <VenueTag venue="orderbook" size="sm" />
                                {isHalted && <HaltedBadge />}
                                <ChangePill change={marketData?.change} />
                            </Flex>
                            <HighlightText fontSize={{ base: '20px', md: '26px' }} fontWeight="800" letterSpacing="-0.01em" color={priceColor}>
                                {lastPrice} {quoteAsset?.ticker}
                            </HighlightText>
                            {shouldShowUsdValues && (
                                <HighlightText fontSize="13px" color="hg.text.faint">
                                    ${quoteUsdValue(marketData?.last_price)}
                                </HighlightText>
                            )}
                        </Flex>
                    </Flex>

                    <Flex position="relative" align="stretch" display={{ base: 'none', lg: 'flex' }}>
                        <MarketStat label="24h Volume" usd={shouldShowUsdValues ? quoteUsdValue(marketData?.quote_volume) : undefined}>
                            {dailyVolume} {quoteAsset?.ticker}
                        </MarketStat>
                        <MarketStat label="24h High" color="hg.up" usd={shouldShowUsdValues ? quoteUsdValue(marketData?.high) : undefined}>
                            {marketData?.high || 0}
                        </MarketStat>
                        <MarketStat label="24h Low" color="hg.down" usd={shouldShowUsdValues ? quoteUsdValue(marketData?.low) : undefined} last>
                            {marketData?.low || 0}
                        </MarketStat>
                    </Flex>
                </HgCard>

                {/* Main Trading Layout */}
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: '300px minmax(0, 1fr) 360px' }} gap="16px" alignItems="start">
                    {/* Left: Order Book */}
                    <Panel label="Order Book" p="16px" gap="1px">
                        <chakra.h2 m="0" mb="8px" fontSize="15px" fontWeight="700">Order Book</chakra.h2>
                        <Flex justify="space-between" fontSize="11px" color="hg.text.faint" px="8px" pb="6px">
                            <span>Price ({quoteAsset?.ticker})</span>
                            <span>Amount ({baseAsset?.ticker})</span>
                        </Flex>

                        {/* Asks */}
                        {activeOrders?.sellOrders.map((ask, i) => (
                            <OrderBookRow
                                key={i}
                                side="sell"
                                price={uPriceToPrice(ask.price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)}
                                amount={uAmountToAmount(ask.amount, baseAsset?.decimals ?? 0)}
                                depth={depthPercent(ask.amount, maxAskAmount)}
                                onClick={() => onOrderBookClick(ask.price, ORDER_TYPE_SELL, i)}
                            />
                        ))}
                        {(!activeOrders || activeOrders.sellOrders.length === 0) && (
                            <EmptyState>No sell orders</EmptyState>
                        )}

                        {/* Current Price */}
                        <Flex
                            my="8px"
                            p="10px"
                            borderRadius="12px"
                            bg="app.subtle"
                            borderWidth="1px"
                            borderColor="app.border"
                            justify="center"
                            align="center"
                            gap="8px"
                            color={priceColor}
                        >
                            <chakra.strong fontSize="17px" fontFamily="mono">{lastPrice}</chakra.strong>
                            {isNegative ? <LuTrendingDown size={18} aria-hidden="true" /> : <LuTrendingUp size={18} aria-hidden="true" />}
                        </Flex>

                        {/* Bids */}
                        {activeOrders?.buyOrders.map((bid, i) => (
                            <OrderBookRow
                                key={i}
                                side="buy"
                                price={uPriceToPrice(bid.price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)}
                                amount={uAmountToAmount(bid.amount, baseAsset?.decimals ?? 0)}
                                depth={depthPercent(bid.amount, maxBidAmount)}
                                onClick={() => onOrderBookClick(bid.price, ORDER_TYPE_BUY, i)}
                            />
                        ))}
                        {(!activeOrders || activeOrders.buyOrders.length === 0) && (
                            <EmptyState>No buy orders</EmptyState>
                        )}
                    </Panel>

                    {/* Center: Chart */}
                    <Flex direction="column" gap="16px" minW="0">
                        <Panel label="Price Chart" p="16px" gap="12px">
                            <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                                <chakra.h2 m="0" fontSize="15px" fontWeight="700" display="inline-flex" alignItems="center" gap="8px">
                                    <Box as="span" color="hg.link"><LuActivity size={16} aria-hidden="true" /></Box>
                                    Price Chart
                                </chakra.h2>
                                <Flex role="group" aria-label="Timeframe" gap="2px" p="3px" borderRadius="10px" bg="hg.inset">
                                    {timeframes.map((tf) => {
                                        const active = timeframe === tf;
                                        return (
                                            <chakra.button
                                                key={tf}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => onTimeframeChange(tf)}
                                                h="28px"
                                                px="10px"
                                                border="0"
                                                borderRadius="8px"
                                                fontSize="12px"
                                                fontWeight={active ? '700' : '600'}
                                                cursor="pointer"
                                                focusVisibleRing="inside"
                                                {...(active
                                                    ? { bgImage: 'appButton', color: 'hg.buttonText' }
                                                    : { bg: 'transparent', color: 'hg.text.muted', _hover: { color: 'fg' } })}
                                            >
                                                {tf}
                                            </chakra.button>
                                        );
                                    })}
                                </Flex>
                            </Flex>

                            <Box h="350px" w="100%" borderRadius="12px" overflow="hidden" bg="hg.ground">
                                <LightweightChart priceData={chartData || []} chartType={timeframe} />
                            </Box>
                        </Panel>

                        {/* Buy/Sell Forms */}
                        {isHalted && (
                            <HaltedNotice tickers={haltedTickers}>
                                Resting orders on this market will not execute while trading is halted. Cancel them in Your Orders to get your funds back.
                            </HaltedNotice>
                        )}
                        {!isHalted && (
                        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
                            <OrderForm
                                side="buy"
                                title={`Buy ${baseAsset?.ticker ?? ''}`}
                                fillMessage={buyFillMessage}
                                disabled={submittingOrder}
                                onSubmit={() => onOrderSubmit(ORDER_TYPE_BUY)}
                            >
                                <OrderField
                                    label="Price"
                                    unit={quoteAsset?.ticker}
                                    value={buyPrice}
                                    onChange={onBuyPriceChange}
                                    disabled={submittingOrder}
                                    usd={buyPrice && shouldShowUsdValues ? quoteUsdValue(buyPrice) : undefined}
                                />
                                <OrderField
                                    label="Amount"
                                    unit={baseAsset?.ticker}
                                    value={buyAmount}
                                    onChange={onBuyAmountChange}
                                    disabled={submittingOrder}
                                />
                                <OrderField
                                    label="Total"
                                    unit={quoteAsset?.ticker}
                                    value={buyTotal}
                                    onChange={onBuyTotalChange}
                                    disabled={submittingOrder}
                                    usd={buyTotal && shouldShowUsdValues ? quoteUsdValue(buyTotal) : undefined}
                                />
                            </OrderForm>

                            <OrderForm
                                side="sell"
                                title={`Sell ${baseAsset?.ticker ?? ''}`}
                                fillMessage={sellFillMessage}
                                disabled={submittingOrder}
                                onSubmit={() => onOrderSubmit(ORDER_TYPE_SELL)}
                            >
                                <OrderField
                                    label="Price"
                                    unit={quoteAsset?.ticker}
                                    value={sellPrice}
                                    onChange={onSellPriceChange}
                                    disabled={submittingOrder}
                                    usd={sellPrice && shouldShowUsdValues ? quoteUsdValue(sellPrice) : undefined}
                                />
                                <OrderField
                                    label="Amount"
                                    unit={baseAsset?.ticker}
                                    value={sellAmount}
                                    onChange={onSellAmountChange}
                                    disabled={submittingOrder}
                                />
                                <OrderField
                                    label="Total"
                                    unit={quoteAsset?.ticker}
                                    value={sellTotal}
                                    onChange={onSellTotalChange}
                                    disabled={submittingOrder}
                                    usd={sellTotal && shouldShowUsdValues ? quoteUsdValue(sellTotal) : undefined}
                                />
                            </OrderForm>
                        </Grid>
                        )}
                    </Flex>

                    {/* Right: Market History/My History & Active Orders */}
                    <Flex direction="column" gap="16px" minW="0">
                        <Panel label="Trade history" p="14px" gap="10px">
                            <Flex role="tablist" aria-label="Trade history" gap="2px" p="3px" borderRadius="10px" bg="hg.inset" alignSelf="flex-start">
                                {([['market', 'Market History'], ['my', 'My History']] as const).map(([tab, label]) => {
                                    const selected = historyTab === tab;
                                    return (
                                        <chakra.button
                                            key={tab}
                                            type="button"
                                            role="tab"
                                            aria-selected={selected}
                                            onClick={() => setHistoryTab(tab)}
                                            h="30px"
                                            px="12px"
                                            border="0"
                                            borderRadius="8px"
                                            fontSize="12px"
                                            fontWeight="600"
                                            cursor="pointer"
                                            focusVisibleRing="inside"
                                            bg={selected ? 'hg.raised' : 'transparent'}
                                            color={selected ? 'fg' : 'hg.text.muted'}
                                        >
                                            {label}
                                        </chakra.button>
                                    );
                                })}
                            </Flex>

                            <Box maxH="300px" overflowY="auto">
                                <DataTable headers={['Price', 'Amount', 'Time']}>
                                    {historyTab === 'market' && historyOrders.map((trade, i) => (
                                        <chakra.tr key={i} borderTopWidth="1px" borderColor="hg.divider">
                                            <Cell mono color={orderTypeColor(trade.order_type)}>
                                                {uPriceToPrice(trade.price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)}
                                            </Cell>
                                            <Cell mono right>{uAmountToAmount(trade.amount, baseAsset?.decimals ?? 0)}</Cell>
                                            <Cell mono right color="hg.text.faint">
                                                {formattedDateFromTimestamp(trade.executed_at, true)}
                                            </Cell>
                                        </chakra.tr>
                                    ))}
                                    {historyTab === 'market' && historyOrders.length === 0 && (
                                        <EmptyTableRow colSpan={3} message={'No market history'} />
                                    )}
                                    {historyTab === 'my' && myHistory.map((trade, i) => (
                                        <chakra.tr key={i} borderTopWidth="1px" borderColor="hg.divider">
                                            <Cell mono color={orderTypeColor(trade.order_type)}>{trade.price}</Cell>
                                            <Cell mono right>{trade.base_volume}</Cell>
                                            <Cell mono right color="hg.text.faint">{formattedDateFromTimestamp(trade.executed_at)}</Cell>
                                        </chakra.tr>
                                    ))}
                                    {historyTab === 'my' && myHistory.length === 0 && (
                                        <EmptyTableRow colSpan={3} message={'No history'}/>
                                    )}
                                </DataTable>
                            </Box>
                        </Panel>

                        {/* Active Orders */}
                        <Panel label="Your Orders" p="14px" gap="10px">
                            <Flex justify="space-between" align="center">
                                <chakra.h2 m="0" fontSize="14px" fontWeight="700">Your Orders</chakra.h2>
                                {myOrders.length > 0 && (
                                    <Button
                                        size="sm"
                                        h="30px"
                                        px="10px"
                                        fontSize="12px"
                                        borderRadius="8px"
                                        variant={hgVariant('secondary')}
                                        onClick={() => onOrderCancelClick(myOrders)}
                                        loading={submittingCancel}
                                    >
                                        Cancel All
                                    </Button>
                                )}
                            </Flex>

                            {myOrders.length === 0 ? (
                                <EmptyState>No active orders</EmptyState>
                            ) : (
                                <Box maxH="300px" overflowY="auto">
                                    <DataTable headers={['Type', 'Price', 'Amount', <VisuallyHidden key="cancel">Cancel</VisuallyHidden>]}>
                                        {myOrders.map((order, i) => (
                                            <chakra.tr key={i} borderTopWidth="1px" borderColor="hg.divider">
                                                <Cell><SideBadge orderType={order.order_type} /></Cell>
                                                <Cell mono right>
                                                    {uPriceToPrice(order.price, quoteAsset?.decimals ?? 0, baseAsset?.decimals ?? 0)}
                                                </Cell>
                                                <Cell mono right>{uAmountToAmount(order.amount, baseAsset?.decimals ?? 0)}</Cell>
                                                <Cell right>
                                                    <IconButton
                                                        aria-label="Cancel order"
                                                        size="xs"
                                                        variant="ghost"
                                                        color="hg.text.muted"
                                                        _hover={{ color: 'hg.danger.text', bg: 'hg.hoverFill' }}
                                                        onClick={() => onOrderCancelClick([order])}
                                                        loading={submittingCancel}
                                                    >
                                                        <LuX size={14} />
                                                    </IconButton>
                                                </Cell>
                                            </chakra.tr>
                                        ))}
                                    </DataTable>
                                </Box>
                            )}
                        </Panel>

                        {/* Balance */}
                        <Panel label="Balance" p="14px" gap="4px">
                            <chakra.h2 m="0" mb="6px" fontSize="14px" fontWeight="700">Balance</chakra.h2>
                            <BalanceButton
                                ticker={baseAsset?.ticker}
                                aria-label={`Use my available ${baseAsset?.ticker ?? ''} balance as amount`}
                                onClick={onBaseBalanceClick}
                            >
                                {displayBaseBalance}
                            </BalanceButton>
                            <BalanceButton
                                ticker={quoteAsset?.ticker}
                                aria-label={`Use my available ${quoteAsset?.ticker ?? ''} balance as total`}
                                onClick={onQuoteBalanceClick}
                            >
                                {displayQuoteBalance}
                            </BalanceButton>
                        </Panel>

                        {/* Trading Fees Info */}
                        <Panel label="Trading Fees" p="14px" gap="10px">
                            <Flex align="center" gap="6px" fontSize="12px" fontWeight="600" color="hg.text.faint">
                                <LuInfo size={14} aria-hidden="true" />
                                Trading Fees
                            </Flex>
                            <FeeEstimateRow
                                size="xs"
                                label="Taker Fee"
                                fee={tradingFees.takerFee}
                                isLoading={tradingFeesLoading}
                                description="Fee paid to the network when your order is filled immediately (market order or matching existing orders)."
                                txKind="create-order"
                            />
                            <FeeEstimateRow
                                size="xs"
                                label="Maker Fee"
                                fee={tradingFees.makerFee}
                                isLoading={tradingFeesLoading}
                                description="Fee paid to the network when your order is placed in the order book and filled later."
                                txKind="create-order"
                            />
                        </Panel>
                    </Flex>
                </Grid>
            </Flex>
        </Box>
    );
};

export default TradingPage;
