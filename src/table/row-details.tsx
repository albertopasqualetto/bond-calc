"use client";

import { useMemo, useState } from "react";
import type { Locale } from "react-day-picker";
import { useTranslation } from "react-i18next";
import type { FinancialAssetRow } from "./columns";
import { getDateFnsLocaleByLanguage } from "@/i18n";
import { FinancialAsset } from "@/lib/financialAsset";
import { fromDateKey, toDateKey } from "@/utils/date";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	formatCurrency,
	formatNumber,
	formatPercent,
	normalizeNumber,
} from "@/utils/number";
import { CalendarIcon, Check, Pencil, Plus, Trash2 } from "lucide-react";

interface HistoricalCalculationRow {
	dateKey: string;
	price: number;
	annualYieldGrossToday: number;
	annualYieldNetToday: number;
	totalValueToday: number;
	totalValueDifference: number;
}

const buildHistoricalRows = (
	row: FinancialAssetRow,
): HistoricalCalculationRow[] => {
	const entries = Object.entries(row.priceByDate || {})
		.filter(([, price]) => Number.isFinite(Number(price)))
		.sort(([first], [second]) => first.localeCompare(second));

	if (entries.length === 0) {
		return [];
	}

	let settlementAsset: FinancialAsset | null = null;
	try {
		settlementAsset = new FinancialAsset(
			row.isin,
			row.settlementDate,
			row.maturityDate,
			row.couponRatePerc,
			row.settlementPrice,
			row.redemptionPrice,
			row.yearlyFrequency,
			row.capitalGainTaxPerc,
			row.issuingDate,
		);
	} catch {
		return [];
	}

	const totalValueNominal = normalizeNumber(row.totalValueNominal ?? NaN);
	const redemptionPrice = normalizeNumber(row.redemptionPrice);
	const settlementPrice = normalizeNumber(row.settlementPrice);
	const hasValidBaseValues =
		Number.isFinite(totalValueNominal) &&
		Number.isFinite(redemptionPrice) &&
		redemptionPrice !== 0;
	const totalValueSettlement =
		hasValidBaseValues && Number.isFinite(settlementPrice)
			? (totalValueNominal / redemptionPrice) * settlementPrice
			: NaN;

	return entries.map(([dateKey, rawPrice]) => {
		const price = Number(rawPrice);
		const date = fromDateKey(dateKey);
		const totalValueToday = hasValidBaseValues
			? (totalValueNominal / redemptionPrice) * price
			: NaN;

		return {
			dateKey,
			price,
			annualYieldGrossToday: settlementAsset.computeYield(date, price),
			annualYieldNetToday: settlementAsset.computeYieldNet(date, price),
			totalValueToday,
			totalValueDifference: totalValueToday - totalValueSettlement,
		};
	});
};

interface RowDetailsProps {
	row: FinancialAssetRow;
	onPriceByDateChange?: (
		rowId: string,
		priceByDate: Record<string, number>,
	) => void;
}

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

const toValidDateKeyDate = (dateKey: string): Date | undefined => {
	if (!dateKey) {
		return undefined;
	}

	const parsedDate = fromDateKey(dateKey);
	if (Number.isNaN(parsedDate.getTime())) {
		return undefined;
	}

	parsedDate.setHours(0, 0, 0, 0);
	return parsedDate;
};

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInputValue = (value: string): string | undefined => {
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

	parsedDate.setHours(0, 0, 0, 0);
	return toDateKey(parsedDate);
};

const getNextAvailableDateKey = (existing?: Record<string, number>): string => {
	const usedKeys = new Set(Object.keys(existing || {}));
	const candidate = new Date();
	candidate.setHours(0, 0, 0, 0);

	for (let attempts = 0; attempts < 3650; attempts += 1) {
		const dateKey = toDateKey(candidate);
		if (!usedKeys.has(dateKey)) {
			return dateKey;
		}
		candidate.setDate(candidate.getDate() - 1);
	}

	return toDateKey(new Date());
};

const toRawNumberInput = (value: number): string =>
	formatNumber(value, "en", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 6,
		useGrouping: false,
	});

interface EditableHistoryDateFieldProps {
	dateKey: string;
	calendarLocale: CalendarLocale | undefined;
	ariaLabel: string;
	onDateKeyChange: (nextDateKey: string) => void;
}

