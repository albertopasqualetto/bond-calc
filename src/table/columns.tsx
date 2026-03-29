"use client";

import { ColumnDef, CellContext } from "@tanstack/react-table";
import { KeyboardEvent, useMemo } from "react";
import {
	EditableTextCell,
	EditableDatePickerCell,
	LocalizedSuffixEditableTextCell,
	EditableSelectCell,
} from "@/components/table-editable-fields";
import { FinancialAsset } from "@/lib/financialAsset";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatPercent, normalizeNumber } from "@/utils/number";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
type FinancialAssetBaseFromModel = Pick<
	FinancialAsset,
	| "isin"
	| "issuingDate"
	| "settlementDate"
	| "maturityDate"
	| "couponRatePerc"
	| "settlementPrice"
	| "redemptionPrice"
	| "yearlyFrequency"
	| "capitalGainTaxPerc"
	| "priceByDate"
>;

export type FinancialAssetBaseRow = Omit<
	FinancialAssetBaseFromModel,
	"capitalGainTaxPerc"
> & {
	capitalGainTaxPerc: number | string;
	name: string;
	totalValueNominal?: number;
	notes?: string;
};

export type FinancialAssetRowCalculated = {
	annualYieldGross?: number;
	annualYieldNet?: number;
	todayPrice?: number;
	annualYieldGrossToday?: number;
	annualYieldNetToday?: number;
	totalValueSettlement?: number;
	totalValueToday?: number;
	totalValueDifference?: number;
	_rowId?: string; // Unique identifier for this row instance
};

export type FinancialAssetRow = FinancialAssetBaseRow &
	FinancialAssetRowCalculated;

// Validation function for numeric inputs
const validateNumericInput = (e: KeyboardEvent<HTMLInputElement>) => {
	// Allow: backspace, delete, tab, escape, enter, arrows
	if (
		[
			"Backspace",
			"Delete",
			"Tab",
			"Escape",
			"Enter",
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End",
		].includes(e.key)
	) {
		return;
	}
	// Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
	if (
		(e.ctrlKey || e.metaKey) &&
		["a", "c", "v", "x"].includes(e.key.toLowerCase())
	) {
		return;
	}

	// Substitute comma with dot
	if (e.key === ",") {
		e.preventDefault();
		const input = e.target as HTMLInputElement;
		const start = input.selectionStart || 0;
		const end = input.selectionEnd || 0;

		// Combine the value before and after the cursor with a dot
		const newValue =
			input.value.substring(0, start) + "." + input.value.substring(end);

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
const isValidNumber = (value: unknown): boolean => {
	if (value === undefined || value === null || value === "") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value === "string")
		return value.trim() === "" || Number.isFinite(normalizeNumber(value));
	return false;
};

const createTaxOptions = (locale: string) => {
	const taxValues = [0, 12.5, 26] as const;

	return taxValues.map((taxRate) => ({
		label: formatPercent(taxRate, locale, {
			minimumFractionDigits: Number.isInteger(taxRate) ? 0 : 1,
			maximumFractionDigits: 1,
		}),
		value: String(taxRate),
	}));
};

const createEditableNumericCell = (
	suffix: string,
	className: string,
	locale: string,
) => {
	return (props: CellContext<FinancialAssetRow, unknown>) => {
		const value = props.getValue();
		const isValid = isValidNumber(value);
		return (
			<LocalizedSuffixEditableTextCell
				{...(props as CellContext<FinancialAssetRow, string | number>)}
				suffix={suffix}
				locale={locale}
				className={`${className} ${!isValid ? "border-red-500 bg-red-500/10" : ""}`}
				onKeyDown={validateNumericInput}
			/>
		);
	};
};

const renderYieldCell = (
	props: CellContext<FinancialAssetRow, number>,
	locale: string,
	options?: { italic?: boolean; hideWhenZeroTax?: boolean },
) => {
	if (
		options?.hideWhenZeroTax &&
		props.row.original.capitalGainTaxPerc == 0
	) {
		return null;
	}

	const value = props.getValue();
	const hasValue = typeof value === "number" && Number.isFinite(value);
	const formattedValue = hasValue
		? formatPercent(value, locale, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})
		: "";

	return (
		<span className={`flex font-bold ${options?.italic ? "italic" : ""}`}>
			<span className="mr-auto">{formattedValue}</span>
		</span>
	);
};

const renderEuroValueCell = (
	props: CellContext<FinancialAssetRow, number>,
	locale: string,
) => {
	const value = props.getValue();
	const hasValue = typeof value === "number" && Number.isFinite(value);
	const formattedValue = hasValue
		? formatCurrency(value, locale, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})
		: "";

	return (
		<span className="flex font-bold">
			<span className="mr-auto">{formattedValue}</span>
		</span>
	);
};

