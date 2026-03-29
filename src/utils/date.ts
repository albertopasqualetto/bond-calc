/**
 * Creates a new Date object with the specified year, month, and day.
 *
 * @param year - The full year.
 * @param month - The month. Note that JavaScript Date months are 0-indexed, so this function adjusts accordingly.
 * @param day - The day of the month.
 * @returns A Date object representing the specified date.
 */
export function createDate(year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day); // Month is 0-indexed in JS Date
}

// Helper function to check if a date is today
export function isDateToday(date: Date | null | undefined): boolean {
	if (!date) return false;
	date = new Date(date);
	const today = new Date();
	return (
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate()
	);
};

export function toDateKey(date: Date | string): string {
	const value = new Date(date);
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
	return new Date(`${dateKey}T00:00:00`);
}

const resolveLocale = (locale: string | undefined): string => {
	return locale || "en";
};

export function formatDate(
	value: Date | string,
	locale: string,
	options: Intl.DateTimeFormatOptions = {},
): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return new Intl.DateTimeFormat(resolveLocale(locale), {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		...options,
	}).format(date);
}

export function formatDateKey(
	dateKey: string,
	locale: string,
	options: Intl.DateTimeFormatOptions = {},
): string {
	return formatDate(fromDateKey(dateKey), locale, options);
}