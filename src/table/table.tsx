"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	FinancialAssetRow,
	FinancialAssetRowCalculated,
	useFinancialAssetColumns,
} from "./columns";
import { DataTable } from "./template";
import { fromDateKey, isDateToday, toDateKey } from "@/utils/date";
import {
	formatCurrency,
	formatNumber,
	formatPercent,
	normalizeNumber,
} from "@/utils/number";
import { fetchBorsaItalianaData } from "@/fetching/fetchBorsaItaliana";
import { FinancialAsset } from "@/lib/financialAsset";

// Local storage key for saving financial assets data
const LOCAL_STORAGE_KEY = "financial-assets-data";

// Helper function to generate unique row IDs (short ID that can be combined with ISIN)
const generateShortId = (): string => {
	return Math.random().toString(36).substring(2, 8);
};

const formatRowId = (isin: string, shortId: string): string => {
	return isin ? `${isin}-${shortId}` : shortId;
};

type PersistedFinancialAssetRow = Omit<
	FinancialAssetRow,
	keyof FinancialAssetRowCalculated
>;

interface HistoricalCalculationRow {
	dateKey: string;
	price: number;
	annualYieldGrossToday: number;
	annualYieldNetToday: number;
	totalValueToday: number;
	totalValueDifference: number;
}

const getLatestPriceEntry = (priceByDate?: Record<string, number>) => {
	if (!priceByDate) return null;
	const validEntries = Object.entries(priceByDate)
		.filter(([, value]) => Number.isFinite(Number(value)))
		.sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey));
	if (validEntries.length === 0) return null;
	const [dateKey, price] = validEntries[validEntries.length - 1];
	return {
		dateKey,
		price: Number(price),
	};
};

const upsertPriceByDate = (
	existing: Record<string, number> | undefined,
	dateKey: string,
	price: number,
) => {
	return {
		...(existing || {}),
		[dateKey]: Number(price),
	};
};

const calculateTotalValues = (row: FinancialAssetRow) => {
	if (!row.totalValueNominal || !row.redemptionPrice) {
		return {
			totalValueSettlement: NaN,
			totalValueToday: NaN,
			totalValueDifference: NaN,
		};
	}

	const totalValueNominal = normalizeNumber(row.totalValueNominal);
	const totalValueSettlement =
		(totalValueNominal / row.redemptionPrice) * row.settlementPrice;
	const totalValueToday = row.todayPrice
		? (totalValueNominal / row.redemptionPrice) * row.todayPrice
		: NaN;

	return {
		totalValueSettlement,
		totalValueToday,
		totalValueDifference: totalValueToday - totalValueSettlement,
	};
};

const recalculateDerivedFields = (
	row: FinancialAssetRow,
): FinancialAssetRow => {
	const nextRow: FinancialAssetRow = {
		...row,
	};

	const latestPrice = getLatestPriceEntry(nextRow.priceByDate);
	nextRow.todayPrice = latestPrice?.price;

	nextRow.annualYieldGross = NaN;
	nextRow.annualYieldNet = NaN;
	nextRow.annualYieldGrossToday = NaN;
	nextRow.annualYieldNetToday = NaN;

	try {
		const settlementAsset = new FinancialAsset(
			nextRow.isin,
			nextRow.settlementDate,
			nextRow.maturityDate,
			nextRow.couponRatePerc,
			nextRow.settlementPrice,
			nextRow.redemptionPrice,
			nextRow.yearlyFrequency,
			nextRow.capitalGainTaxPerc,
			nextRow.issuingDate,
		);
		nextRow.annualYieldGross = settlementAsset.computeYield();
		nextRow.annualYieldNet = settlementAsset.computeYieldNet();

		if (latestPrice) {
			const referenceDate = fromDateKey(latestPrice.dateKey);
			nextRow.annualYieldGrossToday = settlementAsset.computeYield(
				referenceDate,
				latestPrice.price,
			);
			nextRow.annualYieldNetToday = settlementAsset.computeYieldNet(
				referenceDate,
				latestPrice.price,
			);
		}
	} catch (error) {
		console.error("Error calculating yield:", error);
	}

	const values = calculateTotalValues(nextRow);
	nextRow.totalValueSettlement = values.totalValueSettlement;
	nextRow.totalValueToday = values.totalValueToday;
	nextRow.totalValueDifference = values.totalValueDifference;

	return nextRow;
};

