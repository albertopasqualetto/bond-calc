"use client";

import { useState, useEffect } from "react";
import { FinancialAsset, columns } from "./columns";
import { DataTable } from "./data-table";
import { createDate, isDateToday } from "@/utils/date.ts";
import { fetchBorsaItalianaData, BorsaItalianaData } from "@/fetching/fetchBorsaItaliana";
import { bondToIrrCashflows, cutCashflowsToDate, computeYieldFromCashflows } from "@/lib/irrAdapter";

// Local storage key for saving financial assets data
const LOCAL_STORAGE_KEY = "financial-assets-data";

function mockData(): FinancialAsset[] {
	return [
		{
			isin: "IT0005445306",
			name: "Btp Tf 0,5% Lg28 Eur",
			annualYieldGross: 2.781,
			annualYieldNet: 2,
			settlementDate: createDate(2025, 3, 7),
			maturityDate: createDate(2028, 7, 15),
			capitalGainTaxPerc: "12.5",
			couponRatePerc: 0.5,
			settlementPrice: 92.81,
			redemptionPrice: 100,
			yearlyFrequency: 2,
			todayPrice: 92.81,
			annualYieldGrossToday: 2.781,
			annualYieldNetToday: 2,
			notes: "Test note 1",
		},
		{
			isin: "IT0005441883",
			name: "Btp Tf 2,15% Mz72 Eur",
			annualYieldGross: 4.2675,
			annualYieldNet: 3.5,
			settlementDate: createDate(2025, 3, 5),
			maturityDate: createDate(2072, 3, 1),
			capitalGainTaxPerc: "12.5",
			couponRatePerc: 2.15,
			redemptionPrice: 100,
			settlementPrice: 57.8,
			yearlyFrequency: 2,
			todayPrice: 57.8,
			annualYieldGrossToday: 4.2675,
			annualYieldNetToday: 3.5,
			notes: "Test note 2",
		},
		// ...
	];
}

interface YieldsTableProps {
	name: string;
	onNameChange?: (name: string) => void; // Add this prop to pass name changes back to parent
}

export default function YieldsTable({ name, onNameChange }: YieldsTableProps) {
	const [data, setData] = useState<FinancialAsset[]>([]);
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
		// Create an empty financial asset with default values
		const emptyAsset: FinancialAsset = {
			isin: "",
			name: "",
			annualYieldGross: NaN,
			annualYieldNet: NaN,
			settlementDate: today,
			maturityDate: today,
			capitalGainTaxPerc: NaN,
			couponRatePerc: NaN,
			settlementPrice: NaN,
			redemptionPrice: 100,
			yearlyFrequency: NaN,
			todayPrice: NaN,
			annualYieldGrossToday: NaN,
			annualYieldNetToday: NaN,
			notes: "",
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

	const handleDeleteRow = (row: FinancialAsset) => {
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
	const handleDataChange = (newData: FinancialAsset[]) => {
		setData(newData);
	};

	// This function will handle cell updates
	const handleUpdateData = (
		rowIndex: number,
		columnId: string,
		value: any,
	) => {
		// Create a new data array to maintain immutability
		const newData = [...data];

		// Update the specified field directly
		newData[rowIndex] = {
			...newData[rowIndex],
			[columnId]: value,
		};

		if (columnId === "isin" && value) {
			// Show temporary name while fetching
			newData[rowIndex].name = "Loading data...";
			setData(newData);

			// Fetch data from Borsa Italiana API
			fetchBorsaItalianaData(value)
				.then((bondData) => {
					setData((prevData) => {
						const updatedData = [...prevData];
						// Update the relevant fields with the fetched data
						if (bondData) {
							updatedData[rowIndex] = {
								...updatedData[rowIndex],
								name: bondData.title,
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
								settlementPrice: isDateToday(
									updatedData[rowIndex].settlementDate,
								)
									? bondData.price.last || 0
									: updatedData[rowIndex].settlementPrice,
							};
						} else {
							throw new Error(`No data found for ISIN ${value}`);
						}
						return updatedData;
					});
				})
				.catch((error) => {
					console.error(
						`Error fetching data for ISIN ${value}:`,
						error,
					);
					// Set a fallback name on error
					setData((prevData) => {
						const updatedData = [...prevData];
						updatedData[rowIndex].name = "Data fetch failed";
						return updatedData;
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
			if (columnId !== "todayPrice") {
				newData[rowIndex].annualYieldGross = NaN;
				newData[rowIndex].annualYieldNet = NaN;
			}
			newData[rowIndex].annualYieldGrossToday = NaN;
			newData[rowIndex].annualYieldNetToday = NaN;
			setData(newData);

			const bond = newData[rowIndex];

			try {
				console.log("Calculating yield for bond:", bond.isin);
				const cashflowsGross = bondToIrrCashflows(
					bond.settlementDate,
					bond.maturityDate,
					bond.couponRatePerc,
					bond.settlementPrice,
					bond.redemptionPrice,
					bond.yearlyFrequency,
				);

				const cashflowsNet = bondToIrrCashflows(
					bond.settlementDate,
					bond.maturityDate,
					bond.couponRatePerc,
					bond.settlementPrice,
					bond.redemptionPrice,
					bond.yearlyFrequency,
					bond.capitalGainTaxPerc,
				);
				console.log("cashflowsGross", cashflowsGross);
				console.log("cashflowsNet", cashflowsNet);

				// Update the bond with the calculated yield
				if (columnId !== "todayPrice") {
					newData[rowIndex].annualYieldGross = computeYieldFromCashflows(cashflowsGross);
					newData[rowIndex].annualYieldNet = computeYieldFromCashflows(cashflowsNet);
				}

				if (!bond.todayPrice) {
					throw new Error("Today's price is missing");
				}

				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const cashflowsGrossToday = cutCashflowsToDate(cashflowsGross,
																today,
																bond.todayPrice,
																bond.settlementPrice,
																bond.couponRatePerc
															);
				newData[rowIndex].annualYieldGrossToday = computeYieldFromCashflows(cashflowsGrossToday);

				const cashflowsNetToday = cutCashflowsToDate(cashflowsNet,
																today,
																bond.todayPrice,
																bond.settlementPrice,
																bond.couponRatePerc,
																bond.capitalGainTaxPerc
															);
				console.log("cashflowsGrossToday", cashflowsGrossToday);
				console.log("cashflowsNetToday", cashflowsNetToday);
				newData[rowIndex].annualYieldNetToday = computeYieldFromCashflows(cashflowsNetToday);

			} catch (error) {
				console.error("Error calculating yield:", error);
				}
			}

		// Update the state with the modified data
		setData(newData);
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
				defaultData={mockData()}
				meta={{
					updateData: handleUpdateData,
					deleteConfirmState: deleteConfirmState.isConfirming,
				}}
			/>
		</div>
	);
}
