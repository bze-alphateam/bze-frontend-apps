import {
    ColorType,
    createChart,
    CandlestickSeries,
    HistogramSeries
} from 'lightweight-charts';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Box, Text} from "@chakra-ui/react";
import {useColorModeValue} from "@/components/ui/color-mode";
import {getNoOfIntervalsNeeded} from "@bze/bze-ui-kit";
import {VStack} from "@chakra-ui/react";
import {LuChartBar} from "react-icons/lu";

interface PriceData {
    open: number;
    high: number;
    low: number;
    close: number;
    time: number|string;
    value: number;
}

interface ChartProps {
    priceData: PriceData[];
    chartType: string;
}

export const LightweightChart = (props: ChartProps) => {
    const {priceData} = props;
    const [chartText, setChartText] = useState<string>('Loading chart...');
    const [chartLoaded, setChartLoaded] = useState<boolean>(false);

    const chartContainerRef = useRef<HTMLDivElement>(null);

    const vColor = useColorModeValue('rgba(113,119,117,0.4)', 'rgba(185,183,183,0.3)');
    const gridColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(255,255,255,0.05)');
    const textColor = useColorModeValue('#666666', '#a0a0a0');
    const bgColor = 'rgba(0,0,0,0)';

    const neededIntervals = useCallback(() => {
        if (!priceData || !props.chartType) {
            return 0
        }

        let neededIntervals = getNoOfIntervalsNeeded(props.chartType);

        if (priceData.length - 1 < neededIntervals) {
            neededIntervals = priceData.length - 1;
        }

        return neededIntervals;
    }, [priceData, props.chartType]);

    const getBarSpacing = useCallback(() => {
        if (!priceData || !props.chartType) {
            return 0
        }

        const neededIntervals = getNoOfIntervalsNeeded(props.chartType);

        if (neededIntervals > 180) {
            return 2;
        }

        return 20;
    }, [priceData, props.chartType]);

    const formatByAverage = useCallback((avg: number): { precision: number, minMove: number } => {
        if (avg < 0.0001) {
            return {precision: 7, minMove: 0.0000001};
        } else if (avg < 0.001) {
            return {precision: 6, minMove: 0.000001};
        } else if (avg < 0.01) {
            return {precision: 5, minMove: 0.00001};
        } else if (avg < 0.1) {
            return {precision: 4, minMove: 0.0001};
        } else if (avg < 1) {
            return {precision: 3, minMove: 0.001};
        } else {
            return {precision: 2, minMove: 0.01};
        }

    }, [])

    const getPriceFormatOptions = useCallback((): { precision: number, minMove: number } => {
        if (!priceData || priceData.length === 0) {
            return {precision: 3, minMove: 0.0001};
        }

        const first = priceData[0];
        const middle = priceData[Math.floor(priceData.length / 2)];
        const last = priceData[priceData.length - 1];
        const avg = (first.high + first.low + middle.high + middle.low + last.high + last.low) / 6;

        return formatByAverage(avg);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceData]);

    const getVolumeFormatOptions = useCallback((): { precision: number, minMove: number } => {
        if (!priceData || priceData.length === 0) {
            return {precision: 3, minMove: 0.0001};
        }

        const first = priceData[0];
        const middle = priceData[Math.floor(priceData.length / 2)];
        const last = priceData[priceData.length - 1];
        const avg = (first.value + middle.value + last.value) / 3;

        return formatByAverage(avg);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceData]);

    const timeToLocal = useCallback((originalTime: number): number => {
        //https://tradingview.github.io/lightweight-charts/docs/time-zones
        const localOffset = new Date().getTimezoneOffset() * 60;
        return originalTime - localOffset;
    }, [])

    useEffect(
        () => {
            const errorTimeout = setTimeout(() => {
                setChartText("Error loading chart");
            }, 10000);

            if (!chartContainerRef.current) {
                clearTimeout(errorTimeout);
                return;
            }

            if (!priceData || priceData.length === 0) {
                setChartText("No data available");
                clearTimeout(errorTimeout);
                return;
            }

            const volumeData: PriceData[] = [];
            const filteredPriceData: PriceData[] = [];
            for (const item of priceData) {
                const convertedTime = timeToLocal(typeof item.time === 'string' ? new Date(item.time).getTime() : item.time);
                const formatted = {
                    ...item,
                    time: convertedTime
                }
                volumeData.push(formatted);

                if (item.open !== 0 && item.high !== 0 && item.low !== 0 && item.close !== 0) {
                    filteredPriceData.push(formatted);
                }
            }

            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: {
                        type: ColorType.Solid,
                        color: bgColor,
                    },
                    textColor,
                },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                grid: {
                    horzLines: {
                        color: gridColor,
                    },
                },
                timeScale: {
                    barSpacing: getBarSpacing(),
                    borderColor: gridColor,
                    timeVisible: true,
                    rightOffset: 0,
                }
            });

            const handleResize = () => {
                chart.resize(chartContainerRef.current!.clientWidth, chartContainerRef.current!.clientHeight);
            };

            const {precision, minMove} = getPriceFormatOptions();

            // V5 API - pass the series definition
            const priceSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: true,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });

            priceSeries.priceScale().applyOptions({
                autoScale: true,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.4,
                },
                borderColor: gridColor,
            });

            // @ts-expect-error it's already converted to number
            priceSeries.setData(filteredPriceData);

            const {precision: vPrecision, minMove: vMinMove} = getVolumeFormatOptions();

            // V5 API - pass the series definition
            const volumeSeries = chart.addSeries(HistogramSeries, {
                priceFormat: {
                    type: 'volume',
                    precision: vPrecision,
                    minMove: vMinMove,
                },
                priceScaleId: '',
                color: vColor,
            });

            volumeSeries.priceScale().applyOptions({
                scaleMargins: {
                    top: 0.8,
                    bottom: 0,
                },
            });

            //@ts-expect-error it's already converted to number'
            volumeSeries.setData(volumeData);

            const intervalsToDisplay = neededIntervals();
            if (intervalsToDisplay > 0) {
                let fromIndex = volumeData.length - 1 - intervalsToDisplay
                if (fromIndex < 0) {
                    fromIndex = 0;
                }

                chart.timeScale().setVisibleRange({
                    // @ts-expect-error it's already converted to number
                    from: volumeData[fromIndex].time,
                    // @ts-expect-error it's already converted to number
                    to: volumeData[volumeData.length - 1].time,
                });
            }

            setChartText("");
            setChartLoaded(true);
            clearTimeout(errorTimeout);

            window.addEventListener('resize', handleResize);

            return () => {
                clearTimeout(errorTimeout);
                window.removeEventListener('resize', handleResize);
                chart.remove();
            };
        },

        // eslint-disable-next-line react-hooks/exhaustive-deps
        [priceData, vColor, gridColor, textColor]
    );

    return (
        <div
            ref={chartContainerRef}
            style={{
                height: '100%',
                width: '100%',
                position: 'relative',
            }}
        >
            {(!chartLoaded || priceData.length === 0) && (
                <Box
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                >
                    <VStack>
                        <LuChartBar size={32} color="gray" />
                        <Text color="fg.muted" fontSize="sm">{chartText}</Text>
                    </VStack>
                </Box>
            )}
        </div>
    );
};