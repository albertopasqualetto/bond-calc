import { xirr, convertRate, RateInterval } from "node-irr";
import { xirr as webcarrotXIRR } from "@webcarrot/xirr";
import { normalizeNumber } from "@/utils/number";

export interface Cashflow {
	amount: number;
	date: Date;
}

/**
 * Represents a bond with all its details and operations
 */
export class FinancialAsset {
	readonly isin: string;
	/** Date when the bond was purchased */
	settlementDate: Date;
	/** Date when the bond was issued */
	issuingDate: Date;
	/** Date when the bond matures */
	maturityDate: Date;
	/** Annual coupon rate in percentage (e.g., 5.0 for 5%) */
	couponRatePerc: number;
	/** Price paid for the bond */
	settlementPrice: number;
	/** Price to be paid at maturity (typically face value) */
	redemptionPrice: number;
	/** Number of coupon payments per year */
	yearlyFrequency: number;
	/** Tax percentage on capital gains */
	capitalGainTaxPerc: number;
	/** Internal storage for coupon cashflows only */
	private _couponCashflows: Cashflow[];

	private static _FAKE_DELTA: number = 0.0;	// TODO add 0.05

	/**
	 * Creates a new Bond instance
	 */
	constructor(
		isin: string | undefined,
		settlementDate: Date | string,
		maturityDate: Date | string,
		couponRatePerc: number | string,
		settlementPrice: number | string,
		redemptionPrice: number | string,
		yearlyFrequency: number | string,
		capitalGainTaxPerc?: number | string,
	)
	constructor(
		isin: string | undefined,
		settlementDate: Date | string,
		maturityDate: Date | string,
		couponRatePerc: number | string,
		settlementPrice: number | string,
		redemptionPrice: number | string,
		yearlyFrequency: number | string,
		capitalGainTaxPerc?: number | string,
		issuingDate?: Date | string,
	) {
		this.isin = isin ? isin : "";
		this.settlementDate = new Date(settlementDate);
		this.maturityDate = new Date(maturityDate);
		this.couponRatePerc = normalizeNumber(couponRatePerc);
		this.settlementPrice = normalizeNumber(settlementPrice);
		this.redemptionPrice = normalizeNumber(redemptionPrice);
		this.yearlyFrequency = normalizeNumber(yearlyFrequency);
		this.capitalGainTaxPerc = capitalGainTaxPerc ? normalizeNumber(capitalGainTaxPerc) : 0;
		this.issuingDate = issuingDate ? new Date(issuingDate) : new Date(this.settlementDate);

		// console.log("Constructing:", this.dict);
		// Initialize coupon cashflows
		this._couponCashflows = this.calculateCouponCashflows(this.issuingDate);
	}

	/**
	 * Get the bond's coupon cashflows
	 */
	get couponCashflows(): Cashflow[] {
		let cashflows = structuredClone(this._couponCashflows);	// Deep copy using structuredClone
		if (process.env.JEST_WORKER_ID !== undefined) {
			// If running in Jest, fix Date copy by creating new Date objects
			cashflows = cashflows.map(cashflow => ({
				amount: cashflow.amount,
				date: new Date(cashflow.date)
			}));
		}
		return cashflows;
	}

	/**
	 * Returns a dictionary representation of the financial asset
	 */
	get dict(): Record<string, unknown> {
		return {
			isin: this.isin,
			issuingDate: this.issuingDate.toISOString(),
			settlementDate: this.settlementDate.toISOString(),
			maturityDate: this.maturityDate.toISOString(),
			couponRatePerc: this.couponRatePerc,
			settlementPrice: this.settlementPrice,
			redemptionPrice: this.redemptionPrice,
			yearlyFrequency: this.yearlyFrequency,
			capitalGainTaxPerc: this.capitalGainTaxPerc,
		};
	}

	/**
	 * Returns the number of days between two dates
	 */
	private static daysBetween(date1: Date, date2: Date): number {
		const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
		const diffInTime = Math.abs(date2.getTime() - date1.getTime());
		return Math.round(diffInTime / oneDay);
	}

	/**
	 * Calculates the accrued interest based on days since last coupon payment
	 */
	calculateAccruedInterest(referenceDate: Date, lastCouponDate: Date): number {
		const couponRate = this.couponRatePerc / 100;
		const daysSincePreviousCoupon = FinancialAsset.daysBetween(lastCouponDate, referenceDate);
		// console.log(`Days since previous coupon: ${daysSincePreviousCoupon}`);
		const accruedInterestAmount: number = couponRate * 100 * (daysSincePreviousCoupon / 365);
		// console.log(`Accrued interest: ${accruedInterestAmount}`);
		return accruedInterestAmount;
	}

	/**
	 * Finds the last coupon date before a reference date
	 */
	findLastCouponDate(referenceDate: Date): Date {
		const pastCashflows = this._couponCashflows
			.filter(cashflow => cashflow.date <= referenceDate)
			.sort((a, b) => b.date.getTime() - a.date.getTime());

		if (pastCashflows.length > 0) {
			// console.log(`Last coupon date: ${pastCashflows[0].date}`);
			return new Date(pastCashflows[0].date);
		} else {
			// If no coupon date is found before reference date, calculate the first coupon date
			// and go backwards one period
			const nextCouponDate = this._couponCashflows.length > 0 ?
				this._couponCashflows[0].date : this.maturityDate;
			const result = new Date(nextCouponDate);
			result.setMonth(result.getMonth() - 12 / this.yearlyFrequency);
			// console.log(`Last coupon date: ${result}`);
			return result;
		}
	}

