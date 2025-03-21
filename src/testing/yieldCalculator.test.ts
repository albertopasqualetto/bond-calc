import { FinancialAsset, Cashflow } from '../lib/financialAsset';
import { createDate } from '../utils/date';
// import { Finance } from 'financejs'
// const finance = new Finance();


describe('Bond Yield Calculator', () => {
	test.todo('High coupon rate (5%)');
	test.todo('Short duration bond (2 years)');
	test.todo('Annual payment frequency');

	test('IT0005445306 @ 07/03/2025', () => {
		const bond = new FinancialAsset(
			"IT0005445306",
			createDate(2025, 3, 7),
			createDate(2028, 7, 15),
			0.5,
			92.81,
			100,
			2
		);
		const annualYield = bond.computeYield();
		console.log(annualYield);
		expect(annualYield).toBeCloseTo(2.781, 0);
	});

	test('IT0005441883 @ 05/03/2025', () => {
		const bond = new FinancialAsset(
			"IT0005441883",
			createDate(2025, 3, 5),
			createDate(2072, 3, 1),
			2.15,
			57.8,
			100,
			2
		);
		const annualYield = bond.computeYield();
		console.log(annualYield);
		expect(annualYield).toBeCloseTo(4.2675, 0);
	});
	test('after 1 year today same price cut', () => {
		const today = new Date();
		today.setHours(0, 0, 0, 0)
		console.log("Today", today);
		const settlementDate = new Date(today);
		settlementDate.setFullYear(settlementDate.getFullYear() - 1);
		const maturityDate = new Date(settlementDate);
		maturityDate.setFullYear(maturityDate.getFullYear() + 2);
		const couponRatePerc = 0.50;
		const settlementPrice = 90;

		const bond = new FinancialAsset(
			undefined,
			settlementDate,
			maturityDate,
			0.5,
			90,
			100,
			2
		);
		console.log("Cashflows today", bond.toIrrCashflows(today, settlementPrice));
		const annualYield = bond.computeYield(today, settlementPrice);
		console.log(annualYield);
		expect(annualYield).toBeCloseTo(couponRatePerc, 0);
	});
});
