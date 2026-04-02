"use client";

import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	FinancialAssetRow,
	FinancialAssetRowCalculated,
	useFinancialAssetColumns,
} from "./columns";
import { DataTable } from "@/table/template";
import { FINANCIAL_ASSETS_LOCAL_STORAGE_KEY } from "@/constants";
import { fromDateKey, isDateToday, toDateKey } from "@/utils/date";
import { normalizeNumber } from "@/utils/number";
import { FinancialAsset } from "@/lib/financialAsset";
import { toast } from "sonner";

const RowDetails = lazy(() => import("@/table/row-details"));

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

const normalizeIsinValue = (value: unknown): string => {
	if (typeof value === "string") {
		return value.trim();
	}
	if (typeof value === "number") {
		return String(value).trim();
	}
	return "";
};

const calculateTotalValues = (row: FinancialAssetRow) => {
	const totalValueNominal = normalizeNumber(row.totalValueNominal ?? NaN);
	const redemptionPrice = normalizeNumber(row.redemptionPrice);
	const settlementPrice = normalizeNumber(row.settlementPrice);
	const todayPrice = normalizeNumber(row.todayPrice ?? NaN);

	const hasValidBaseValues =
		Number.isFinite(totalValueNominal) &&
		Number.isFinite(redemptionPrice) &&
		redemptionPrice !== 0;

	if (!hasValidBaseValues) {
		return {
			totalValueSettlement: NaN,
			totalValueToday: NaN,
			totalValueDifference: NaN,
		};
	}

	const totalValueSettlement = Number.isFinite(settlementPrice)
		? (totalValueNominal / redemptionPrice) * settlementPrice
		: NaN;
	const totalValueToday = Number.isFinite(todayPrice)
		? (totalValueNominal / redemptionPrice) * todayPrice
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

interface YieldsTableProps {
	name: string;
	onNameChange?: (name: string) => void; // Add this prop to pass name changes back to parent
}

export default function YieldsTable({ name, onNameChange }: YieldsTableProps) {
	const { t } = useTranslation();
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

	const refreshRowFromApi = useCallback(
		async (rowId: string, isin: string): Promise<void> => {
			const normalizedIsin = normalizeIsinValue(isin);
			if (normalizedIsin.length !== 12) {
				return;
			}

			const refreshPromise = (async () => {
				const todayDateKey = toDateKey(new Date());
				const { fetchBorsaItalianaData } =
					await import("@/fetching/fetchBorsaItaliana");
				const bondData = await fetchBorsaItalianaData(normalizedIsin);

				setData((currentData) => {
					return currentData.map((currentRow) => {
						if (currentRow._rowId !== rowId) {
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

				return bondData.title;
			})();

			// sonner exposes a runtime-typed API; keep usage centralized here.

			void toast.promise(refreshPromise, {
				loading: t("table.toasts.loading", { isin: normalizedIsin }),
				success: (title: unknown) =>
					t("table.toasts.success", {
						name:
							typeof title === "string" && title.trim().length > 0
								? title
								: normalizedIsin,
						isin: normalizedIsin,
					}),
				error: t("table.toasts.error", { isin: normalizedIsin }),
			});

			try {
				await refreshPromise;
			} catch (error) {
				console.error(
					`[refreshRowFromApi] Error fetching data for ISIN ${normalizedIsin}:`,
					error,
				);
				throw error;
			}
		},
		[t],
	);

	const handleRefreshAllRows = useCallback(() => {
		const rowsToRefresh = data
			.map((row) => ({
				rowId: row._rowId || "",
				isin: normalizeIsinValue(row.isin),
			}))
			.filter((row) => row.rowId.length > 0 && row.isin.length === 12);

		if (rowsToRefresh.length === 0) {
			return;
		}

		void Promise.allSettled(
			rowsToRefresh.map(({ rowId, isin }) =>
				refreshRowFromApi(rowId, isin),
			),
		);
	}, [data, refreshRowFromApi]);

	const handleRefreshRow = useCallback(
		(row: FinancialAssetRow) => {
			const rowId = row._rowId || "";
			const isin = normalizeIsinValue(row.isin);

			if (!rowId || isin.length !== 12) {
				return;
			}

			void refreshRowFromApi(rowId, isin);
		},
		[refreshRowFromApi],
	);

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

			const isin = normalizeIsinValue(value);

			if (isin.length !== 12) {
				return;
			}

			const latestPriceDate = getLatestPriceEntry(
				previousRow.priceByDate,
			)?.dateKey;
			const todayDateKey = toDateKey(new Date());
			const shouldRefetch = latestPriceDate !== todayDateKey;

			if (!shouldRefetch) {
				return;
			}

			void refreshRowFromApi(previousRow._rowId || "", isin);
		},
		[data, refreshRowFromApi],
	);

	const renderRowDetails = useCallback(
		(row: FinancialAssetRow) => {
			return (
				<Suspense
					fallback={
						<div className="text-sm">
							{t("table.status.loadingData")}
						</div>
					}
				>
					<RowDetails row={row} />
				</Suspense>
			);
		},
		[t],
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
				onRefreshRow={handleRefreshRow}
				onNameChange={handleNameChange} // Use our wrapper function
				onDataChange={handleDataChange}
				onRefreshAllRows={handleRefreshAllRows}
				localStorageKey={FINANCIAL_ASSETS_LOCAL_STORAGE_KEY}
				serializeRow={serializeRow}
				deserializeRow={deserializeRow}
				renderRowDetails={renderRowDetails}
				meta={tableMeta}
			/>
		</div>
	);
}
