"use client";

import { ColumnDef, CellContext } from "@tanstack/react-table";
import { KeyboardEvent } from "react";
import {
	EditableTextCell,
	EditableDatePickerCell,
	SuffixEditableTextCell,
	EditableSelectCell,
} from "./editable-fields";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type FinancialAsset = {
	isin: string;
	name: string;
	settlementDate: Date;
	maturityDate: Date;
	couponRatePerc: number;
	capitalGainTaxPerc: number;
	settlementPrice: number;
	redemptionPrice: number;
	yearlyFrequency: number;
	annualYieldGross: number;
	annualYieldNet: number;
	todayPrice?: number;
	annualYieldGrossToday?: number;
	annualYieldNetToday?: number;
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
		accessorKey: "maturityDate",
		header: "Data Scadenza",
		meta: { printable: false },
		cell: (props) => (
			<EditableDatePickerCell
				{...(props as CellContext<FinancialAsset, Date>)}
			/>
		),
	},
	{
		accessorKey: "couponRatePerc",
		header: "Tasso Cedola",
		meta: { printable: false },
		cell: (props) => {
			const value = props.getValue();
			const isValid = isValidNumber(value);
			return (
				<SuffixEditableTextCell
					{...(props as CellContext<FinancialAsset, number>)}
					suffix="%"
					className={`min-w-[4em] max-w-[6em] ${!isValid ? 'border-red-500 bg-red-50' : ''}`}
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
				{...(props as CellContext<FinancialAsset, number>)}
				options={[
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
		header: "Data Acquisto",
		cell: (props) => (
			<EditableDatePickerCell
				{...(props as CellContext<FinancialAsset, Date>)}
			/>
		),
	},
	{
		accessorKey: "settlementPrice",
		header: "Prezzo Acquisto",
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
		header: "Prezzo Rimborso",
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
						<span className="flex">
							<span className="mr-auto font-bold">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span className="font-bold">%</span>
						</span>
					);
				},
			},
			{
				accessorKey: "annualYieldNet",
				header: "Netto",
				cell: (props) => {
					return (
						<span className="flex">
							<span className="mr-auto font-bold">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span className="font-bold">%</span>
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
						<span className="flex">
							<span className="mr-auto font-bold italic">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span className="font-bold italic">%</span>
						</span>
					);
				},
			},
			{
				accessorKey: "annualYieldNetToday",
				header: "Netto",
				cell: (props) => {
					return (
						<span className="flex">
							<span className="mr-auto font-bold italic">
								{(props as CellContext<FinancialAsset, number>).getValue()?.toFixed(2)}
							</span>
							<span className="font-bold italic">%</span>
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
				className="w-full min-w-[18ch] max-w-[40ch]"
				multiline={true}
			/>
		),
	},
];
