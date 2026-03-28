/* eslint-disable @typescript-eslint/no-unused-vars */
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
	interface ColumnMeta<_TData extends object, _TValue> {
		printable?: boolean;
	}
}
