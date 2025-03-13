import { xirr, convertRate, RateInterval } from 'node-irr';
import { bondToIrrCashflows } from '../lib/irrAdapter';
import { createDate } from '../utils/date';
// import { Finance } from 'financejs'
// const finance = new Finance();
import { xirr as webcarrotXIRR } from "@webcarrot/xirr";


describe('Bond Yield Calculator', () => {
	describe('node-irr Bond Yield Calculator', () => {
		test.todo('High coupon rate (5%)');
		test.todo('Short duration bond (2 years)');
		test.todo('Annual payment frequency');

		test('IT0005445306 @ 06/03/2025', () => {
			const cashflows = bondToIrrCashflows(
				createDate(2025, 3, 7),
				createDate(2028, 7, 15),
				0.5,
				92.81,
				100,
				2
			);
			const annualYield = convertRate(xirr(cashflows).rate, RateInterval.Year) * 100;
			console.log(annualYield);
			expect(annualYield).toBeCloseTo(2.781, 0);
		});

		test('IT0005441883 @ 06/03/2025', () => {
			const cashflows = bondToIrrCashflows(
				createDate(2025, 3, 5),
				createDate(2072, 3, 1),
				2.15,
				57.8,
				100,
				2
			);
			const annualYield = convertRate(xirr(cashflows).rate, RateInterval.Year) * 100;
			console.log(annualYield);
			expect(annualYield).toBeCloseTo(4.2675, 0);
		});

	});

	describe('webcarrot xirr Bond Yield Calculator', () => {
		test.todo('High coupon rate (5%)');
		test.todo('Short duration bond (2 years)');
		test.todo('Annual payment frequency');

		test('IT0005445306 @ 06/03/2025', () => {
			const cashflows = bondToIrrCashflows(
				createDate(2025, 3, 7),
				createDate(2028, 7, 15),
				0.5,
				92.81,
				100,
				2
			);
			const annualYield = webcarrotXIRR(cashflows) * 100;
			console.log(annualYield);
			expect(annualYield).toBeCloseTo(2.781, 0);
		});

		test('IT0005441883 @ 06/03/2025', () => {
			const cashflows = bondToIrrCashflows(
				createDate(2025, 3, 5),
				createDate(2072, 3, 1),
				2.15,
				57.8,
				100,
				2
			);
			const annualYield = webcarrotXIRR(cashflows) * 100;
			console.log(annualYield);
			expect(annualYield).toBeCloseTo(4.2675, 0);
		});

	});

	// describe('Financejs Bond Yield Calculator', () => {
	// 	test.todo('High coupon rate (5%)');
	// 	test.todo('Short duration bond (2 years)');
	// 	test.todo('Annual payment frequency');

	// 	test('IT0005445306 @ 06/03/2025', () => {
	// 		const cashflows = bondToIrrCashflows(
	// 			createDate(2025, 3, 7),
	// 			createDate(2028, 7, 15),
	// 			0.005,
	// 			92.81,
	// 			100,
	// 			2,
	// 		);
	// 		const amounts = cashflows.map(cashflow => cashflow.amount);
	// 		const dates = cashflows.map(cashflow => cashflow.date);
	// 		const annualYield =  finance.XIRR(amounts, dates)/100;
	// 		console.log(annualYield);
	// 		expect(annualYield).toBeCloseTo(0.02781, 2);
	// 	});

	// 	test('IT0005441883 @ 06/03/2025', () => {
	// 		const cashflows = bondToIrrCashflows(
	// 			createDate(2025, 3, 5),
	// 			createDate(2072, 3, 1),
	// 			0.0215,
	// 			57.8,
	// 			100,
	// 			2
	// 		);
	// 		const amounts = cashflows.map(cashflow => cashflow.amount);
	// 		const dates = cashflows.map(cashflow => cashflow.date);
	// 		const annualYield =  finance.XIRR(amounts, dates)/100;
	// 		console.log(annualYield);
	// 		expect(annualYield).toBeCloseTo(0.042675, 2);
	// 	});

	// });

});
