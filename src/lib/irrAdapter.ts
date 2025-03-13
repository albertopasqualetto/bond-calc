import { xirr, convertRate, RateInterval } from "node-irr";

interface Cashflow {
	amount: number;
	date: Date;
}

/**
 * Returns the number of days between two dates
 * @param date1 First date
 * @param date2 Second date
 * @returns Number of days (float) between the two dates
 */
function daysBetween(date1: Date, date2: Date): number {
	const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
	const diffInTime = Math.abs(date2.getTime() - date1.getTime());
	return Math.round(diffInTime / oneDay);
};

/**
 * Converts asset parameters with constant coupon payments frequency to cashflows for IRR calculation
 * @param settlementDate Date of asset purchase
 * @param maturityDate Date of asset maturity
 * @param couponRatePerc Annual coupon rate in percentage (0.5% = 0.005)
 * @param settlementPrice Price paid for the asset
 * @param redemptionPrice Price paid at asset maturity
 * @param yearlyFrequency Number of coupon payments per year
 * @param capitalGainTaxPerc Percentage of capital gain tax to be paid, default is 0
 * @returns Array of cashflows with dates and amounts
 */
export function bondToIrrCashflows(settlementDate: Date, maturityDate: Date, couponRatePerc: number, settlementPrice: number, redemptionPrice: number, yearlyFrequency: number, capitalGainTaxPerc: number = 0): Cashflow[] {
	settlementDate = new Date(settlementDate);
	maturityDate = new Date(maturityDate);
	if (typeof couponRatePerc === 'string') {
		couponRatePerc = couponRatePerc.replace(',', '.');
	}
	couponRatePerc = Number(couponRatePerc);
	if (typeof settlementPrice === 'string') {
		settlementPrice = settlementPrice.replace(',', '.');
	}
	settlementPrice = Number(settlementPrice);
	if (typeof redemptionPrice === 'string') {
		redemptionPrice = redemptionPrice.replace(',', '.');
	}
	redemptionPrice = Number(redemptionPrice);
	yearlyFrequency = Number(yearlyFrequency);
	if (typeof capitalGainTaxPerc === 'string') {
		capitalGainTaxPerc = capitalGainTaxPerc.replace(',', '.');
	}
	capitalGainTaxPerc = Number(capitalGainTaxPerc);


	const couponRate = couponRatePerc / 100;
	const cashflows: Cashflow[] = [];

	// Calculate coupon amount per period
	const couponAmount = (redemptionPrice * couponRate) / yearlyFrequency;

	// const yearsToMaturity = daysBetween(settlementDate, maturityDate) / 365;
	// console.log(`Years to maturity: ${yearsToMaturity}`);

	// // Calculate number of coupon payments
	// const couponsRemaining = Math.ceil(yearsToMaturity * frequency);
	// console.log(`Remaining coupons: ${couponsRemaining}`)

	// Start from maturity and go backwards to find all the coupons until settlement
	let couponDate = new Date(maturityDate);
	const today = new Date();
	today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

	while (couponDate >= settlementDate) {
		couponDate = new Date(couponDate);
		// Skip adding coupon if the date is today
		if (couponDate.getTime() !== settlementDate.getTime()) {
			cashflows.push({ amount: couponAmount - (couponAmount * capitalGainTaxPerc / 100), date: new Date(couponDate) });
		}
		couponDate.setMonth(couponDate.getMonth() - (12 / yearlyFrequency));
	}

	// Calculate accrued interest at settlement
	// TODO can be more precise taking into account the actual days
	const lastCouponDate = new Date(couponDate);
	const daysSincePreviousCoupon = daysBetween(lastCouponDate, settlementDate);
	// console.log(`Days since previous coupon: ${daysSincePreviousCoupon}`);
	const accruedInterestAmount: number = (couponRate * 100) * (daysSincePreviousCoupon / 365);
	cashflows.push({ amount: -(settlementPrice + accruedInterestAmount), date: settlementDate });	// Add amount payed at settlement

	cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());

	// Add redemption value at maturity
	// const timeToMaturity = daysBetween(settlementDate, maturityDate) / 365;
	// const lastCoupon = cashflows.pop();
	cashflows[cashflows.length - 1].amount += redemptionPrice - ((redemptionPrice - settlementPrice) * capitalGainTaxPerc / 100);


	// Sort by time and extract just the amounts
	// console.log("Cashflows:")
	// console.log(cashflows)
	return cashflows
}


export function cutCashflowsToDate(cashflows: Cashflow[], newRedemptionDate: Date, newRedemptionPrice: number, settlementPrice: number, couponRatePerc: number, capitalGainTaxPerc: number = 0): Cashflow[] {

	newRedemptionDate = new Date(newRedemptionDate);
	if (typeof newRedemptionPrice === 'string') {
		newRedemptionPrice = newRedemptionPrice.replace(',', '.');
	}
	newRedemptionPrice = Number(newRedemptionPrice);
	if (typeof settlementPrice === 'string') {
		settlementPrice = settlementPrice.replace(',', '.');
	}
	settlementPrice = Number(settlementPrice);
	if (typeof couponRatePerc === 'string') {
		couponRatePerc = couponRatePerc.replace(',', '.');
	}
	couponRatePerc = Number(couponRatePerc);
	if (typeof capitalGainTaxPerc === 'string') {
		capitalGainTaxPerc = capitalGainTaxPerc.replace(',', '.');
	}
	capitalGainTaxPerc = Number(capitalGainTaxPerc);


	const couponRate = couponRatePerc / 100;
	const nextCouponDate = cashflows.find(cashflow => cashflow.date > new Date());
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	let accruedInterestAtSellAmount: number = 0;
	if (nextCouponDate) {
		const daysToNextCoupon = daysBetween(today, nextCouponDate.date);
		// console.log(`Days to next coupon: ${daysToNextCoupon}`);
		accruedInterestAtSellAmount = (couponRate * 100) * (daysToNextCoupon / 365);
	}

	const catCashflows = cashflows.filter((cashflow) => cashflow.date <= newRedemptionDate);
	catCashflows.push({ amount: (newRedemptionPrice + accruedInterestAtSellAmount) - ((newRedemptionPrice - settlementPrice) * capitalGainTaxPerc / 100), date: newRedemptionDate });
	catCashflows.sort((a, b) => a.date.getTime() - b.date.getTime());
	return catCashflows;
}


export function computeYieldFromCashflows(cashflows: Cashflow[]): number {
	const fakeDelta = 0.05;
	return convertRate(xirr(cashflows).rate, RateInterval.Year) * 100 + fakeDelta;
}