const sanitizeRowForPersistence = (
	row: FinancialAssetRow,
): PersistedFinancialAssetRow => {
	const {
		annualYieldGross,
		annualYieldNet,
		todayPrice,
		annualYieldGrossToday,
		annualYieldNetToday,
		totalValueSettlement,
		totalValueToday,
		totalValueDifference,
		...baseRow
	} = row;

	void annualYieldGross;
	void annualYieldNet;
	void todayPrice;
	void annualYieldGrossToday;
	void annualYieldNetToday;
	void totalValueSettlement;
	void totalValueToday;
	void totalValueDifference;

	return baseRow;
};

const rehydrateRowFromPersistence = (
	row: PersistedFinancialAssetRow,
): FinancialAssetRow => {
	let normalizedPriceByDate = Object.fromEntries(
		Object.entries(row.priceByDate || {}).map(([dateKey, price]) => [
			dateKey,
			normalizeNumber(price),
		]),
	);

	// Backward compatibility for legacy exports that only had todayPrice.
	// TODO remove in the future
	if (Object.keys(normalizedPriceByDate).length === 0) {
		const legacyTodayPriceRaw = (row as Partial<FinancialAssetRow>)
			.todayPrice;
		const legacyTodayPrice = normalizeNumber(
			typeof legacyTodayPriceRaw === "number" ||
				typeof legacyTodayPriceRaw === "string"
				? legacyTodayPriceRaw
				: NaN,
		);
		if (Number.isFinite(legacyTodayPrice)) {
			normalizedPriceByDate = {
				[toDateKey(new Date())]: legacyTodayPrice,
			};
		}
	}

	const shortId = generateShortId();
	return recalculateDerivedFields({
		...row,
		settlementDate: row.settlementDate
			? new Date(row.settlementDate)
			: new Date(),
		maturityDate: row.maturityDate
			? new Date(row.maturityDate)
			: new Date(),
		issuingDate: row.issuingDate ? new Date(row.issuingDate) : new Date(),
		priceByDate: normalizedPriceByDate,
		_rowId: formatRowId(row.isin, shortId), // Generate a new unique ID for each loaded row
	});
};

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

	const totalValueNominal =
		row.totalValueNominal && row.redemptionPrice
			? normalizeNumber(row.totalValueNominal)
			: NaN;
	const totalValueSettlement = totalValueNominal
		? (totalValueNominal / row.redemptionPrice) * row.settlementPrice
		: NaN;

	return entries.map(([dateKey, rawPrice]) => {
		const price = Number(rawPrice);
		const date = fromDateKey(dateKey);
		const totalValueToday = totalValueNominal
			? (totalValueNominal / row.redemptionPrice) * price
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

interface YieldsTableProps {
	name: string;
	onNameChange?: (name: string) => void; // Add this prop to pass name changes back to parent
}

export default function YieldsTable({ name, onNameChange }: YieldsTableProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || "en";
	const columns = useFinancialAssetColumns();
	const [data, setData] = useState<FinancialAssetRow[]>([]);
	const [deleteConfirmState, setDeleteConfirmState] = useState({
		isConfirming: false,
		timeoutId: null as NodeJS.Timeout | null,
	});

	// Handle name changes from within this component or from imported data
	const handleNameChange = useCallback(
		(newName: string) => {
			// Propagate the name change to the parent component if callback exists
			if (onNameChange) {
				onNameChange(newName);
			}
		},
		[onNameChange],
	);

	const handleAddRow = useCallback(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Create empty financial asset using the FinancialAsset class
		const emptyFinancialAsset = new FinancialAsset(
			"",
			today,
			today,
			NaN,
			NaN,
			100,
			NaN,
			NaN,
		);

		// Create a row using the financial asset's JSON data with additional UI fields
		const shortId = generateShortId();
		const emptyAsset: FinancialAssetRow = {
			isin: emptyFinancialAsset.isin,
			issuingDate: new Date(emptyFinancialAsset.issuingDate),
			settlementDate: new Date(emptyFinancialAsset.settlementDate),
			maturityDate: new Date(emptyFinancialAsset.maturityDate),
			couponRatePerc: emptyFinancialAsset.couponRatePerc,
			settlementPrice: emptyFinancialAsset.settlementPrice,
			redemptionPrice: emptyFinancialAsset.redemptionPrice,
			yearlyFrequency: emptyFinancialAsset.yearlyFrequency,
			capitalGainTaxPerc: emptyFinancialAsset.capitalGainTaxPerc,
			name: "",
			priceByDate: {},
			totalValueNominal: NaN,
			totalValueSettlement: NaN,
			totalValueToday: NaN,
			totalValueDifference: NaN,
			notes: "",
			_rowId: formatRowId("", shortId), // Generate unique ID for this row
		};

		// Add the new empty row to the data
		setData((previousData) => [
			...previousData,
			recalculateDerivedFields(emptyAsset),
		]);
	}, []);

	const handleDeleteAllRows = useCallback(() => {
		if (!deleteConfirmState.isConfirming) {
			// First press - set confirming state and timeout
			const timeoutId = setTimeout(() => {
				setDeleteConfirmState({
					isConfirming: false,
					timeoutId: null,
				});
			}, 3000); // 3 seconds to confirm

			setDeleteConfirmState({
				isConfirming: true,
				timeoutId,
			});
		} else {
			// Second press - clear timeout and delete rows
			if (deleteConfirmState.timeoutId) {
				clearTimeout(deleteConfirmState.timeoutId);
			}
			setData([]); // Clear all data
			setDeleteConfirmState({
				isConfirming: false,
				timeoutId: null,
			});
		}
	}, [deleteConfirmState]);

	const handleDeleteRow = useCallback((row: FinancialAssetRow) => {
		// Use the unique row ID to identify and delete the correct row
		// This prevents deleting multiple rows with the same ISIN
		setData((previousData) =>
			previousData.filter((item) => item._rowId !== row._rowId),
		);
	}, []);

	// This function handles data updates from the DataTable component
	const handleDataChange = useCallback((newData: FinancialAssetRow[]) => {
		setData(newData.map((row) => recalculateDerivedFields(row)));
	}, []);

	const serializeRow = useCallback((row: FinancialAssetRow) => {
		return sanitizeRowForPersistence(row);
	}, []);

	const deserializeRow = useCallback((row: unknown) => {
		return rehydrateRowFromPersistence(row as PersistedFinancialAssetRow);
	}, []);

	// This function will handle cell updates
	const handleUpdateData = useCallback(
		(rowIndex: number, columnId: string, value: unknown) => {
			if (rowIndex < 0 || rowIndex >= data.length) {
				return;
			}

			const previousRow = data[rowIndex];
			const previousValue =
				previousRow[columnId as keyof FinancialAssetRow];
			const isIsinColumn = columnId === "isin";
			const isSameValue = value == previousValue;

			if (!isIsinColumn && isSameValue) {
				return;
			}

			setData((prevData) => {
				return prevData.map((row, idx) => {
					if (idx !== rowIndex) {
						return row;
					}

					const updatedRow: FinancialAssetRow = {
						...row,
						[columnId]: value,
					};

					if (columnId === "todayPrice") {
						const normalizedPrice = normalizeNumber(
							typeof value === "string" ||
								typeof value === "number"
								? value
								: NaN,
						);
						updatedRow.priceByDate = upsertPriceByDate(
							updatedRow.priceByDate,
							toDateKey(new Date()),
							normalizedPrice,
						);
					}

					return recalculateDerivedFields(updatedRow);
				});
			});

			if (!isIsinColumn) {
				return;
			}

			const isin =
				typeof value === "string"
					? value.trim()
					: typeof value === "number"
						? String(value).trim()
						: "";

			if (isin.length !== 12) {
				return;
			}

			const latestPriceDate = getLatestPriceEntry(
				previousRow.priceByDate,
			)?.dateKey;
			const todayDateKey = toDateKey(new Date());
			const shouldRefetch =
				!isSameValue || latestPriceDate !== todayDateKey;

			if (!shouldRefetch) {
				return;
			}

			setData((currentData) =>
				currentData.map((currentRow, currentIdx) => {
					if (currentIdx !== rowIndex) {
						return currentRow;
					}
					return {
						...currentRow,
						name: t("table.status.loadingData"),
					};
				}),
			);

			fetchBorsaItalianaData(isin)
				.then((bondData) => {
					setData((currentData) => {
						return currentData.map((currentRow, currentIdx) => {
							if (currentIdx !== rowIndex) {
								return currentRow;
							}

							const normalizedPrice = normalizeNumber(
								bondData.price.last || 0,
							);
							const nextRow: FinancialAssetRow = {
								...currentRow,
								name: bondData.title,
								issuingDate: bondData.info.issuingDate,
								maturityDate: bondData.info.maturityDate,
								couponRatePerc: bondData.info.couponRatePerc,
								yearlyFrequency: bondData.info.couponFrequency,
								priceByDate: upsertPriceByDate(
									currentRow.priceByDate,
									todayDateKey,
									normalizedPrice,
								),
							};

							if (isDateToday(currentRow.settlementDate)) {
								nextRow.settlementPrice = normalizedPrice;
							}

							return recalculateDerivedFields(nextRow);
						});
					});
				})
				.catch((error) => {
					console.error(
						`[handleUpdateData] Error fetching data for ISIN ${isin}:`,
						error,
					);
					setData((currentData) => {
						return currentData.map((currentRow, currentIdx) => {
							if (currentIdx !== rowIndex) {
								return currentRow;
							}
							return {
								...currentRow,
								name: t("table.status.fetchFailed"),
							};
						});
					});
				});
		},
		[data, t],
	);

	const renderRowDetails = useCallback(
		(row: FinancialAssetRow) => {
			const historicalRows = buildHistoricalRows(row);
			const dateFormatter = new Intl.DateTimeFormat(locale, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			});
			return (
				<div className="space-y-3">
					<div>
						<div className="font-medium">
							{t("table.details.isin")}
						</div>
						<div className="text-sm">
							{row.isin || t("common.na")}
						</div>
					</div>
					<div>
						<div className="font-medium">
							{t("table.details.name")}
						</div>
						<div className="text-sm">
							{row.name || t("common.na")}
						</div>
					</div>
					<div>
						<div className="font-medium mb-2">
							{t("table.details.priceHistory")}
						</div>
						{historicalRows.length === 0 ? (
							<div className="text-sm">
								{t("table.details.noHistoricalData")}
							</div>
						) : (
							<div className="space-y-2">
								{historicalRows.map((entry) => (
									<div
										key={entry.dateKey}
										className="rounded border p-2 text-sm"
									>
										<div>
											{t("table.details.date")}:{" "}
											{dateFormatter.format(
												fromDateKey(entry.dateKey),
											)}
										</div>
										<div>
											{t("table.details.price")}:{" "}
											{formatNumber(entry.price, locale, {
												minimumFractionDigits: 3,
												maximumFractionDigits: 3,
											})}
										</div>
										<div>
											{t("table.details.grossYield")}:{" "}
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
											{t("table.details.netYield")}:{" "}
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
											{t("table.details.marketValue")}:{" "}
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
											{t("table.details.difference")}:{" "}
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
		},
		[locale, t],
	);

	const tableMeta = useMemo(
		() => ({
			updateData: handleUpdateData,
			deleteConfirmState: deleteConfirmState.isConfirming,
		}),
		[handleUpdateData, deleteConfirmState.isConfirming],
	);

	return (
		<div className="px-4 mx-auto py-5">
			<DataTable
				columns={columns}
				data={data}
				name={name}
				onAddRow={handleAddRow}
				onDeleteAllRows={handleDeleteAllRows}
				onDeleteRow={handleDeleteRow}
				onNameChange={handleNameChange} // Use our wrapper function
				onDataChange={handleDataChange}
				localStorageKey={LOCAL_STORAGE_KEY}
				serializeRow={serializeRow}
				deserializeRow={deserializeRow}
				renderRowDetails={renderRowDetails}
				meta={tableMeta}
			/>
		</div>
	);
}
