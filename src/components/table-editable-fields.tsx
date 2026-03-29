"use client";

import type { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
	JSX,
	Suspense,
	lazy,
	useState,
	ComponentPropsWithoutRef,
	KeyboardEvent,
} from "react";
import type { Locale } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { getDateFnsLocaleByLanguage } from "@/i18n";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatNumber, normalizeNumber } from "@/utils/number";
import { CalendarIcon } from "lucide-react";

const Calendar = lazy(() =>
	import("@/components/ui/calendar").then((module) => ({
		default: module.Calendar,
	})),
);

type InputLikeProps = Omit<
	ComponentPropsWithoutRef<typeof Input>,
	"value" | "defaultValue" | "onChange" | "onBlur"
>;

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
	const { renderValue, cell, ...safeProps } = props as TProps &
		UnsafeCellContextProps;
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
	(table.options.meta as TableMetaUpdater | undefined)?.updateData?.(
		rowIndex,
		columnId,
		value,
	);
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

const normalizeDate = (value: Date): Date => {
	const normalized = new Date(value);
	normalized.setHours(0, 0, 0, 0);
	return normalized;
};

const isSameDate = (
	first: Date | undefined,
	second: Date | undefined,
): boolean => {
	if (!first || !second) {
		return false;
	}

	return first.getTime() === second.getTime();
};

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInputValue = (value: string): Date | undefined => {
	const trimmedValue = value.trim();
	if (trimmedValue === "") {
		return undefined;
	}

	const match = DATE_INPUT_PATTERN.exec(trimmedValue);
	if (!match) {
		return undefined;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return undefined;
	}

	const parsedDate = new Date(year, month - 1, day);
	if (Number.isNaN(parsedDate.getTime())) {
		return undefined;
	}

	if (
		parsedDate.getFullYear() !== year ||
		parsedDate.getMonth() !== month - 1 ||
		parsedDate.getDate() !== day
	) {
		return undefined;
	}

	return normalizeDate(parsedDate);
};

type CalendarLocale = Partial<Locale>;

const getCalendarLocaleKeys = (locale: string | undefined): string[] => {
	if (!locale) {
		return ["en"];
	}

	const normalizedLocale = locale.replace("_", "-").toLowerCase();
	const baseLanguage = normalizedLocale.split("-")[0];

	return Array.from(new Set([normalizedLocale, baseLanguage, "en"]));
};

const resolveCalendarLocale = (
	locale: string | undefined,
): CalendarLocale | undefined => {
	const keys = getCalendarLocaleKeys(locale);

	for (const key of keys) {
		const loadedLocale = getDateFnsLocaleByLanguage(key);
		if (loadedLocale) {
			return loadedLocale as CalendarLocale;
		}
	}

	return undefined;
};

const getFractionDigits = (value: string): number => {
	const trimmedValue = value.trim();
	const lastSeparatorIndex = Math.max(
		trimmedValue.lastIndexOf("."),
		trimmedValue.lastIndexOf(","),
	);

	if (lastSeparatorIndex < 0) {
		return 0;
	}

	const fractionPart = trimmedValue.slice(lastSeparatorIndex + 1);
	if (!/^\d+$/.test(fractionPart)) {
		return 0;
	}

	return fractionPart.length;
};

