"use client";

import type { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { JSX, useState, ComponentPropsWithoutRef } from "react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils";

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
	const [value, setValue] = useState<string>(String(initialValue ?? ""));
	const resetKey = `${index}:${String(id)}:${String(initialValue ?? "")}`;
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);

	className = cn("print:w-full print:resize-none print:overflow-visible", className);

	const handleBlur = () => {
		callUpdateData(table, index, String(id), value);
	};

	return multiline ? (
		<Textarea
			key={resetKey}
			value={String(value ?? "")}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			rows={2}
			cols={200}
			className={cn("min-h-[30px] min-w-[200px]", className)}
		/>
	) : (
		<Input
			key={resetKey}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			className={className}
			{...safeProps}
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
	placeholder="Select a value",
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
	const [open, setOpen] = useState(false);
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);
	const selectedValue = typeof initialValue === "string" ? initialValue : "";

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
				<SelectValue placeholder={placeholder} />
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
