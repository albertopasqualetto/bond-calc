export function normalizeNumber(value: number | string): number {
	if (typeof value === "string") {
		const trimmedValue = value.trim();

		// Check if it's likely European format (contains comma but no dot, or has dot before comma)
		if ((trimmedValue.includes(",") && !trimmedValue.includes(".")) ||
			(trimmedValue.includes(".") && trimmedValue.includes(",") &&
				trimmedValue.lastIndexOf(".") < trimmedValue.lastIndexOf(","))) {
			return Number(trimmedValue
				.replace(/\./g, "")	// Remove all dots (thousand separators)
				.replace(",", ".")	// Replace comma with dot (decimal point)
			);
		} else {
			// English format -> remove commas and parse
			return Number(trimmedValue.replace(/,/g, ""));
		}
	}
	return Number(value);
}