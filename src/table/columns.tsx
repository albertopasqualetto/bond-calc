"use client";

import { ColumnDef, CellContext } from "@tanstack/react-table";
import { KeyboardEvent } from "react";
import {
	EditableTextCell,
	EditableDatePickerCell,
	SuffixEditableTextCell,
	EditableSelectCell,
} from "@/components/table-editable-fields/editable-fields";
import { FinancialAsset } from "@/lib/financialAsset";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type FinancialAssetRow = FinancialAsset & {
	name: string;
	annualYieldGross?: number;
	annualYieldNet?: number;
	todayPrice?: number;
	annualYieldGrossToday?: number;
	annualYieldNetToday?: number;
	totalValueNominal?: number;
	totalValueSettlement?: number;
	totalValueToday?: number;
	totalValueDifference?: number;
	notes?: string;
};

// Validation function for numeric inputs
const validateNumericInput = (e: KeyboardEvent<HTMLInputElement>) => {
  // Allow: backspace, delete, tab, escape, enter, arrows
  if ([
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End'
  ].includes(e.key)) {
    return;
  }
  // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if ((e.ctrlKey || e.metaKey) &&
    ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    return;
  }

  // Substitute comma with dot
  if (e.key === ',') {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;

    // Combine the value before and after the cursor with a dot
    const newValue =
      input.value.substring(0, start) +
      '.' +
      input.value.substring(end);

    input.value = newValue;

    // Reset the cursor position after the dot
    input.setSelectionRange(start + 1, start + 1);

    return;
  }

  // Allow: numbers and period
  if (/^[0-9.]$/.test(e.key)) {
    return;
  }
  // Block everything else
  e.preventDefault();
};

// Helper to check if a value is a valid number
const isValidNumber = (value: any): boolean => {
  if (value === undefined || value === null || value === '') return true;
  return !isNaN(parseFloat(String(value))) && isFinite(Number(value));
};