export const useFinancialAssetColumns = (): ColumnDef<FinancialAssetRow>[] => {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || "en";
	const taxOptions = useMemo(() => createTaxOptions(locale), [locale]);

	return useMemo(
		() => [
			{
				accessorKey: "isin",
				header: t("table.headers.isin"),
				cell: (props) => {
					const value = props.getValue() as string;
					const isValid = value?.length === 12;
					return (
						<EditableTextCell
							{...(props as CellContext<
								FinancialAssetRow,
								string
							>)}
							className={`w-[15ch] min-w-[15ch] max-w-[15ch] ${!isValid && value ? "border-red-500 bg-red-500/10" : ""}`}
							placeholder={t("table.placeholders.isin")}
						/>
					);
				},
			},
			{
				accessorKey: "name",
				header: t("table.headers.name"),
				cell: (props) => {
					return (
						<EditableTextCell
							{...(props as CellContext<
								FinancialAssetRow,
								string
							>)}
							className={"w-[24ch] min-w-[24ch]"}
						/>
					);
				},
			},
			{
				accessorKey: "totalValueNominal",
				header: t("table.headers.nominal"),
				cell: createEditableNumericCell("€", "min-w-[11ch]", locale),
			},
			{
				accessorKey: "maturityDate",
				header: t("table.headers.maturity"),
				meta: { printable: false },
				cell: (props) => (
					<EditableDatePickerCell
						{...(props as CellContext<FinancialAssetRow, Date>)}
					/>
				),
			},
			{
				accessorKey: "couponRatePerc",
				header: t("table.headers.coupon"),
				meta: { printable: false },
				cell: createEditableNumericCell(
					"%",
					"min-w-[5em] max-w-[6em]",
					locale,
				),
			},
			{
				accessorKey: "capitalGainTaxPerc",
				header: t("table.headers.taxation"),
				meta: { printable: false },
				cell: (props) => (
					<EditableSelectCell
						{...(props as CellContext<FinancialAssetRow, string>)}
						options={taxOptions}
						placeholder={t("table.placeholders.taxation")}
						className={"w-[6em] gap-1"}
					/>
				),
			},
			{
				accessorKey: "settlementDate",
				header: t("table.headers.settlementDate"),
				cell: (props) => (
					<EditableDatePickerCell
						{...(props as CellContext<FinancialAssetRow, Date>)}
					/>
				),
			},
			{
				accessorKey: "settlementPrice",
				header: t("table.headers.settlementPrice"),
				cell: createEditableNumericCell(
					"€",
					"min-w-[6em] max-w-[8em]",
					locale,
				),
			},
			{
				accessorKey: "redemptionPrice",
				header: t("table.headers.redemption"),
				cell: createEditableNumericCell(
					"€",
					"min-w-[6em] max-w-[8em]",
					locale,
				),
			},
			{
				header: t("table.headers.yield"),
				columns: [
					{
						accessorKey: "annualYieldGross",
						header: t("table.headers.gross"),
						cell: (props) =>
							renderYieldCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
							),
					},
					{
						accessorKey: "annualYieldNet",
						header: t("table.headers.net"),
						cell: (props) =>
							renderYieldCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
								{
									hideWhenZeroTax: true,
								},
							),
					},
				],
			},
			{
				header: t("table.headers.yieldSellingToday"),
				columns: [
					{
						accessorKey: "todayPrice",
						header: t("table.headers.priceToday"),
						cell: createEditableNumericCell(
							"€",
							"min-w-[6em] max-w-[8em]",
							locale,
						),
					},
					{
						accessorKey: "annualYieldGrossToday",
						header: t("table.headers.gross"),
						cell: (props) =>
							renderYieldCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
								{
									italic: true,
								},
							),
					},
					{
						accessorKey: "annualYieldNetToday",
						header: t("table.headers.net"),
						cell: (props) =>
							renderYieldCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
								{
									italic: true,
									hideWhenZeroTax: true,
								},
							),
					},
				],
			},
			{
				header: t("table.headers.countervalue"),
				columns: [
					{
						accessorKey: "totalValueSettlement",
						header: t("table.headers.purchase"),
						cell: (props) =>
							renderEuroValueCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
							),
					},
					{
						accessorKey: "totalValueToday",
						header: t("table.headers.today"),
						cell: (props) =>
							renderEuroValueCell(
								props as CellContext<FinancialAssetRow, number>,
								locale,
							),
					},
					{
						accessorKey: "totalValueDifference",
						header: t("table.headers.difference"),
						cell: (props) => {
							const value = (
								props as CellContext<FinancialAssetRow, number>
							).getValue();
							const hasValue =
								typeof value === "number" &&
								Number.isFinite(value);
							const isPositive = hasValue && value > 0;
							const isNegative = hasValue && value < 0;
							const textColorClass = isPositive
								? "text-green-600"
								: isNegative
									? "text-red-600"
									: "";
							const formattedValue = hasValue
								? formatCurrency(Math.abs(value), locale, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})
								: "";

							return (
								<span
									className={`flex font-bold ${textColorClass}`}
								>
									{hasValue && (
										<span>
											{isPositive
												? "+"
												: isNegative
													? "-"
													: ""}
										</span>
									)}
									<span className="mr-auto">
										{formattedValue}
									</span>
								</span>
							);
						},
					},
				],
			},
			{
				accessorKey: "notes",
				header: t("table.headers.notes"),
				cell: (props) => (
					<EditableTextCell
						{...(props as CellContext<FinancialAssetRow, string>)}
						className="w-full h-auto min-w-[18ch] max-w-[21ch] resize-y overflow-hidden"
						multiline={true}
					/>
				),
			},
		],
		[locale, t, taxOptions],
	);
};
