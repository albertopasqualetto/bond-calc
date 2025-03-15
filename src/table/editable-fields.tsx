"use client";

import type { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { JSX, useEffect, useState, ComponentPropsWithoutRef } from "react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/datetime-picker/datetime-picker";
import { DateTimeInput } from "@/components/datetime-picker/datetime-input";
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils";

export const EditableTextCell = <T extends object>({
	getValue,
	row: { index },
	column: { id },
	table,
	multiline,
	className,
	...props
}: CellContext<T, string> &
	ComponentPropsWithoutRef<typeof Input> & {
		multiline?: boolean;
		className?: string;
	}): JSX.Element => {
	const initialValue = getValue();
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	const handleBlur = () => {
		table.options.meta?.updateData(index, id as keyof T, value);
	};

	return multiline ? (
		<Textarea
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			rows={2}
			cols={200}
			className={cn("min-h-[30px] min-w-[200px]", className)}
			{...props}
		/>
	) : (
		<Input
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleBlur}
			className={className}
			{...props}
		/>
	);
};

export const SuffixEditableTextCell = <T extends object>({
	suffix,
	className,
	...props
}: CellContext<T, string> &
	ComponentPropsWithoutRef<typeof Input> & {
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
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	const handleChange = () => {
		const newValue = !value;
		setValue(newValue);
		table.options.meta?.updateData(index, id as keyof T, newValue);
	};

	return (
		<Checkbox
			className={cn("h-8 w-8", className)}
			checked={value}
			onCheckedChange={handleChange}
			{...props}
		/>
	);
};

export const EditableSelectCell = <T extends object>({
	getValue,
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
	const [value, setValue] = useState(initialValue);
	const [open, setOpen] = useState(false);

	function handleChange(value: string) {
		setValue(value);
		console.log(row.index, column.id as keyof T, value);
		table.options.meta?.updateData(row.index, column.id as keyof T, value);
	}

	useEffect(() => setValue(initialValue), [initialValue]);

	return (
		<Select
			onValueChange={handleChange}
			value={value}
			defaultValue={value}
			open={open}
			onOpenChange={setOpen}
			{...props}
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
	row,
	column,
	table,
	className,
	...props
}: CellContext<T, Date> & {
	className?: string;
} & Omit<
		ComponentPropsWithoutRef<typeof DateTimePicker>,
		"value" | "onChange"
	>) => {
	const initialValue = getValue();
	const [value, setValue] = useState<Date | undefined>(initialValue);

	function handleChange(value: Date | string | undefined) {
		if (value === undefined) {
			console.log("value is undefined");
			return;
		}
		setValue(new Date(value));
		console.log(row.index, column.id as keyof T, value);
		table.options.meta?.updateData(row.index, column.id as keyof T, value);
	}

	useEffect(() => setValue(initialValue), [initialValue]);

	return (
		<div className={cn("w-[120px]", className)}>
			<DateTimePicker
				value={value}
				onChange={handleChange}
				hideTime={true}
				{...props}
				renderTrigger={({ open, value, setOpen }) => (
					<DateTimeInput
						value={value}
						onChange={(x) => !open && handleChange(x)}
						format="dd/MM/yyyy"
						disabled={open}
						onCalendarClick={() => setOpen(!open)}
					/>
				)}
			/>
		</div>
	);
};
