// Define the response type for better type safety
interface BorsaItalianaResponse {
	success: boolean;
	data: BorsaItalianaData;
}

export interface BorsaItalianaData {
	title: string;
	price: {
		last: number;
		perc: number;
	};
	yield: {
		gross: number;
		net: number;
	};
	info: {
		issuingDate: Date;
		maturityDate: Date;
		couponFrequency: number;
		periodicCouponRate: number;
		couponRate: number;	// TODO remove this
		couponRatePerc: number;
	};
	webpage: string;
	// Add other fields as needed based on the response structure
}

/**
 * Converts an Italian coupon frequency description to number of times per year
 * @param frequency - The frequency description in Italian (e.g., "Semestrale")
 * @returns Number of coupon payments per year
 */
function convertCouponFrequency(frequency: string): number {
	const frequencyMap: Record<string, number> = {
		"Annuale": 1,
		"Semestrale": 2,
		"Trimestrale": 4,
		"Mensile": 12,
		"Bimestrale": 6,
		"Quadrimestrale": 3,
		"Giornaliero": 365,
		"Zero Coupon": 0
	};

	// Convert to lowercase, remove extra spaces, and find in the map
	const normalizedFrequency = frequency.trim().toLowerCase();

	// Check for each key in case-insensitive manner
	for (const key of Object.keys(frequencyMap)) {
		if (key.toLowerCase() === normalizedFrequency) {
			return frequencyMap[key];
		}
	}
}

function parseBorsaItalianaData(
	data: BorsaItalianaData,
): BorsaItalianaData {
// 	TODO put here the parsing logic which is in the following function
}
// TODO add another interface for actual data types?

/**
 * Fetches data from Borsa Italiana for a given ISIN
 * @param isin - The ISIN code of the security
 * @returns A promise containing the API response data
 */
export async function fetchBorsaItalianaData(
	isin: string,
): Promise<BorsaItalianaData> {
	const url = `https://wrapapi.com/use/albertopasqualetto/borsa_italiana/get/1.0.3?wrapAPIKey=${import.meta.env.VITE_WRAP_API_KEY}&ISIN=${isin}`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`API request failed with status: ${response.status}`,
			);
		}
		
		const result: BorsaItalianaResponse = await response.json();
		if (!result.success) {
			throw new Error(
				`API request not successful: ${result.success}`,
			);
		}
		
		const data = result.data;
		data.price.last = parseFloat(String(data.price.last).replace(",", "."));
		data.price.perc = parseFloat(String(data.price.perc).replace(",", ".").replace("%", "").trim());
		data.info.couponFrequency = convertCouponFrequency(String(data.info.couponFrequency));
		data.info.maturityDate = new Date(data.info.maturityDate);
		data.info.issuingDate = new Date(data.info.issuingDate);
		if (data.info.maturityDate < data.info.issuingDate) { // Adjust incorrect parsing of YY formatted date
			data.info.maturityDate.setFullYear(data.info.maturityDate.getFullYear() + 100);
		}
		data.info.periodicCouponRate = parseFloat(String(data.info.periodicCouponRate).replace(",", "."));
		data.info.couponRate = data.info.periodicCouponRate * data.info.couponFrequency;
		data.info.couponRatePerc = data.info.couponRate;


		return data;
	} catch (error) {
		console.error("Error fetching Borsa Italiana data:", error);
		throw error;
	}
}

// Example usage
async function getBondData() {
	try {
		const isin = "IT0005441883";
		const data = await fetchBorsaItalianaData(isin);

		console.log(data);


	} catch (error) {
		console.error("Failed to get bond data:", error);
	}
}

// Call the function
getBondData();
