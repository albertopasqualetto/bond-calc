"use client";

import { useState, useEffect } from "react";
import { FinancialAssetRow, columns } from "./columns";
import { DataTable } from "./data-table";
import { createDate, isDateToday } from "@/utils/date";
import { fetchBorsaItalianaData } from "@/fetching/fetchBorsaItaliana";
import { FinancialAsset } from "@/lib/financialAsset";

// Local storage key for saving financial assets data
const LOCAL_STORAGE_KEY = "financial-assets-data";

function mockData(): FinancialAssetRow[] {
	// Create financial asset instances
	const asset1 = new FinancialAsset(
		"IT0005445306",
		createDate(2025, 3, 7),
		createDate(2028, 7, 15),
		0.5,
		92.81,
		100,
		2,
		"12.5"
	);

	const asset2 = new FinancialAsset(
		"IT0005441883",
		createDate(2025, 3, 5),
		createDate(2072, 3, 1),
		2.15,
		57.8,
		100,
		2,
		"12.5"
	);

	// Get JSON data from assets and add additional UI-specific fields
	return [
		{
			...JSON.parse(JSON.stringify(asset1.dict)),
			name: "Btp Tf 0,5% Lg28 Eur",
			capitalGainTaxPerc: (asset1.dict.capitalGainTaxPerc as string),
			settlementDate: new Date(asset1.dict.settlementDate as string),
			maturityDate: new Date(asset1.dict.maturityDate as string),
			annualYieldGross: asset1.computeYield(),
			annualYieldNet: asset1.computeYieldNet(),
			todayPrice: 92.81,
			annualYieldGrossToday: asset1.computeYield(new Date(), 92.81),
			annualYieldNetToday: asset1.computeYieldNet(new Date(), 92.81),
			notes: "Test note 1",
		},
		{
			...JSON.parse(JSON.stringify(asset2.dict)),
			name: "Btp Tf 2,15% Mz72 Eur",
			capitalGainTaxPerc: (asset2.dict.capitalGainTaxPerc as string),
			settlementDate: new Date(asset2.dict.settlementDate as string),
			maturityDate: new Date(asset2.dict.maturityDate as string),
			annualYieldGross: asset2.computeYield(),
			annualYieldNet: asset2.computeYieldNet(),
			todayPrice: 57.8,
			annualYieldGrossToday: asset2.computeYield(new Date(), 57.8),
			annualYieldNetToday: asset2.computeYieldNet(new Date(), 57.8),
			notes: "Test note 2",
		},
	];
}

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
	const handleNameChange = (newName: string) => {
		setOwnerName(newName);
		// Propagate the name change to the parent component if callback exists
		if (onNameChange) {
			onNameChange(newName);
		}
	};

	const handleAddRow = () => {
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
		const emptyAsset: FinancialAssetRow = {
			 ...JSON.parse(JSON.stringify(emptyFinancialAsset.dict)), // Safer approach than using 'as any'
			name: "",
			annualYieldGross: NaN,
			annualYieldNet: NaN,
			todayPrice: NaN,
			annualYieldGrossToday: NaN,
			annualYieldNetToday: NaN,
			notes: ""
		};

		// Add the new empty row to the data
		setData([...data, emptyAsset]);
	};

	const handleDeleteAllRows = () => {
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
	};

	const handleDeleteRow = (row: FinancialAssetRow) => {
		// Use ISIN as a unique identifier to filter out the row to delete
		// If ISIN is empty (for a new row), compare by object reference
		if (row.isin) {
			setData(data.filter(item => item.isin !== row.isin));
		} else {
			// For newly added rows without an ISIN, use object reference comparison
			setData(data.filter(item => item !== row));
		}
	};

	// This function handles data updates from the DataTable component
	const handleDataChange = (newData: FinancialAssetRow[]) => {
		setData(newData);
	};

	// This function will handle cell updates
	const handleUpdateData = (
		rowIndex: number,
		columnId: string,
		value: any,
	) => {
			if (!value || rowIndex < 0 || rowIndex >= data.length) return;
			
			// Fast return if the value hasn't changed
			const previousValue = data[rowIndex][columnId];
			if (value == previousValue) {
				console.log("Value unchanged, skipping update:", columnId, value);
				return;
			}

			// Use functional update pattern to maintain proper immutability
			setData(prevData => {
				console.log("setData prevData", prevData, "rowIndex", rowIndex, "columnId", columnId, "value", value, "as type", typeof value, "previousValue", previousValue, "as type", typeof previousValue);
				// Map through rows creating a new array
				return prevData.map((row, idx) => {
					// Only update the specific row that changed
					if (idx === rowIndex) {
						// Create new object with updated field
						const updatedRow = {
							...row,
							[columnId]: value,
						};

						// Special handling for ISIN changes
						if (columnId === "isin") {
							// Update name immediately to show loading state
							updatedRow.name = "Loading data...";

							// Fetch data asynchronously
							fetchBorsaItalianaData(value)
								.then((bondData) => {
									setData((currentData) => {
										return currentData.map((currentRow, currentIdx) => {
											if (currentIdx === rowIndex) {
												if (bondData) {
													return {
														...currentRow,
														name: bondData.title,
														issuingDate: bondData.info.issuingDate,
														maturityDate: bondData.info.maturityDate,
														couponRatePerc: bondData.info.couponRate,
														yearlyFrequency:
															bondData.info.couponFrequency ||
															(() => {
																throw new Error(
																	`Yearly frequency not present for ISIN ${value}`,
																);
															})(),
														todayPrice: bondData.price.last || 0,
														settlementPrice: isDateToday(currentRow.settlementDate)
															? bondData.price.last || 0
															: currentRow.settlementPrice,
													};
												} else {
													// Handle case when bondData is falsy
													return {
														...currentRow,
														name: "No data available"
													};
												}
											}
											return currentRow;
										});
									});
								})
								.catch((error) => {
									console.error(
										`Error fetching data for ISIN ${value}:`,
										error,
									);
									setData((currentData) => {
										return currentData.map((currentRow, currentIdx) => {
											if (currentIdx === rowIndex) {
												return {
													...currentRow,
													name: "Data fetch failed"
												};
											}
											return currentRow;
										});
									});
								});
						}

						// Check if any field relevant to yield calculation has changed
						const calculateYieldRelevantFields = [
							"isin",
							"maturityDate",
							"couponRatePerc",
							"capitalGainTaxPerc",
							"settlementDate",
							"settlementPrice",
							"redemptionPrice",
							"yearlyFrequency",
							"todayPrice"
						];

						if (calculateYieldRelevantFields.includes(columnId)) {
							console.log("-------------------------------------------------\nCalculating yield for :", updatedRow.isin);
							if (columnId !== "todayPrice") {
								updatedRow.annualYieldGross = NaN;
								updatedRow.annualYieldNet = NaN;
							}
							updatedRow.annualYieldGrossToday = NaN;
							updatedRow.annualYieldNetToday = NaN;

							try {
								// Calculate settlement date yields
								console.log("Calculating base yield")
								if (columnId !== "todayPrice") {
									const settlementAsset = new FinancialAsset(
										updatedRow.isin,
										updatedRow.settlementDate,
										updatedRow.maturityDate,
										updatedRow.couponRatePerc,
										updatedRow.settlementPrice,
										updatedRow.redemptionPrice,
										updatedRow.yearlyFrequency,
										updatedRow.capitalGainTaxPerc,
										updatedRow.issuingDate
									);
									console.log("Coupon cashflows", settlementAsset.couponCashflows);

									console.log("Cashflows gross", structuredClone(settlementAsset.toIrrCashflows()));
									console.log("Cashflows net", structuredClone(settlementAsset.toIrrCashflowsNet()));
									updatedRow.annualYieldGross = settlementAsset.computeYield();
									updatedRow.annualYieldNet = settlementAsset.computeYieldNet();
								}

								// Calculate today's yields
								if (updatedRow.todayPrice) {
									console.log("Calculating yield if selling today")
									const today = new Date();
									today.setHours(0, 0, 0, 0);

									const todayAsset = new FinancialAsset(
										updatedRow.isin,
										updatedRow.settlementDate,
										updatedRow.maturityDate,
										updatedRow.couponRatePerc,
										updatedRow.settlementPrice,
										updatedRow.redemptionPrice,
										updatedRow.yearlyFrequency,
										updatedRow.capitalGainTaxPerc,
										updatedRow.issuingDate
									);

									console.log("Cashflows gross today", structuredClone(todayAsset.toIrrCashflows(today, updatedRow.todayPrice)));
									console.log("Cashflows net today", structuredClone(todayAsset.toIrrCashflowsNet(today, updatedRow.todayPrice)));
									updatedRow.annualYieldGrossToday = todayAsset.computeYield(today, updatedRow.todayPrice);
									updatedRow.annualYieldNetToday = todayAsset.computeYieldNet(today, updatedRow.todayPrice);
								} else {
									console.warn("Today's price is missing for calculation");
								}
							} catch (error) {
								console.error("Error calculating yield:", error);
							}
						}

						return updatedRow;
					}

					// Return unchanged rows as they were
					return row;
				});
			});
		};

	return (
		<div className="px-5 mx-auto py-10">
			<DataTable
				columns={columns}
				data={data}
				name={ownerName}
				onAddRow={handleAddRow}
				onDeleteAllRows={handleDeleteAllRows}
				onDeleteRow={handleDeleteRow}
				onNameChange={handleNameChange} // Use our wrapper function
				onDataChange={handleDataChange}
				localStorageKey={LOCAL_STORAGE_KEY}
				// defaultData={mockData()}
				meta={{
					updateData: handleUpdateData,
					deleteConfirmState: deleteConfirmState.isConfirming,
				}}
			/>
		</div>
	);
}