const EditableHistoryDateField = ({
	dateKey,
	calendarLocale,
	ariaLabel,
	onDateKeyChange,
}: EditableHistoryDateFieldProps) => {
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState(dateKey);
	const [month, setMonth] = useState<Date | undefined>(() =>
		toValidDateKeyDate(dateKey),
	);
	const selectedDate = useMemo(() => {
		const parsedDateKey = parseDateInputValue(inputValue);
		return toValidDateKeyDate(parsedDateKey || dateKey);
	}, [dateKey, inputValue]);

	const commitInputValue = () => {
		const parsedDateKey = parseDateInputValue(inputValue);
		if (!parsedDateKey) {
			setInputValue(dateKey);
			return;
		}

		onDateKeyChange(parsedDateKey);
		const parsedDate = toValidDateKeyDate(parsedDateKey);
		if (parsedDate) {
			setMonth(parsedDate);
		}
		setInputValue(dateKey);
	};

	const handleInputChange = (nextDateInputValue: string) => {
		setInputValue(nextDateInputValue);

		const parsedDateKey = parseDateInputValue(nextDateInputValue);
		if (!parsedDateKey) {
			return;
		}

		const parsedDate = toValidDateKeyDate(parsedDateKey);
		if (!parsedDate) {
			return;
		}

		setMonth(parsedDate);
	};

	const handleInputKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			return;
		}

		if (event.key !== "Enter") {
			return;
		}

		event.preventDefault();
		commitInputValue();
		setOpen(false);
	};

	const handleSelect = (nextDate: Date | undefined) => {
		if (!nextDate) {
			return;
		}

		const normalizedDate = new Date(nextDate);
		normalizedDate.setHours(0, 0, 0, 0);
		const normalizedDateKey = toDateKey(normalizedDate);
		onDateKeyChange(normalizedDateKey);
		setInputValue(normalizedDateKey);
		setMonth(normalizedDate);
		setOpen(false);
	};

	return (
		<InputGroup className="mt-1">
			<InputGroupInput
				value={inputValue}
				placeholder="YYYY-MM-DD"
				onChange={(event) => handleInputChange(event.target.value)}
				onBlur={commitInputValue}
				onKeyDown={handleInputKeyDown}
			/>
			<InputGroupAddon align="inline-end">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						render={
							<InputGroupButton
								variant="ghost"
								size="icon-xs"
								aria-label={ariaLabel}
							>
								<CalendarIcon />
								<span className="sr-only">{ariaLabel}</span>
							</InputGroupButton>
						}
					/>
					<PopoverContent
						className="w-auto overflow-hidden gap-0 p-0"
						align="end"
						alignOffset={-8}
						sideOffset={10}
					>
						<Calendar
							mode="single"
							selected={selectedDate}
							month={month}
							onMonthChange={setMonth}
							onSelect={handleSelect}
							captionLayout="dropdown"
							startMonth={new Date(1970, 0)}
							endMonth={new Date(2100, 11)}
							locale={calendarLocale}
						/>
					</PopoverContent>
				</Popover>
			</InputGroupAddon>
		</InputGroup>
	);
};