export const columns: ColumnDef<FinancialAsset>[] = [
	{
		accessorKey: "isin",
		header: "ISIN",
		cell: (props) => {
			const value = props.getValue() as string;
			const isValid = value?.length === 12;
			return (
				<EditableTextCell
					{...(props as CellContext<FinancialAsset, string>)}
					className={`w-[15ch] min-w-[15ch] max-w-[15ch] ${!isValid && value ? 'border-red-500 bg-red-50' : ''}`}
					placeholder="ISIN"
				/>
			);
		},
	},
	{
		accessorKey: "name",
		header: "Nome",
		cell: (props) => {
			return (
				<EditableTextCell
					{...(props as CellContext<FinancialAsset, string>)}
					className={"w-[24ch] min-w-[24ch]"}
				/>
			);
		},
	},
	{
		accessorKey: "totalValueNominal",
		header: "Nominale",
		cell: (props) => {
			const value = props.getValue();
			const isValid = isValidNumber(value);
			return (
				<SuffixEditableTextCell
					{...(props as CellContext<FinancialAsset, number>)}
					suffix="€"
					className={`min-w-[11ch] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
					onKeyDown={validateNumericInput}
				/>
			);
		},
	},
	{
		accessorKey: "maturityDate",
		header: "Scadenza",
		meta: { printable: false },
		cell: (props) => (
			<EditableDatePickerCell
				{...(props as CellContext<FinancialAsset, Date>)}
			/>
		),
	},
	{
		accessorKey: "couponRatePerc",
		header: "Cedola",
		meta: { printable: false },
		cell: (props) => {
			const value = props.getValue();
			const isValid = isValidNumber(value);
			return (
				<SuffixEditableTextCell
					{...(props as CellContext<FinancialAsset, number>)}
					suffix="%"
					className={`min-w-[5em] max-w-[6em] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
					onKeyDown={validateNumericInput}
				/>
			);
		},
	},
	{
		accessorKey: "capitalGainTaxPerc",
		header: "Tassazione",
		meta: { printable: false },
		cell: (props) => (
			<EditableSelectCell
				{...(props as CellContext<FinancialAsset, string>)}
				options={[
					{ label: "0%", value: "0" },
					{ label: "12,5%", value: "12.5" },
					{ label: "26%", value: "26" },
				]}
				placeholder="Tassazione"
				className={"w-[6em] gap-1"}
			/>
		)
	},
	{
		accessorKey: "settlementDate",
		header: "Data PMC",
		cell: (props) => (
			<EditableDatePickerCell
				{...(props as CellContext<FinancialAsset, Date>)}
			/>
		),
	},
	{
		accessorKey: "settlementPrice",
		header: "PMC",
		cell: (props) => {
			const value = props.getValue();
			const isValid = isValidNumber(value);
			return (
				<SuffixEditableTextCell
					{...(props as CellContext<FinancialAsset, number>)}
					suffix="€"
					className={`min-w-[6em] max-w-[8em] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
					onKeyDown={validateNumericInput}
				/>
			);
		},
	},
	{
		accessorKey: "redemptionPrice",
		header: "Rimborso",
		cell: (props) => {
			const value = props.getValue();
			const isValid = isValidNumber(value);
			return (
				<SuffixEditableTextCell
					{...(props as CellContext<FinancialAsset, number>)}
					suffix="€"
					className={`min-w-[6em] max-w-[8em] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
					onKeyDown={validateNumericInput}
				/>
			);
		},
	},
	{
		header: "Rendimento",
		columns: [
			{
				accessorKey: "annualYieldGross",
				header: "Lordo",
				cell: (props) => {
					return (
						<span className="flex font-bold">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>%</span>
						</span>
					);
				},
			},
			{
				accessorKey: "annualYieldNet",
				header: "Netto",
				cell: (props) => {
					if (props.row.original.capitalGainTaxPerc == 0) {
						return null; // Hide the value if tax is 0%
					}

					return (
						<span className="flex font-bold">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>%</span>
						</span>
					);
				},
			},
		],
	},
	{
		header: "Rendimento Vendendo Oggi",
		columns: [
			{
				accessorKey: "todayPrice",
				header: "Prezzo Oggi",
				cell: (props) => {
					const value = props.getValue();
					const isValid = isValidNumber(value);
					return (
						<SuffixEditableTextCell
							{...(props as CellContext<FinancialAsset, number>)}
							suffix="€"
							className={`min-w-[6em] max-w-[8em] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
							onKeyDown={validateNumericInput}
						/>
					);
				},
			},
			{
				accessorKey: "annualYieldGrossToday",
				header: "Lordo",
				cell: (props) => {
					return (
						<span className="flex font-bold italic">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>%</span>
						</span>
					);
				},
			},
			{
				accessorKey: "annualYieldNetToday",
				header: "Netto",
				cell: (props) => {
					if (props.row.original.capitalGainTaxPerc == 0) {
						return null; // Hide the value if tax is 0%
					}

					return (
						<span className="flex font-bold italic">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>%</span>
						</span>
					);
				},
			},
		],
	},
	{
		header: "Controvalore",
		columns: [
			{
				accessorKey: "totalValueSettlement",
				header: "Acquisto",
				cell: (props) => {
					return (
						<span className="flex font-bold">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>€</span>
						</span>
					);
				},
			},
			{
				accessorKey: "totalValueToday",
				header: "Oggi",
				cell: (props) => {
					return (
						<span className="flex font-bold">
							<span className="mr-auto">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span>€</span>
						</span>
					);
				},
			},
			{
				accessorKey: "totalValueDifference",
				header: "Differenza",
				cell: (props) => {
					const value = (props as CellContext<FinancialAsset, number>).getValue();
					const isPositive = value > 0;
					const isNegative = value < 0;
					const textColorClass = isPositive ? "text-green-600" : isNegative ? "text-red-600" : "";

					return (
						<span className={`flex font-bold ${textColorClass}`}>
							{value !== undefined && value !== null && (
								<span>{isPositive ? "+" : isNegative ? "-" : ""}</span>
							)}
							<span className="mr-auto">
								{value?.toFixed(2)}
							</span>
							<span>€</span>
						</span>
					);
				},
			},
		],
	},
	{
		accessorKey: "notes",
		header: "Note",
		cell: (props) => (
			<EditableTextCell
				{...(props as CellContext<FinancialAsset, string>)}
				className="w-full h-auto min-w-[18ch] max-w-[21ch] resize-y overflow-hidden"
				multiline={true}
			/>
		),
	},
];
