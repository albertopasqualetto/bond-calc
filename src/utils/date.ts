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