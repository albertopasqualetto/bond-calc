"use client";

import type { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { JSX, useState, ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils";
import { formatNumber, normalizeNumber } from "@/utils/number";

type InputLikeProps = Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "defaultValue" | "onChange" | "onBlur">;

type TableMetaUpdater = {
	updateData?: (rowIndex: number, columnId: string, value: unknown) => void;
};

type UnsafeCellContextProps = {
	renderValue?: unknown;
	cell?: unknown;
};

const omitCellContextProps = <TProps extends Record<string, unknown>>(
	props: TProps,
): Omit<TProps, keyof UnsafeCellContextProps> => {
	const { renderValue, cell, ...safeProps } = props as TProps & UnsafeCellContextProps;
	void renderValue;
	void cell;
	return safeProps as Omit<TProps, keyof UnsafeCellContextProps>;
};

const callUpdateData = <T extends object>(
	table: CellContext<T, unknown>["table"],
	rowIndex: number,
	columnId: string,
	value: unknown,
) => {
	(table.options.meta as TableMetaUpdater | undefined)?.updateData?.(rowIndex, columnId, value);
};

const formatDateInputValue = (value: Date | undefined): string => {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		return "";
	}

	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | undefined => {
	if (!value) {
		return undefined;
	}

	const [yearPart, monthPart, dayPart] = value.split("-");
	const year = Number(yearPart);
	const month = Number(monthPart);
	const day = Number(dayPart);

	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
		return undefined;
	}

	const parsedDate = new Date(year, month - 1, day);
	if (Number.isNaN(parsedDate.getTime())) {
		return undefined;
	}

	return parsedDate;
};

const getFractionDigits = (value: string): number => {
	const trimmedValue = value.trim();
	const lastSeparatorIndex = Math.max(trimmedValue.lastIndexOf("."), trimmedValue.lastIndexOf(","));

	if (lastSeparatorIndex < 0) {
		return 0;
	}

	const fractionPart = trimmedValue.slice(lastSeparatorIndex + 1);
	if (!/^\d+$/.test(fractionPart)) {
		return 0;
	}

	return fractionPart.length;
};

const formatNumericInputDisplayValue = (value: string | number, locale: string): string => {
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			return "";
		}

		return formatNumber(value, locale);
	}

	const trimmedValue = value.trim();
	if (trimmedValue === "") {
		return "";
	}

	const parsed = normalizeNumber(trimmedValue);
	if (!Number.isFinite(parsed)) {
		return value;
	}

	const fractionDigits = getFractionDigits(trimmedValue);
	return formatNumber(parsed, locale, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
};

const toEditableNumericInputValue = (value: string | number): string => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}

	const trimmedValue = value.trim();
	if (trimmedValue === "") {
		return "";
	}

	const parsed = normalizeNumber(trimmedValue);
	if (!Number.isFinite(parsed)) {
		return value;
	}

	return String(parsed);
};

const toNumericCommitValue = (value: string): string | number => {
	const trimmedValue = value.trim();
	if (trimmedValue === "") {
		return "";
	}

	const parsed = normalizeNumber(trimmedValue);
	if (!Number.isFinite(parsed)) {
		return value;
	}

	return parsed;
};

type EditableTextFieldProps = {
	initialValue: string;
	multiline?: boolean;
	className?: string;
	safeProps: InputLikeProps;
	onCommit: (nextValue: string) => void;
};

type LocalizedNumericInputFieldProps = {
	initialValue: string | number;
	className?: string;
	safeProps: InputLikeProps;
	locale: string;
	onCommit: (nextValue: string | number) => void;
};

const EditableTextField = ({
	initialValue,
	multiline,
	className,
	safeProps,
	onCommit,
}: EditableTextFieldProps): JSX.Element => {
	const [value, setValue] = useState<string>(initialValue);

	const handleBlur = () => {
		onCommit(value);
	};

	return multiline ? (
		<Textarea
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			rows={2}
			cols={200}
			className={cn("min-h-[30px] min-w-[200px]", className)}
		/>
	) : (
		<Input
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			className={className}
			{...safeProps}
		/>
	);
};

const LocalizedNumericInputField = ({
	initialValue,
	className,
	safeProps,
	locale,
	onCommit,
}: LocalizedNumericInputFieldProps): JSX.Element => {
	const [lastCommittedValue, setLastCommittedValue] = useState<string | number>(initialValue);
	const [value, setValue] = useState<string>(() => formatNumericInputDisplayValue(initialValue, locale));

	const handleFocus = () => {
		setValue(toEditableNumericInputValue(lastCommittedValue));
	};

	const handleBlur = () => {
		const committedValue = toNumericCommitValue(value);
		setLastCommittedValue(committedValue);
		onCommit(committedValue);
		setValue(formatNumericInputDisplayValue(committedValue, locale));
	};

	return (
		<Input
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onFocus={handleFocus}
			onBlur={handleBlur}
			className={className}
			{...safeProps}
		/>
	);
};

