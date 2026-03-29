"use client";

import {
	ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
	VisibilityState,
	Row,
} from "@tanstack/react-table";
import { useState, useEffect, useRef, useCallback, memo, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Download, Upload } from "lucide-react";
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { cn } from "@/lib/utils"

const STORAGE_SCHEMA_VERSION = 2;

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	name?: string;
	onAddRow?: () => void;
	onDeleteAllRows?: () => void;
	onDeleteRow?: (row: TData) => void;
	onNameChange?: (name: string) => void;
	onDataChange?: (data: TData[]) => void; // New callback for data changes from storage
	localStorageKey?: string;
	meta?: {
		updateData: (rowIndex: number, columnId: string, value: unknown) => void;
		deleteConfirmState?: boolean;
	};
	defaultData?: TData[]; // Default data to use if nothing in storage
	serializeRow?: (row: TData) => unknown;
	deserializeRow?: (row: unknown) => TData;
	renderRowDetails?: (row: TData) => ReactNode;
}

const deserializeRows = <TData,>(
	items: unknown[],
	deserializeItem: (item: unknown) => TData | null,
): TData[] => {
	return items.flatMap((item) => {
		const row = deserializeItem(item);
		return row ? [row] : [];
	});
};

const getColumnId = <TData, TValue>(column: ColumnDef<TData, TValue>): string | undefined => {
	if (column.id) {
		return String(column.id);
	}
	if ("accessorKey" in column && typeof column.accessorKey === "string") {
		return column.accessorKey;
	}
	return undefined;
};

const isPrintableColumn = <TData, TValue>(column: ColumnDef<TData, TValue>): boolean => {
	const meta: unknown = column.meta;
	if (!meta || typeof meta !== "object") {
		return true;
	}

	const printable: unknown = Reflect.get(meta, "printable");
	return printable !== false;
};

const collectAllColumnIds = <TData, TValue>(columns: ColumnDef<TData, TValue>[]): string[] => {
	const ids: string[] = [];

	for (const column of columns) {
		const id = getColumnId(column);
		if (id) {
			ids.push(id);
		}

		if ("columns" in column && Array.isArray(column.columns)) {
			for (const nestedColumn of column.columns) {
				const nestedId = getColumnId(nestedColumn);
				if (nestedId) {
					ids.push(nestedId);
				}
			}
		}
	}

	return ids;
};

const collectHiddenPrintColumnIds = <TData, TValue>(columns: ColumnDef<TData, TValue>[]): string[] => {
	const ids: string[] = [];

	for (const column of columns) {
		const id = getColumnId(column);
		if (id && !isPrintableColumn(column)) {
			ids.push(id);
		}

		if ("columns" in column && Array.isArray(column.columns)) {
			for (const nestedColumn of column.columns) {
				const nestedId = getColumnId(nestedColumn);
				if (nestedId && !isPrintableColumn(nestedColumn)) {
					ids.push(nestedId);
				}
			}
		}
	}

	return ids;
};

const buildColumnVisibility = <TData, TValue>(
	columns: ColumnDef<TData, TValue>[],
	isPrintMode: boolean,
): VisibilityState => {
	const visibility: VisibilityState = {};

	if (isPrintMode) {
		for (const id of collectHiddenPrintColumnIds(columns)) {
			visibility[id] = false;
		}
		return visibility;
	}

	for (const id of collectAllColumnIds(columns)) {
		visibility[id] = true;
	}

	return visibility;
};

const toValidDateOrNull = (value: unknown): Date | null => {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	return null;
};

const toDisplayString = (value: unknown, naLabel: string, locale: string): string => {
	if (value === undefined || value === null) {
		return naLabel;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			return naLabel;
		}
		return new Intl.NumberFormat(locale || "en", { useGrouping: true }).format(value);
	}
	if (typeof value === "string" || typeof value === "boolean") {
		return String(value);
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			return naLabel;
		}
		return new Intl.DateTimeFormat(locale || "en", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(value);
	}
	return JSON.stringify(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null;
};

function TableRowMemoizedInner<TData>({
	row,
	onClick,
}: {
	row: Row<TData>;
	onClick: (e: React.MouseEvent, data: TData) => void;
}) {
	return (
		<TableRow
			key={row.id}
			data-state={row.getIsSelected() && "selected"}
			onClick={(e) => onClick(e, row.original)}
			className="cursor-pointer hover:bg-muted/50"
		>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id} className="p-1">
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	);
}

const MemoizedRow = memo(TableRowMemoizedInner) as typeof TableRowMemoizedInner;