const formatNumericInputDisplayValue = (
	value: string | number,
	locale: string,
): string => {
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

type EditableDatePickerFieldProps = {
	initialValue: Date | undefined;
	className?: string;
	safeProps: InputLikeProps;
	locale: string;
	onCommit: (nextValue: Date) => void;
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
			className={cn("min-h-7.5 min-w-50", className)}
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
	const [lastCommittedValue, setLastCommittedValue] = useState<
		string | number
	>(initialValue);
	const [value, setValue] = useState<string>(() =>
		formatNumericInputDisplayValue(initialValue, locale),
	);

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

const EditableDatePickerField = ({
	initialValue,
	className,
	safeProps,
	locale,
	onCommit,
}: EditableDatePickerFieldProps): JSX.Element => {
	const [open, setOpen] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
		initialValue ? normalizeDate(initialValue) : undefined,
	);
	const [month, setMonth] = useState<Date | undefined>(
		initialValue ? normalizeDate(initialValue) : undefined,
	);
	const [inputValue, setInputValue] = useState<string>(() =>
		formatDateInputValue(initialValue),
	);
	const calendarLocale = resolveCalendarLocale(locale);

	const commitDate = (nextDate: Date | undefined) => {
		if (!nextDate) {
			return;
		}

		const normalizedDate = normalizeDate(nextDate);
		setSelectedDate(normalizedDate);
		setMonth(normalizedDate);
		setInputValue(formatDateInputValue(normalizedDate));

		if (!isSameDate(selectedDate, normalizedDate)) {
			onCommit(normalizedDate);
		}
	};

	const handleInputBlur = () => {
		const parsedDate = parseDateInputValue(inputValue);
		if (!parsedDate) {
			setInputValue(formatDateInputValue(selectedDate));
			return;
		}

		commitDate(parsedDate);
	};

	const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			return;
		}

		if (event.key !== "Enter") {
			return;
		}

		event.preventDefault();
		const parsedDate = parseDateInputValue(inputValue);
		if (!parsedDate) {
			setInputValue(formatDateInputValue(selectedDate));
			return;
		}

		commitDate(parsedDate);
		setOpen(false);
	};

	return (
		<InputGroup className={cn("min-w-20", className)}>
			<InputGroupInput
				value={inputValue}
				onChange={(event) => setInputValue(event.target.value)}
				onBlur={handleInputBlur}
				onKeyDown={handleInputKeyDown}
				placeholder="YYYY-MM-DD"
				className="min-w-15"
				{...safeProps}
			/>
			<InputGroupAddon align="inline-end">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						render={
							<InputGroupButton
								id="date-picker"
								variant="ghost"
								size="icon-xs"
								aria-label="Select date"
							>
								<CalendarIcon />
								<span className="sr-only">Select date</span>
							</InputGroupButton>
						}
					/>
					<PopoverContent
						className="w-auto overflow-hidden gap-0 p-0"
						align="end"
						alignOffset={-8}
						sideOffset={10}
					>
						<Suspense fallback={null}>
							<Calendar
								mode="single"
								selected={selectedDate}
								month={month}
								onMonthChange={setMonth}
								onSelect={(nextDate) => {
									if (!nextDate) {
										return;
									}

									commitDate(nextDate);
									setOpen(false);
								}}
								captionLayout="dropdown"
								startMonth={new Date(1970, 0)}
								endMonth={new Date(2100, 11)}
								locale={calendarLocale}
							/>
						</Suspense>
					</PopoverContent>
				</Popover>
			</InputGroupAddon>
		</InputGroup>
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

	className = cn(
		"print:w-full print:resize-none print:overflow-visible",
		className,
	);

	return (
		<EditableTextField
			key={resetKey}
			initialValue={textValue}
			multiline={multiline}
			className={className}
			safeProps={safeProps}
			onCommit={(nextValue) =>
				callUpdateData(table, index, String(id), nextValue)
			}
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
			<span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
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
	const numericValue =
		typeof initialValue === "number" || typeof initialValue === "string"
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
				onCommit={(nextValue) =>
					callUpdateData(table, index, String(id), nextValue)
				}
			/>
			<span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
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
	const selectedOption = options.find(
		(option) => option.value === selectedValue,
	);
	const resolvedPlaceholder =
		placeholder || t("table.placeholders.selectValue");

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
				<SelectValue placeholder={resolvedPlaceholder}>
					{selectedOption?.label}
				</SelectValue>
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
} & Omit<
		ComponentPropsWithoutRef<typeof Input>,
		"value" | "defaultValue" | "onChange" | "onBlur"
	>) => {
	const { i18n } = useTranslation();
	const initialValue = getValue();
	const locale = i18n.resolvedLanguage || "en";
	const normalizedInitialValue =
		initialValue instanceof Date && !Number.isNaN(initialValue.getTime())
			? normalizeDate(initialValue)
			: undefined;
	const resetKey = `${row.index}:${String(column.id)}:${formatDateInputValue(normalizedInitialValue)}`;
	void strippedRenderValue;
	void strippedCell;
	const safeProps = omitCellContextProps(props);

	const handleCommit = (nextDate: Date) => {
		if (isSameDate(normalizedInitialValue, nextDate)) {
			return;
		}

		callUpdateData(table, row.index, String(column.id), nextDate);
	};

	return (
		<div className={cn("w-30", className)}>
			<EditableDatePickerField
				key={resetKey}
				initialValue={normalizedInitialValue}
				className="w-full"
				safeProps={safeProps}
				locale={locale}
				onCommit={handleCommit}
			/>
		</div>
	);
};
