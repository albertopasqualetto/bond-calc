"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FinancialAssetRow } from "./columns";
import { FinancialAsset } from "@/lib/financialAsset";
import { fromDateKey } from "@/utils/date";
import {
	formatCurrency,
	formatNumber,
	formatPercent,
	normalizeNumber,
} from "@/utils/number";

interface HistoricalCalculationRow {
	dateKey: string;
	price: number;
	annualYieldGrossToday: number;
	annualYieldNetToday: number;
	totalValueToday: number;
	totalValueDifference: number;
}

const buildHistoricalRows = (
	row: FinancialAssetRow,
): HistoricalCalculationRow[] => {
	const entries = Object.entries(row.priceByDate || {})
		.filter(([, price]) => Number.isFinite(Number(price)))
		.sort(([first], [second]) => first.localeCompare(second));

	if (entries.length === 0) {
		return [];
	}

	let settlementAsset: FinancialAsset | null = null;
	try {
		settlementAsset = new FinancialAsset(
			row.isin,
			row.settlementDate,
			row.maturityDate,
			row.couponRatePerc,
			row.settlementPrice,
			row.redemptionPrice,
			row.yearlyFrequency,
			row.capitalGainTaxPerc,
			row.issuingDate,
		);
	} catch {
		return [];
	}

	const totalValueNominal = normalizeNumber(row.totalValueNominal ?? NaN);
	const redemptionPrice = normalizeNumber(row.redemptionPrice);
	const settlementPrice = normalizeNumber(row.settlementPrice);
	const hasValidBaseValues =
		Number.isFinite(totalValueNominal) &&
		Number.isFinite(redemptionPrice) &&
		redemptionPrice !== 0;
	const totalValueSettlement =
		hasValidBaseValues && Number.isFinite(settlementPrice)
			? (totalValueNominal / redemptionPrice) * settlementPrice
			: NaN;

	return entries.map(([dateKey, rawPrice]) => {
		const price = Number(rawPrice);
		const date = fromDateKey(dateKey);
		const totalValueToday = hasValidBaseValues
			? (totalValueNominal / redemptionPrice) * price
			: NaN;

		return {
			dateKey,
			price,
			annualYieldGrossToday: settlementAsset.computeYield(date, price),
			annualYieldNetToday: settlementAsset.computeYieldNet(date, price),
			totalValueToday,
			totalValueDifference: totalValueToday - totalValueSettlement,
		};
	});
};

interface RowDetailsProps {
	row: FinancialAssetRow;
}

export default function RowDetails({ row }: RowDetailsProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || "en";
	const historicalRows = useMemo(() => buildHistoricalRows(row), [row]);
	const dateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}),
		[locale],
	);

	return (
		<div className="space-y-3">
			<div>
				<div className="font-medium">{t("financialAsset.isin")}</div>
				<div className="text-sm">{row.isin || t("common.na")}</div>
			</div>
			<div>
				<div className="font-medium">{t("financialAsset.name")}</div>
				<div className="text-sm">{row.name || t("common.na")}</div>
			</div>
			<div>
				<div className="font-medium mb-2">
					{t("financialAsset.priceHistory")}
				</div>
				{historicalRows.length === 0 ? (
					<div className="text-sm">
						{t("financialAsset.noHistoricalData")}
					</div>
				) : (
					<div className="space-y-2">
						{historicalRows.map((entry) => (
							<div
								key={entry.dateKey}
								className="rounded border p-2 text-sm"
							>
								<div>
									{t("financialAsset.date")}:{" "}
									{dateFormatter.format(
										fromDateKey(entry.dateKey),
									)}
								</div>
								<div>
									{t("financialAsset.price")}:{" "}
									{formatNumber(entry.price, locale, {
										minimumFractionDigits: 3,
										maximumFractionDigits: 3,
									})}
								</div>
								<div>
									{t("financialAsset.grossYield")}:{" "}
									{formatPercent(
										entry.annualYieldGrossToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.netYield")}:{" "}
									{formatPercent(
										entry.annualYieldNetToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.marketValue")}:{" "}
									{formatCurrency(
										entry.totalValueToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.difference")}:{" "}
									{formatCurrency(
										entry.totalValueDifference,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
											signDisplay: "exceptZero",
										},
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