// Wrap the DataTable component with React.memo
function DataTableInner<TData, TValue>({
	columns,
	data,
	name = "",
	onAddRow,
	onDeleteAllRows,
	onDeleteRow,
	onNameChange,
	onDataChange,
	localStorageKey = "financial-assets-data",
	meta,
	defaultData = [],
	serializeRow,
	deserializeRow,
	renderRowDetails,
}: DataTableProps<TData, TValue>) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || "en";
	const [selectedRow, setSelectedRow] = useState<TData | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const hasLoadedInitialDataRef = useRef(false);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [isPrinting, setIsPrinting] = useState(false);
	const [parent] = useAutoAnimate(/* optional config */);

	const deserializeItem = useCallback((item: unknown): TData | null => {
		if (deserializeRow) {
			return deserializeRow(item);
		}
		if (!isRecord(item)) {
			return null;
		}
		const record = item;
		return {
			...record,
			settlementDate: toValidDateOrNull(record.settlementDate),
			maturityDate: toValidDateOrNull(record.maturityDate),
		} as TData;
	}, [deserializeRow]);

	const extractRowsFromPayload = useCallback((payload: unknown): TData[] => {
		if (Array.isArray(payload)) {
			return deserializeRows(payload, deserializeItem);
		}

		if (!isRecord(payload)) {
			return [];
		}

		const record = payload;
		if (Array.isArray(record.tableData)) {
			return deserializeRows(record.tableData, deserializeItem);
		}

		return [];
	}, [deserializeItem]);

	const applyImportedPayload = useCallback((payload: unknown) => {
		if (!isRecord(payload)) {
			return;
		}

		const record = payload;
		if (typeof record.ownerName === "string" && record.ownerName && onNameChange && record.ownerName !== name) {
			onNameChange(record.ownerName);
		}

		if (!onDataChange) {
			return;
		}

		const rows = extractRowsFromPayload(payload);
		onDataChange(rows);
	}, [extractRowsFromPayload, name, onDataChange, onNameChange]);

	const shouldMigratePayload = useCallback((payload: unknown): boolean => {
		if (Array.isArray(payload)) {
			return true;
		}

		if (!isRecord(payload)) {
			return false;
		}

		const record = payload;
		if (record.schemaVersion !== STORAGE_SCHEMA_VERSION) {
			return true;
		}

		if (!Array.isArray(record.tableData)) {
			return false;
		}

		return record.tableData.some((item) => {
			if (!isRecord(item)) {
				return false;
			}

			const row = item;
			return "todayPrice" in row && !("priceByDate" in row);
		});
	}, []);

	const rewriteStoragePayload = useCallback((payload: unknown) => {
		if (!localStorageKey || typeof window === "undefined") {
			return;
		}

		if (!isRecord(payload)) {
			return;
		}

		const record = payload;
		const ownerNameFromPayload = typeof record.ownerName === "string" ? record.ownerName : name;
		const rows = extractRowsFromPayload(payload);
		const tableDataToStore = serializeRow ? rows.map((row) => serializeRow(row)) : rows;
		localStorage.setItem(
			localStorageKey,
			JSON.stringify({
				schemaVersion: STORAGE_SCHEMA_VERSION,
				tableData: tableDataToStore,
				ownerName: ownerNameFromPayload || "",
			}),
		);
	}, [extractRowsFromPayload, localStorageKey, name, serializeRow]);

	// Set up print media query listener
	useEffect(() => {
		const checkPrintMode = () => {
			const isPrintMode = window.matchMedia('print').matches ||
				window.matchMedia('(max-width: 0px)').matches;

			setIsPrinting(isPrintMode);
			setColumnVisibility((prev) => ({ ...prev, ...buildColumnVisibility(columns, isPrintMode) }));
		};

		// Initial check
		checkPrintMode();

		// Media query to detect print mode
		const mediaQueryList = window.matchMedia('print');
		const handlePrintChange = () => checkPrintMode();

		// Add event listener with compatibility for older browsers
		if (mediaQueryList.addEventListener) {
			mediaQueryList.addEventListener('change', handlePrintChange);
		} else if (mediaQueryList.addListener) {
			// Older browsers
			mediaQueryList.addListener(handlePrintChange);
		}

		// Also add a listener for beforeprint and afterprint events
		const handleBeforePrint = () => setIsPrinting(true);
		const handleAfterPrint = () => setIsPrinting(false);
		window.addEventListener('beforeprint', handleBeforePrint);
		window.addEventListener('afterprint', handleAfterPrint);

		return () => {
			// Clean up
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener('change', handlePrintChange);
			} else if (mediaQueryList.removeListener) {
				mediaQueryList.removeListener(handlePrintChange);
			}
			window.removeEventListener('beforeprint', handleBeforePrint);
			window.removeEventListener('afterprint', handleAfterPrint);
		};
	}, [columns]);  // Added columns as a dependency

	// Update the other useEffect to use the same column checking logic
	useEffect(() => {
		setColumnVisibility((prev) => ({ ...prev, ...buildColumnVisibility(columns, isPrinting) }));
	}, [isPrinting, columns]);  // Added columns as a dependency

	// Load data from local storage on component mount
	useEffect(() => {
		if (hasLoadedInitialDataRef.current) {
			return;
		}

		hasLoadedInitialDataRef.current = true;

		if (localStorageKey && typeof window !== 'undefined') {
			const savedData = localStorage.getItem(localStorageKey);
			if (savedData) {
				try {
					const parsedData: unknown = JSON.parse(savedData);
					if (!isRecord(parsedData)) {
						if (onDataChange && defaultData.length > 0) {
							onDataChange(defaultData);
						}
						return;
					}

					const parsedDataRecord = parsedData;
					const isEmptyPayload =
						parsedDataRecord.ownerName === "" &&
						Array.isArray(parsedDataRecord.tableData) &&
						parsedDataRecord.tableData.length === 0;

					if (isEmptyPayload) {
						if (onDataChange && defaultData.length > 0) {
							onDataChange(defaultData);
						}
						return;
					}
					applyImportedPayload(parsedData);
					if (shouldMigratePayload(parsedData)) {
						rewriteStoragePayload(parsedData);
					}
				} catch (error) {
					console.error("Failed to parse stored data:", error);
					// If there's an error parsing, use default data
					if (onDataChange && defaultData.length > 0) {
						onDataChange(defaultData);
					}
				}
			} else if (onDataChange && defaultData.length > 0) {
				// Use default data if nothing in storage
				onDataChange(defaultData);
			}
		}
	}, [applyImportedPayload, defaultData, localStorageKey, onDataChange, rewriteStoragePayload, shouldMigratePayload]);

	// Save data to local storage whenever it changes
	useEffect(() => {
		if (localStorageKey && typeof window !== 'undefined') {
			const tableDataToStore = serializeRow ? data.map((item) => serializeRow(item)) : data;
			const dataToStore = {
				schemaVersion: STORAGE_SCHEMA_VERSION,
				tableData: tableDataToStore,
				ownerName: name
			};
			localStorage.setItem(localStorageKey, JSON.stringify(dataToStore));
		}
	}, [data, name, localStorageKey, serializeRow]);

	const handleExportData = async () => {
		const tableDataToExport = serializeRow ? data.map((item) => serializeRow(item)) : data;
		// Prepare the data to export
		const dataToExport = {
			tableData: tableDataToExport,
			ownerName: name
		};

		const jsonString = JSON.stringify(dataToExport, null, 2);
		const fileName = `${name || 'financial-assets'}-export.json`;

		// Check if the File System Access API is supported
		if ('showSaveFilePicker' in window) {
			try {
				// Use File System Access API
				const pickerWindow = window as Window & {
					showSaveFilePicker?: (options: unknown) => Promise<{
						createWritable: () => Promise<{
							write: (content: string) => Promise<void>;
							close: () => Promise<void>;
						}>;
					}>;
				};
				if (!pickerWindow.showSaveFilePicker) {
					throw new Error("showSaveFilePicker is not available");
				}
				const fileHandle = await pickerWindow.showSaveFilePicker({
					suggestedName: fileName,
					types: [{
						description: t("common.jsonFile"),
						accept: { 'application/json': ['.json'] }
					}]
				});

				// Get a writable stream and write the content
				const writableStream = await fileHandle.createWritable();
				await writableStream.write(jsonString);
				await writableStream.close();
			} catch (err) {
				// If the error is AbortError (user canceled), don't fallback
				if (err instanceof DOMException && err.name === 'AbortError') {
					return; // Exit without fallback
				}

				// For other errors, fall back to the traditional method
				console.error("Error using File System Access API:", err);
				downloadFallback(jsonString, fileName);
			}
		} else {
			// Browser doesn't support File System Access API, use fallback
			downloadFallback(jsonString, fileName);
		}
	};

	// Fallback download method for browsers without File System Access API support
	const downloadFallback = (content: string, fileName: string) => {
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();

		// Clean up
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleImportClick = () => {
		// Trigger the hidden file input
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				if (typeof result !== "string") {
					throw new Error("Unsupported file content");
				}
				const parsedData: unknown = JSON.parse(result);

				applyImportedPayload(parsedData);
			} catch (error) {
				console.error("Failed to parse imported data:", error);
				alert(t("table.alerts.invalidImport"));
			}
		};
		reader.readAsText(file);

		// Reset the input so the same file can be selected again
		if (event.target) {
			event.target.value = '';
		}
	};

	// Modified to check the click target before opening dialog
	const handleRowClick = (event: React.MouseEvent, row: TData) => {
		// Check if the click target is an interactive element
		const target = event.target as HTMLElement;

		// Don't open dialog if clicking on interactive elements
		const isInteractive =
			target.tagName.toLowerCase() === 'input' ||
			target.tagName.toLowerCase() === 'select' ||
			target.tagName.toLowerCase() === 'button' ||
			target.tagName.toLowerCase() === 'textarea' ||
			target.contentEditable === 'true' ||
			target.closest('input') !== null ||
			target.closest('select') !== null ||
			target.closest('button') !== null ||
			target.closest('textarea') !== null ||
			target.closest('[contenteditable="true"]') !== null ||
			target.closest('[role="combobox"]') !== null ||
			target.closest('[role="listbox"]') !== null ||
			target.closest('[role="option"]') !== null ||
			target.closest('[data-slot="select-trigger"]') !== null ||
			target.closest('[data-slot="select-content"]') !== null ||
			target.closest('[data-slot="select-item"]') !== null;

		if (!isInteractive) {
			setSelectedRow(row);
			setIsDialogOpen(true);
		}
	};

	const handleCloseDialog = () => {
		setIsDialogOpen(false);
		setSelectedRow(null);
	};

	const handleDeleteRow = () => {
		if (selectedRow && onDeleteRow) {
			onDeleteRow(selectedRow);
			handleCloseDialog();
		}
	};

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		autoResetPageIndex: false,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: setColumnVisibility,
		meta: meta,
	});

	return (
		<div className="rounded-md border">
			<Table className="border-collapse leading-tight overflow-hidden">
				<TableHeader className="bg-background hover:bg-background">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-background">
							{headerGroup.headers.map((header) => {
								return (
									<TableHead
										key={header.id}
										colSpan={header.colSpan}
										className="p-1 bg-background hover:bg-background text-black dark:text-foreground"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody ref={parent} className="overflow-hidden w-full">
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<MemoizedRow
								key={row.id}
								row={row}
								onClick={handleRowClick}
							/>
						))
					) : (<></>
						// <TableRow>
						// 	<TableCell
						// 		colSpan={columns.length}
						// 		className="h-24 text-center"
						// 	>
						// 		No data.
						// 	</TableCell>
						// </TableRow>
					)}
				</TableBody>
			</Table>
			<div className="flex justify-between w-full print:hidden">
				<div className="flex gap-3 p-4">
					<Button
						onClick={() => {
							void handleExportData();
						}}
						variant="outline"
						className="cursor-pointer transition-colors"
						disabled={!table.getRowModel().rows.length}
					>
						<Download className="mr-2 h-4 w-4" /> {t("table.actions.export")}
					</Button>
					<Button
						onClick={handleImportClick}
						variant="outline"
						className="cursor-pointer transition-colors"
					>
						<Upload className="mr-2 h-4 w-4" /> {t("table.actions.import")}
					{/* Hidden file input for import */}
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileUpload}
						accept=".json"
						title={t("table.actions.importJsonTitle")}
						className="hidden"
					/>
					</Button>
				</div>
				<div className="flex gap-3 p-4">
					{onDeleteAllRows && (
						<Button
							variant="destructive"
							onClick={onDeleteAllRows}
							disabled={!table.getRowModel().rows.length}
							className={cn("cursor-pointer transition-colors",
										meta?.deleteConfirmState && "bg-white-500 text-red-500 border"
									)}
						>
							<Trash2 /> {meta?.deleteConfirmState ? t("table.actions.confirmDeleteAll") : t("table.actions.deleteAll")}
						</Button>
					)}
					{onAddRow && (
						<Button
							onClick={onAddRow}
							className="cursor-pointer transition-colors"
						>
							<Plus /> {t("table.actions.addRow")}
						</Button>
					)}
				</div>
			</div>


			{/* Row Detail Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("table.dialogs.rowDetailsTitle")}</DialogTitle>
						<DialogDescription>
							{t("table.dialogs.rowDetailsDescription")}
						</DialogDescription>
					</DialogHeader>
					{selectedRow && (
						<div className="py-4">
							{renderRowDetails ? renderRowDetails(selectedRow) : columns.map((column, i) => {
								const id = getColumnId(column);
								if (!id) return null;
								const selectedRowCandidate: unknown = selectedRow;
								if (!isRecord(selectedRowCandidate)) {
									return null;
								}

								return (
									<div key={i} className="mb-2">
										<div className="font-medium">{String(column.header)}</div>
										<div className="text-sm">
												{toDisplayString(selectedRowCandidate[id], t("common.na"), locale)}
										</div>
									</div>
								);
							})}
						</div>
						)}

					<DialogFooter className="flex justify-between gap-2 pt-4">
						{onDeleteRow && (
							<Button variant="destructive" onClick={handleDeleteRow} className="cursor-pointer">
								<Trash2 className="mr-2 h-4 w-4" /> {t("table.actions.removeRow")}
							</Button>
						)}
						<DialogClose render={<Button variant="outline" className="cursor-pointer" />}>
							{t("common.close")}
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner;