export const EditableTextCell = <T extends object>({
	getValue,
	renderValue: strippedRenderValue,
	cell: strippedCell,
	row: { index },
	column: { id },
	table,
	multiline,
	className,
	...props
}: CellContext<T, string | number> &
	InputLikeProps & {
		multiline?: boolean;
		className?: string;
	}): JSX.Element => {
	const initialValue = getValue();
	const resetKey = `${index}:${String(id)}:${String(initialValue ?? "")}`;
	const textValue = String(initialValue ?? "");

	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);

	className = cn("print:w-full print:resize-none print:overflow-visible", className);

	return (
		<EditableTextField
			key={resetKey}
			initialValue={textValue}
			multiline={multiline}
			className={className}
			safeProps={safeProps}
			onCommit={(nextValue) => callUpdateData(table, index, String(id), nextValue)}
		/>
	);
};

export const SuffixEditableTextCell = <T extends object>({
	suffix,
	className,
	...props
}: CellContext<T, string | number> &
	InputLikeProps & {
		suffix: string;
		className?: string;
	}): JSX.Element => {
	return (
		<div className={cn("relative", className)}>
			<EditableTextCell className={className} {...props} />
			<span className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none">
				{suffix}
			</span>
		</div>
	);
};

export const LocalizedSuffixEditableTextCell = <T extends object>({
	getValue,
	renderValue: strippedRenderValue,
	cell: strippedCell,
	row: { index },
	column: { id },
	table,
	suffix,
	className,
	locale,
	...props
}: CellContext<T, string | number> &
	InputLikeProps & {
		suffix: string;
		className?: string;
		locale: string;
	}): JSX.Element => {
	const initialValue = getValue();
	const resetKey = `${index}:${String(id)}:${String(initialValue ?? "")}:${locale}`;
	const numericValue = typeof initialValue === "number" || typeof initialValue === "string"
		? initialValue
		: "";

	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);

	return (
		<div className={cn("relative", className)}>
			<LocalizedNumericInputField
				key={resetKey}
				initialValue={numericValue}
				className={className}
				safeProps={safeProps}
				locale={locale}
				onCommit={(nextValue) => callUpdateData(table, index, String(id), nextValue)}
			/>
			<span className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none">
				{suffix}
			</span>
		</div>
	);
};

export const EditableCheckboxCell = <T extends object>({
	getValue,
	renderValue: strippedRenderValue,
	cell: strippedCell,
	row: { index },
	column: { id },
	table,
	className,
	...props
}: CellContext<T, boolean> &
	ComponentPropsWithoutRef<typeof Checkbox> & {
		className?: string;
	}): JSX.Element => {
	const initialValue = getValue();
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);

	const handleChange = (checked: boolean | "indeterminate") => {
		const newValue = checked === true;
		callUpdateData(table, index, String(id), newValue);
	};

	return (
		<Checkbox
			className={cn("h-8 w-8", className)}
			checked={Boolean(initialValue)}
			onCheckedChange={handleChange}
			{...safeProps}
		/>
	);
};

export const EditableSelectCell = <T extends object>({
	getValue,
	renderValue: strippedRenderValue,
	cell: strippedCell,
	row,
	column,
	table,
	options,
	placeholder,
	className,
	...props
}: CellContext<T, string> & {
	options: { label: string; value: string }[];
	placeholder?: string;
	className?: string;
} & Omit<
		ComponentPropsWithoutRef<typeof Select>,
		"onValueChange" | "value" | "defaultValue"
	>) => {
	const initialValue = getValue();
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);
	const selectedValue =
		typeof initialValue === "string" || typeof initialValue === "number"
			? String(initialValue)
			: "";
	const selectedOption = options.find((option) => option.value === selectedValue);
	const resolvedPlaceholder = placeholder || t("table.placeholders.selectValue");

	function handleChange(value: unknown) {
		const nextValue = String(value);
		callUpdateData(table, row.index, String(column.id), nextValue);
	}

	return (
		<Select
			onValueChange={handleChange}
			value={selectedValue}
			open={open}
			onOpenChange={setOpen}
			{...safeProps}
		>
			<SelectTrigger className={className}>
				<SelectValue placeholder={resolvedPlaceholder}>{selectedOption?.label}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem value={option.value} key={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};

export const EditableDatePickerCell = <T extends object>({
	getValue,
	renderValue: strippedRenderValue,
	cell: strippedCell,
	row,
	column,
	table,
	className,
	...props
}: CellContext<T, Date> & {
	className?: string;
} & Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "defaultValue" | "onChange" | "onBlur">) => {
	const initialValue = getValue();
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);
	const inputValue = formatDateInputValue(initialValue);

	function handleChange(nextRawValue: string) {
		const nextDate = parseDateInputValue(nextRawValue);
		if (!nextDate) {
			return;
		}

		if (initialValue instanceof Date && initialValue.getTime() === nextDate.getTime()) {
			return;
		}

		callUpdateData(table, row.index, String(column.id), nextDate);
	}

	return (
		<div className={cn("w-[120px]", className)}>
			<Input
				type="date"
				value={inputValue}
				onChange={(e) => handleChange(e.target.value)}
				className="min-w-[120px]"
				{...safeProps}
			/>
		</div>
	);
};
