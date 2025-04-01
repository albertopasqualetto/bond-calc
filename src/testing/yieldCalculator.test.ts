import { FinancialAsset, Cashflow } from '../lib/financialAsset';
import { createDate } from '../utils/date';
// import { Finance } from 'financejs'
// const finance = new Finance();


describe('Bond Yield Calculator', () => {
	test.todo('High coupon rate (5%)');
	test.todo('Short duration bond (2 years)');
	test.todo('Annual payment frequency');

	test('IT0005445306 @ 07/03/2025 1 digit prec', () => {
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
		expect(annualYield).toBeCloseTo(2.781, 1);
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
		expect(annualYield).toBeCloseTo(4.2675, 2);
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
		const oneYearYield = couponRatePerc/settlementPrice*100;

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
		expect(annualYield).toBeCloseTo(oneYearYield, 2);
	});

	test('IT0005024234 @ 31/03/2025 1 digit prec', () => {
		const bond = new FinancialAsset(
			"IT0005024234",
			createDate(2025, 3, 31),
			createDate(2030, 3, 15),
			3.5,
			102.98,
			100,
			2
		);
		console.log("Cashflows", bond.toIrrCashflows());
		const annualYield = bond.computeYield();
		console.log(annualYield);
		expect(annualYield).toBeCloseTo(2.86, 1);
	});

	test('IT0005494239 sell 1 day after net', () => {
		const bond = new FinancialAsset(
			"IT0005494239",
			createDate(2025, 3, 31),
			createDate(2032, 12, 1),
			2.5,
			93.87,
			100,
			2,
			12.5
		);
		const today = createDate(2025, 4, 1);
		const todayPrice = 94;
		console.log("Cashflows today",
			bond.toIrrCashflowsNet(today,
													todayPrice));
		const annualYield = bond.computeYieldNet(today, 						todayPrice);
		console.log(annualYield);
		expect(annualYield).toBeCloseTo(59.13, 1);
	});
});