export default function RowDetails({
	row,
	onPriceByDateChange,
}: RowDetailsProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || "en";
	const calendarLocale = useMemo(
		() => resolveCalendarLocale(locale),
		[locale],
	);
	const historicalRows = useMemo(() => buildHistoricalRows(row), [row]);
	const dateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}),
		[locale],
	);
	const rowId = row._rowId || "";
	const [isEditingHistory, setIsEditingHistory] = useState(false);
	const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
	const [newDateKey, setNewDateKey] = useState("");
	const [newPriceValue, setNewPriceValue] = useState("");
	const [priceDraftByDate, setPriceDraftByDate] = useState<
		Record<string, string>
	>({});

	const commitPriceByDate = (nextPriceByDate: Record<string, number>) => {
		if (!rowId || !onPriceByDateChange) {
			return;
		}
		onPriceByDateChange(rowId, nextPriceByDate);
	};

	const getFallbackPrice = () => {
		if (Number.isFinite(row.todayPrice)) {
			return Number(row.todayPrice);
		}
		if (Number.isFinite(row.settlementPrice)) {
			return Number(row.settlementPrice);
		}
		return 0;
	};

	const buildDraftByDate = (source?: Record<string, number>) => {
		return Object.fromEntries(
			Object.entries(source || {}).map(([dateKey, price]) => [
				dateKey,
				toRawNumberInput(Number(price)),
			]),
		);
	};

	const handleToggleEditHistory = () => {
		setIsEditingHistory((previousState) => {
			if (previousState) {
				setIsAddPopoverOpen(false);
				setPriceDraftByDate({});
				return false;
			}

			setPriceDraftByDate(buildDraftByDate(row.priceByDate));
			return true;
		});
	};

	const handleAddPopoverChange = (open: boolean) => {
		if (!isEditingHistory) {
			return;
		}

		setIsAddPopoverOpen(open);
		if (!open) {
			return;
		}

		const nextDateKey = getNextAvailableDateKey(row.priceByDate);
		setNewDateKey(nextDateKey);
		setNewPriceValue(toRawNumberInput(getFallbackPrice()));
	};

	const hasDuplicateAddDate =
		newDateKey.length > 0 &&
		Object.prototype.hasOwnProperty.call(row.priceByDate || {}, newDateKey);
	const canConfirmAdd =
		newDateKey.length > 0 &&
		Number.isFinite(normalizeNumber(newPriceValue)) &&
		!hasDuplicateAddDate;

	const handleAddHistoryEntry = () => {
		if (!canConfirmAdd) {
			return;
		}

		const normalizedPrice = normalizeNumber(newPriceValue);
		const nextPriceByDate = {
			...(row.priceByDate || {}),
			[newDateKey]: normalizedPrice,
		};

		commitPriceByDate(nextPriceByDate);
		setPriceDraftByDate((previousDrafts) => ({
			...previousDrafts,
			[newDateKey]: toRawNumberInput(normalizedPrice),
		}));
		setIsAddPopoverOpen(false);
	};

	const handleDateChange = (previousDateKey: string, dateValue: string) => {
		if (!isEditingHistory || !dateValue || dateValue === previousDateKey) {
			return;
		}

		if (
			Object.prototype.hasOwnProperty.call(
				row.priceByDate || {},
				dateValue,
			)
		) {
			return;
		}

		const nextPriceByDate = {
			...(row.priceByDate || {}),
		};
		const existingPrice = Number(nextPriceByDate[previousDateKey]);
		delete nextPriceByDate[previousDateKey];
		nextPriceByDate[dateValue] = existingPrice;
		commitPriceByDate(nextPriceByDate);

		setPriceDraftByDate((previousDrafts) => {
			const nextDrafts = {
				...previousDrafts,
			};
			nextDrafts[dateValue] =
				nextDrafts[previousDateKey] || toRawNumberInput(existingPrice);
			delete nextDrafts[previousDateKey];
			return nextDrafts;
		});
	};

	const handlePriceChange = (dateKey: string, rawValue: string) => {
		if (!isEditingHistory) {
			return;
		}

		setPriceDraftByDate((previousDrafts) => ({
			...previousDrafts,
			[dateKey]: rawValue,
		}));

		if (rawValue.trim().length === 0) {
			return;
		}

		const normalizedPrice = normalizeNumber(rawValue);
		if (!Number.isFinite(normalizedPrice)) {
			return;
		}

		commitPriceByDate({
			...(row.priceByDate || {}),
			[dateKey]: normalizedPrice,
		});
	};

	const handleDeleteHistoryEntry = (dateKey: string) => {
		if (!isEditingHistory) {
			return;
		}

		const nextPriceByDate = {
			...(row.priceByDate || {}),
		};
		delete nextPriceByDate[dateKey];
		commitPriceByDate(nextPriceByDate);

		setPriceDraftByDate((previousDrafts) => {
			const nextDrafts = {
				...previousDrafts,
			};
			delete nextDrafts[dateKey];
			return nextDrafts;
		});
	};

	return (
		<div className="space-y-3">
			<div>
				<div className="font-medium">{t("financialAsset.isin")}</div>
				<div className="text-sm">{row.isin || t("common.na")}</div>
			</div>
			<div>
				<div className="font-medium">{t("financialAsset.name")}</div>
				<div className="text-sm">{row.name || t("common.na")}</div>
			</div>
			<div>
				<div className="font-medium mb-2 flex items-center justify-between gap-2">
					<span>{t("financialAsset.priceHistory")}</span>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={handleToggleEditHistory}
						>
							{isEditingHistory ? <Check /> : <Pencil />}
							{isEditingHistory
								? t("common.done")
								: t("common.edit")}
						</Button>
						{isEditingHistory ? (
							<Popover
								open={isAddPopoverOpen}
								onOpenChange={handleAddPopoverChange}
							>
								<PopoverTrigger
									render={
										<Button
											type="button"
											size="icon-xs"
											variant="outline"
											title={t(
												"financialAsset.addPriceHistoryEntry",
											)}
											aria-label={t(
												"financialAsset.addPriceHistoryEntry",
											)}
										>
											<Plus />
										</Button>
									}
								/>
								<PopoverContent
									align="end"
									className="w-72 space-y-2"
								>
									<div className="space-y-1">
										<div className="text-xs text-muted-foreground">
											{t("financialAsset.date")}
										</div>
										<Input
											type="date"
											value={newDateKey}
											onChange={(event) =>
												setNewDateKey(
													event.target.value,
												)
											}
										/>
									</div>
									<div className="space-y-1">
										<div className="text-xs text-muted-foreground">
											{t("financialAsset.price")}
										</div>
										<Input
											type="number"
											step="0.001"
											value={newPriceValue}
											onChange={(event) =>
												setNewPriceValue(
													event.target.value,
												)
											}
										/>
									</div>
									{hasDuplicateAddDate ? (
										<div className="text-xs text-destructive">
											{t(
												"financialAsset.historyDateAlreadyExists",
											)}
										</div>
									) : null}
									<Button
										type="button"
										size="sm"
										className="w-full"
										onClick={handleAddHistoryEntry}
										disabled={!canConfirmAdd}
									>
										{t(
											"financialAsset.addPriceHistoryEntry",
										)}
									</Button>
								</PopoverContent>
							</Popover>
						) : null}
					</div>
				</div>
				{historicalRows.length === 0 ? (
					<div className="text-sm">
						{t("financialAsset.noHistoricalData")}
					</div>
				) : (
					<div className="space-y-2">
						{historicalRows.map((entry) => (
							<div
								key={entry.dateKey}
								className="rounded border p-2 text-sm"
							>
								<div>
									{t("financialAsset.date")}:
									{isEditingHistory ? (
										<Input
											type="date"
											value={entry.dateKey}
											onChange={(event) =>
												handleDateChange(
													entry.dateKey,
													event.target.value,
												)
											}
											className="mt-1"
										/>
									) : (
										<span>
											{dateFormatter.format(
												fromDateKey(entry.dateKey),
											)}
										</span>
									)}
								</div>
								<div>
									{t("financialAsset.price")}:
									{isEditingHistory ? (
										<div className="mt-1 flex items-center gap-1">
											<Input
												type="number"
												step="0.001"
												value={
													priceDraftByDate[
														entry.dateKey
													] ??
													toRawNumberInput(
														entry.price,
													)
												}
												onChange={(event) =>
													handlePriceChange(
														entry.dateKey,
														event.target.value,
													)
												}
												className="mt-0"
											/>
											<Button
												type="button"
												size="icon-xs"
												variant="ghost"
												title={t(
													"financialAsset.deletePriceHistoryEntry",
												)}
												aria-label={t(
													"financialAsset.deletePriceHistoryEntry",
												)}
												onClick={() =>
													handleDeleteHistoryEntry(
														entry.dateKey,
													)
												}
											>
												<Trash2 />
											</Button>
										</div>
									) : (
										<span>
											{formatNumber(entry.price, locale, {
												minimumFractionDigits: 3,
												maximumFractionDigits: 3,
											})}
										</span>
									)}
								</div>
								<div>
									{t("financialAsset.grossYield")}:{" "}
									{formatPercent(
										entry.annualYieldGrossToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.netYield")}:{" "}
									{formatPercent(
										entry.annualYieldNetToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.marketValue")}:{" "}
									{formatCurrency(
										entry.totalValueToday,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</div>
								<div>
									{t("financialAsset.difference")}:{" "}
									{formatCurrency(
										entry.totalValueDifference,
										locale,
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
											signDisplay: "exceptZero",
										},
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