	/**
	 * Calculates all coupon cashflows from maturity date back to issuing date
	 */
	private calculateCouponCashflows(issuingDate?: Date): Cashflow[] {
		const cashflows: Cashflow[] = [];

		// Zero coupon
		if (!this.yearlyFrequency || this.yearlyFrequency <= 0) {
			return cashflows;
		}

		// Normalize inputs
		const maturityDate = new Date(this.maturityDate);
		const startDate = issuingDate ? new Date(issuingDate) : new Date(this.settlementDate);

		const couponRate = this.couponRatePerc / 100;

		// Calculate coupon amount per period
		const couponAmount = (this.redemptionPrice * couponRate) / this.yearlyFrequency;
		// console.log(`Coupon amount: ${couponAmount}`);

		// Start from maturity and go backwards to find all the coupons until start date
		const couponDate = new Date(maturityDate);
		let addedOneBeforeStart = false;

		while (couponDate >= startDate || (!issuingDate && !addedOneBeforeStart)) {
			cashflows.push({
				amount: couponAmount,
				date: new Date(couponDate), // Create a new Date object for each cashflow entry
			});

			// If we just added a coupon before start date, mark it
			if (!issuingDate && couponDate < startDate) {
				addedOneBeforeStart = true;
			}

			couponDate.setMonth(couponDate.getMonth() - 12 / this.yearlyFrequency);
		}

		// Sort cashflows by date (ascending)
		cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());
		if (!issuingDate || cashflows.length <= 0) {
			// console.log("Coupon cashflows:", cashflows);
		}
		return cashflows;
	}

	/**
	 * Converts bond details to cashflows for IRR calculation
	 * Generates full IRR cashflows on demand using coupon cashflows
	 */
	toIrrCashflows(newRedemptionDate?: Date, newRedemptionPrice?: number, net: boolean = false): Cashflow[] {
		let cashflows = this.couponCashflows;

		const capitalGainTax = net ? this.capitalGainTaxPerc / 100 : 0;

		// Adjust coupon cashflows for capital gain tax
		cashflows.forEach(cashflow => {
			const capitalGainTaxAmount = cashflow.amount * capitalGainTax;
			cashflow.amount -= capitalGainTaxAmount;
		});

		// Calculate accrued interest at settlement
		const couponDateBeforeSettlement = this.findLastCouponDate(this.settlementDate);
		const accruedInterestAmountSettlement = this.calculateAccruedInterest(
			this.settlementDate,
			couponDateBeforeSettlement,
		);

		const redemptionDate = newRedemptionDate ? new Date(newRedemptionDate) : new Date(this.maturityDate);
		redemptionDate.setHours(0, 0, 0, 0);
		const redemptionPrice = newRedemptionPrice ? normalizeNumber(newRedemptionPrice) : this.redemptionPrice;

		const couponDateBeforeRedemption = this.findLastCouponDate(redemptionDate);
		const accruedInterestAmountRedemption = this.calculateAccruedInterest(
			redemptionDate,
			couponDateBeforeRedemption,
		);

		// Add redemption value to the last coupon payment (typically at maturity)
		const capitalGainTaxAmount = (redemptionPrice + accruedInterestAmountRedemption - this.settlementPrice) * capitalGainTax;

		// Filter and keep all cashflows after settlementDate and before redemptionDate
		cashflows = cashflows.filter(cashflow => cashflow.date > this.settlementDate && cashflow.date <= redemptionDate);

		// Add settlement cashflow (negative as it's an outflow)
		cashflows.unshift({
			amount: -(this.settlementPrice + accruedInterestAmountSettlement),
			date: new Date(this.settlementDate),
		});

		// Add redemption cashflow (positive as it's an inflow)
		cashflows.push({
			amount: redemptionPrice + accruedInterestAmountRedemption - capitalGainTaxAmount,
			date: new Date(redemptionDate),
		});

		return cashflows;
	}

	toIrrCashflowsNet(newRedemptionDate?: Date, newRedemptionPrice?: number): Cashflow[] {
		return this.toIrrCashflows(newRedemptionDate, newRedemptionPrice, true);
	}

	/**
	 * Computes the yield
	 */
	computeYield(newRedemptionDate?: Date, newRedemptionPrice?: number): number {
		const irrCashflows = this.toIrrCashflows(newRedemptionDate, newRedemptionPrice);
		return FinancialAsset.computeYieldFromCashflows(irrCashflows);
	}
	/**
	 * Computes the net yield after taxes
	 */
	computeYieldNet(newRedemptionDate?: Date, newRedemptionPrice?: number): number {
		const irrCashflows = this.toIrrCashflows(newRedemptionDate, newRedemptionPrice, true);
		return FinancialAsset.computeYieldFromCashflows(irrCashflows);
	}

	/**
	 * Computes the yield given a set of cashflows
	 */
	static computeYieldFromCashflows(cashflows: Cashflow[]): number {
		return convertRate(xirr(cashflows).rate, RateInterval.Year) * 100 + FinancialAsset._FAKE_DELTA;
	}

	computeWebcarrotYieldTest(newRedemptionDate?: Date, newRedemptionPrice?: number): number {
		const cashflows = this.toIrrCashflows(newRedemptionDate, newRedemptionPrice);
		return webcarrotXIRR(cashflows) * 100 + FinancialAsset._FAKE_DELTA;
	}
}
