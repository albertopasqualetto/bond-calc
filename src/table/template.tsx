"use client";

import {
	ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
	VisibilityState,
	Row,
} from "@tanstack/react-table";
import { useState, useEffect, useRef, memo } from "react";

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
import { cn } from "@/lib/utils"

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
		updateData: (rowIndex: number, columnId: string, value: any) => void;
		deleteConfirmState?: boolean;
	};
	defaultData?: TData[]; // Default data to use if nothing in storage
}

// Create a memoized row component
const MemoizedRow = memo(function TableRowMemoized<TData, TValue>({
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
			onClick={(e) => onClick(e, row.original as TData)}
			className="cursor-pointer hover:bg-muted/50"
		>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id} className="p-1">
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	);
});

// Wrap the DataTable component with React.memo
export const DataTable = memo(function DataTable<TData, TValue>({
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
}: DataTableProps<TData, TValue>) {
	const [selectedRow, setSelectedRow] = useState<TData | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [isPrinting, setIsPrinting] = useState(false);

	// Set up print media query listener
	useEffect(() => {
		// Function to check if we're in print mode
		const checkPrintMode = () => {
			const isPrintMode = window.matchMedia('print').matches ||
				window.matchMedia('(max-width: 0px)').matches;

			setIsPrinting(isPrintMode);

			// If printing, update column visibility based on meta.printable property
			if (isPrintMode) {
				const newVisibility: VisibilityState = {};
				// Check each column for meta.printable property
				columns.forEach(col => {
					// If column has meta.printable === false, hide it
					// Use column id or accessorKey as the key
					const columnId = String(col.id || col.accessorKey);
					if (columnId && col.meta && col.meta.printable === false) {
						newVisibility[columnId] = false;
					}

					// Check nested columns if they exist
					if ('columns' in col && Array.isArray(col.columns)) {
						col.columns.forEach(nestedCol => {
							const nestedColumnId = String(nestedCol.id || nestedCol.accessorKey);
							if (nestedColumnId && nestedCol.meta && nestedCol.meta.printable === false) {
								newVisibility[nestedColumnId] = false;
							}
						});
					}
				});
				setColumnVisibility(prev => ({...prev, ...newVisibility}));
			} else {
				// When not printing, show all columns
				const newVisibility: VisibilityState = {};
					columns.forEach(col => {
					const columnId = String(col.id || col.accessorKey);
					if (columnId) {
						newVisibility[columnId] = true;
					}

					// Reset nested columns if they exist
					if ('columns' in col && Array.isArray(col.columns)) {
						col.columns.forEach(nestedCol => {
							const nestedColumnId = String(nestedCol.id || nestedCol.accessorKey);
							if (nestedColumnId) {
								newVisibility[nestedColumnId] = true;
							}
						});
					}
				});
				setColumnVisibility(prev => ({...prev, ...newVisibility}));
			}
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
		window.addEventListener('beforeprint', () => setIsPrinting(true));
		window.addEventListener('afterprint', () => setIsPrinting(false));

		return () => {
			// Clean up
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener('change', handlePrintChange);
			} else if (mediaQueryList.removeListener) {
				mediaQueryList.removeListener(handlePrintChange);
			}
			window.removeEventListener('beforeprint', () => setIsPrinting(true));
			window.removeEventListener('afterprint', () => setIsPrinting(false));
		};
	}, [columns]);  // Added columns as a dependency

	// Update the other useEffect to use the same column checking logic
	useEffect(() => {
		if (isPrinting) {
			const newVisibility: VisibilityState = {};
			columns.forEach(col => {
				const columnId = String(col.id || col.accessorKey);
				if (columnId && col.meta && col.meta.printable === false) {
					newVisibility[columnId] = false;
				}

				// Check nested columns if they exist
				if ('columns' in col && Array.isArray(col.columns)) {
					col.columns.forEach(nestedCol => {
						const nestedColumnId = String(nestedCol.id || nestedCol.accessorKey);
						if (nestedColumnId && nestedCol.meta && nestedCol.meta.printable === false) {
							newVisibility[nestedColumnId] = false;
						}
					});
				}
			});
			setColumnVisibility(prev => ({...prev, ...newVisibility}));
		} else {
			const newVisibility: VisibilityState = {};
			columns.forEach(col => {
				const columnId = String(col.id || col.accessorKey);
				if (columnId) {
					newVisibility[columnId] = true;
				}

				// Reset nested columns if they exist
				if ('columns' in col && Array.isArray(col.columns)) {
					col.columns.forEach(nestedCol => {
						const nestedColumnId = String(nestedCol.id || nestedCol.accessorKey);
						if (nestedColumnId) {
							newVisibility[nestedColumnId] = true;
						}
					});
				}
			});
			setColumnVisibility(prev => ({...prev, ...newVisibility}));
		}
	}, [isPrinting, columns]);  // Added columns as a dependency

	// Load data from local storage on component mount
	useEffect(() => {
		if (localStorageKey && typeof window !== 'undefined') {
			const savedData = localStorage.getItem(localStorageKey);
			if (savedData) {
				try {
					const parsedData = JSON.parse(savedData);
					if (parsedData.ownerName === "" && parsedData.tableData.length === 0) {
						throw new Error("Empty data");
					}

					// Extract owner name if present
					if (parsedData.ownerName && onNameChange && parsedData.ownerName !== name) {
						onNameChange(parsedData.ownerName);
					}

					// Extract table data if present
					if (parsedData.tableData && onDataChange) {
						// Parse dates back to Date objects
						const processedData = parsedData.tableData.map((item: any) => ({
							...item,
							settlementDate: item.settlementDate ? new Date(item.settlementDate) : null,
							maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
						}));
						onDataChange(processedData);
					} else if (!parsedData.tableData && Array.isArray(parsedData) && onDataChange) {
						// Handle legacy format where data was stored directly without ownerName
						const processedData = parsedData.map((item: any) => ({
							...item,
							settlementDate: item.settlementDate ? new Date(item.settlementDate) : null,
							maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
						}));
						onDataChange(processedData);
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
	}, [localStorageKey]); // Only run on mount

	// Save data to local storage whenever it changes
	useEffect(() => {
		if (localStorageKey && typeof window !== 'undefined') {
			const dataToStore = {
				tableData: data,
				ownerName: name
			};
			localStorage.setItem(localStorageKey, JSON.stringify(dataToStore));
		}
	}, [data, name, localStorageKey]);

	const handleExportData = async () => {
		// Prepare the data to export
		const dataToExport = {
			tableData: data,
			ownerName: name
		};

		const jsonString = JSON.stringify(dataToExport, null, 2);
		const fileName = `${name || 'financial-assets'}-export.json`;

		// Check if the File System Access API is supported
		if ('showSaveFilePicker' in window) {
			try {
				// Use File System Access API
				const fileHandle = await window.showSaveFilePicker({
					suggestedName: fileName,
					types: [{
						description: 'JSON File',
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
				const result = e.target?.result as string;
				const parsedData = JSON.parse(result);

				// Extract owner name if present
				if (parsedData.ownerName && onNameChange) {
					onNameChange(parsedData.ownerName);
				}

				// Extract and process table data
				if (parsedData.tableData && onDataChange) {
					// Parse dates back to Date objects
					const processedData = parsedData.tableData.map((item: any) => ({
						...item,
						settlementDate: item.settlementDate ? new Date(item.settlementDate) : null,
						maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
					}));
					onDataChange(processedData);
				} else if (Array.isArray(parsedData) && onDataChange) {
					// Handle case where data might be just an array
					const processedData = parsedData.map((item: any) => ({
						...item,
						settlementDate: item.settlementDate ? new Date(item.settlementDate) : null,
						maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
					}));
					onDataChange(processedData);
				}
			} catch (error) {
				console.error("Failed to parse imported data:", error);
				alert("Failed to import data. Please ensure the file is a valid JSON export.");
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
			target.closest('[contenteditable="true"]') !== null;

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
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: setColumnVisibility,
		meta: meta,
	});

	return (
		<div className="rounded-md border">
			<Table className="border-collapse leading-tight">
				<TableHeader className="bg-background hover:bg-background">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-background">
							{headerGroup.headers.map((header) => {
								return (
									<TableHead
										key={header.id}
										colSpan={header.colSpan}
										className="p-1 bg-background hover:bg-background"
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
				<TableBody>
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
						onClick={handleExportData}
						variant="outline"
						className="cursor-pointer"
						disabled={!table.getRowModel().rows.length}
					>
						<Download className="mr-2 h-4 w-4" /> Export
					</Button>
					<Button
						onClick={handleImportClick}
						variant="outline"
						className="cursor-pointer"
					>
						<Upload className="mr-2 h-4 w-4" /> Import
					{/* Hidden file input for import */}
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileUpload}
						accept=".json"
						style={{ display: 'none' }}
					/>
					</Button>
				</div>
				<div className="flex gap-3 p-4">
					{onDeleteAllRows && (
						<Button
							variant="destructive"
							onClick={onDeleteAllRows}
							disabled={!table.getRowModel().rows.length}
							className={cn("cursor-pointer",
										meta?.deleteConfirmState && "bg-white-500 text-red-500 border hover:bg-white-500"
									)}
						>
							<Trash2 /> {meta?.deleteConfirmState ? "Are you sure?" : "Delete All"}
						</Button>
					)}
					{onAddRow && (
						<Button
							onClick={onAddRow}
							className="cursor-pointer"
						>
							<Plus /> Add Row
						</Button>
					)}
				</div>
			</div>


			{/* Row Detail Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Row Details</DialogTitle>
						<DialogDescription>
							Detailed view of the selected asset.
						</DialogDescription>
					</DialogHeader>
					{selectedRow && (
						<div className="py-4">
							{columns.map((column, i) => {
								const id = column.accessorKey || column.id;
								if (!id) return null;

								return (
									<div key={i} className="mb-2">
										<div className="font-medium">{String(column.header)}</div>
										<div className="text-sm">
											{String(selectedRow[id] !== undefined ? selectedRow[id] : 'N/A')}
										</div>
									</div>
								);
							})}
						</div>
						)}

					<DialogFooter className="flex justify-between gap-2 pt-4">
						{onDeleteRow && (
							<Button variant="destructive" onClick={handleDeleteRow} className="cursor-pointer">
								<Trash2 className="mr-2 h-4 w-4" /> Remove Row
							</Button>
						)}
						<DialogClose asChild>
							<Button variant="outline" className="cursor-pointer">
								Close
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
});
