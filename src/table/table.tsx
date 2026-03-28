"use client";

import { useState, useEffect, useCallback } from "react";
import { FinancialAssetRow, FinancialAssetRowCalculated, columns } from "./columns";
import { DataTable } from "./template";
import { fromDateKey, isDateToday, toDateKey } from "@/utils/date";
import { normalizeNumber } from "@/utils/number";
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

type PersistedFinancialAssetRow = Omit<FinancialAssetRow, keyof FinancialAssetRowCalculated>;

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

const upsertPriceByDate = (existing: Record<string, number> | undefined, dateKey: string, price: number) => {
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
	const totalValueSettlement = (totalValueNominal / row.redemptionPrice) * row.settlementPrice;
	const totalValueToday = row.todayPrice
		? (totalValueNominal / row.redemptionPrice) * row.todayPrice
		: NaN;

	return {
		totalValueSettlement,
		totalValueToday,
		totalValueDifference: totalValueToday - totalValueSettlement,
	};
};

const recalculateDerivedFields = (row: FinancialAssetRow): FinancialAssetRow => {
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
			nextRow.annualYieldGrossToday = settlementAsset.computeYield(referenceDate, latestPrice.price);
			nextRow.annualYieldNetToday = settlementAsset.computeYieldNet(referenceDate, latestPrice.price);
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

const sanitizeRowForPersistence = (row: FinancialAssetRow): PersistedFinancialAssetRow => {
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

const rehydrateRowFromPersistence = (row: PersistedFinancialAssetRow): FinancialAssetRow => {
	let normalizedPriceByDate = Object.fromEntries(
		Object.entries(row.priceByDate || {}).map(([dateKey, price]) => [dateKey, normalizeNumber(price)]),
	);

	// Backward compatibility for legacy exports that only had todayPrice.
	// TODO remove in the future
	if (Object.keys(normalizedPriceByDate).length === 0) {
		const legacyTodayPrice = normalizeNumber(
			(row as Record<string, unknown>).todayPrice as number | string,
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
		settlementDate: row.settlementDate ? new Date(row.settlementDate) : new Date(),
		maturityDate: row.maturityDate ? new Date(row.maturityDate) : new Date(),
		issuingDate: row.issuingDate ? new Date(row.issuingDate) : new Date(),
		priceByDate: normalizedPriceByDate,
		_rowId: formatRowId(row.isin, shortId), // Generate a new unique ID for each loaded row
	});
};

const buildHistoricalRows = (row: FinancialAssetRow): HistoricalCalculationRow[] => {
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

	const totalValueNominal = row.totalValueNominal && row.redemptionPrice
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
			annualYieldGrossToday: settlementAsset!.computeYield(date, price),
			annualYieldNetToday: settlementAsset!.computeYieldNet(date, price),
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
	const [data, setData] = useState<FinancialAssetRow[]>([]);
	const [ownerName, setOwnerName] = useState<string>(name);
	const [deleteConfirmState, setDeleteConfirmState] = useState({
		isConfirming: false,
		timeoutId: null as NodeJS.Timeout | null,
	});

	// Update local state when name prop changes
	useEffect(() => {
		setOwnerName(name);
	}, [name]);

	// Handle name changes from within this component or from imported data
	const handleNameChange = useCallback((newName: string) => {
		setOwnerName(newName);
		// Propagate the name change to the parent component if callback exists
		if (onNameChange) {
			onNameChange(newName);
		}
	}, [onNameChange]);

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
			NaN
		);

		// Create a row using the financial asset's JSON data with additional UI fields
		const shortId = generateShortId();
		const emptyAsset: FinancialAssetRow = {
			 ...JSON.parse(JSON.stringify(emptyFinancialAsset.dict)), // Safer approach than using 'as any'
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
		setData((previousData) => [...previousData, recalculateDerivedFields(emptyAsset)]);
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
		setData((previousData) => previousData.filter((item) => item._rowId !== row._rowId));
	}, []);

	// This function handles data updates from the DataTable component
	const handleDataChange = useCallback((newData: FinancialAssetRow[]) => {
		setData(newData.map((row) => recalculateDerivedFields(row)));
	}, []);

	const handleDeleteRowUnknown = useCallback((row: unknown) => {
		handleDeleteRow(row as FinancialAssetRow);
	}, [handleDeleteRow]);

	const handleDataChangeUnknown = useCallback((rows: unknown[]) => {
		handleDataChange(rows as FinancialAssetRow[]);
	}, [handleDataChange]);

	const serializeRowUnknown = useCallback((row: unknown) => {
		return sanitizeRowForPersistence(row as FinancialAssetRow);
	}, []);

	const deserializeRowUnknown = useCallback((row: unknown) => {
		return rehydrateRowFromPersistence(row as PersistedFinancialAssetRow);
	}, []);

	// This function will handle cell updates
	const handleUpdateData = (
		rowIndex: number,
		columnId: string,
		value: unknown,
	) => {
		if (rowIndex < 0 || rowIndex >= data.length) {
			return;
		}

		const previousRow = data[rowIndex];
		const previousValue = previousRow[columnId as keyof FinancialAssetRow];
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
						typeof value === "string" || typeof value === "number" ? value : NaN,
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

		const isin = String(value || "").trim();
		if (isin.length !== 12) {
			return;
		}

		const latestPriceDate = getLatestPriceEntry(previousRow.priceByDate)?.dateKey;
		const todayDateKey = toDateKey(new Date());
		const shouldRefetch = !isSameValue || latestPriceDate !== todayDateKey;
		if (!shouldRefetch) {
			return;
		}

		setData((currentData) => currentData.map((currentRow, currentIdx) => {
			if (currentIdx !== rowIndex) {
				return currentRow;
			}
			return {
				...currentRow,
				name: "Loading data...",
			};
		}));

		fetchBorsaItalianaData(isin)
			.then((bondData) => {
				setData((currentData) => {
					return currentData.map((currentRow, currentIdx) => {
						if (currentIdx !== rowIndex) {
							return currentRow;
						}

						const normalizedPrice = normalizeNumber(bondData.price.last || 0);
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
				console.error(`Error fetching data for ISIN ${isin}:`, error);
				setData((currentData) => {
					return currentData.map((currentRow, currentIdx) => {
						if (currentIdx !== rowIndex) {
							return currentRow;
						}
						return {
							...currentRow,
							name: "Data fetch failed",
						};
					});
				});
			});
	};

	const renderRowDetails = useCallback((row: FinancialAssetRow) => {
		const historicalRows = buildHistoricalRows(row);
		return (
			<div className="space-y-3">
				<div>
					<div className="font-medium">ISIN</div>
					<div className="text-sm">{row.isin || "N/A"}</div>
				</div>
				<div>
					<div className="font-medium">Nome</div>
					<div className="text-sm">{row.name || "N/A"}</div>
				</div>
				<div>
					<div className="font-medium mb-2">Storico Prezzi</div>
					{historicalRows.length === 0 ? (
						<div className="text-sm">Nessun dato storico disponibile.</div>
					) : (
						<div className="space-y-2">
							{historicalRows.map((entry) => (
								<div key={entry.dateKey} className="rounded border p-2 text-sm">
									<div>Data: {entry.dateKey}</div>
									<div>Prezzo: {entry.price.toFixed(3)} €</div>
									<div>Rend. Lordo: {entry.annualYieldGrossToday.toFixed(2)}%</div>
									<div>Rend. Netto: {entry.annualYieldNetToday.toFixed(2)}%</div>
									<div>Controvalore: {entry.totalValueToday.toFixed(2)} €</div>
									<div>Differenza: {entry.totalValueDifference.toFixed(2)} €</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}, []);

	const renderRowDetailsUnknown = useCallback((row: unknown) => {
		return renderRowDetails(row as FinancialAssetRow);
	}, [renderRowDetails]);

	return (
		<div className="px-4 mx-auto py-5">
			<DataTable
				columns={columns as unknown as Parameters<typeof DataTable>[0]["columns"]}
				data={data as unknown as Parameters<typeof DataTable>[0]["data"]}
				name={ownerName}
				onAddRow={handleAddRow}
				onDeleteAllRows={handleDeleteAllRows}
				onDeleteRow={handleDeleteRowUnknown}
				onNameChange={handleNameChange} // Use our wrapper function
				onDataChange={handleDataChangeUnknown}
				localStorageKey={LOCAL_STORAGE_KEY}
				serializeRow={serializeRowUnknown}
				deserializeRow={deserializeRowUnknown}
				renderRowDetails={renderRowDetailsUnknown}
				meta={{
					updateData: handleUpdateData,
					deleteConfirmState: deleteConfirmState.isConfirming,
				}}
			/>
		</div>
	);
}
