import { useState, useRef, useEffect } from "react"
import YieldsTable from "./table/table"
import { Button } from "@/components/ui/button"
import { PenLine, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import "./global.css"
import "./print.css"

export default function App() {
	const [darkMode, setDarkMode] = useState(() => 
		window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
	);

	useEffect(() => {
		// Apply initial dark mode
		if (darkMode) {
			document.documentElement.classList.add("dark");
			document.body.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
			document.body.classList.remove("dark");
		}

		// Listen for changes in system preference
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent) => {
			setDarkMode(e.matches);
			if (e.matches) {
				document.documentElement.classList.add("dark");
				document.body.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
				document.body.classList.remove("dark");
			}
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	const [name, setName] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isEditing]);

	const changeName = () => {
		if (isEditing) {
			// Save the name if editing
			const newName = inputRef.current?.value;
			if (newName && newName.trim() !== "") {
				setName(newName);
			}
		}
		setIsEditing(!isEditing);
	}

	return (
		<>
			<div className="flex items-baseline justify-center mt-4">
				<span className="text-3xl font-semibold tracking-tight">
					Scheda titoli
				</span>
				<div className="flex items-baseline">
					{!isEditing ? (
						<span className="text-3xl font-semibold tracking-tight first:mt-0 ml-2 inline-block">
							{name || "_"}
						</span>
					) : (
						<Input
							ref={inputRef}
							defaultValue={name}
							onKeyDown={(e) => e.key === "Enter" && changeName()}
						/>
					)}
					<Button
						variant={!isEditing ? "ghost" : "default"}
						onClick={changeName}
						className="size-1 ml-1 print:hidden"
					>
						{isEditing ? (
							<Check className="w-2 h-2" />
						) : (
							<PenLine className="w-2 h-2" />
						)}
					</Button>
				</div>
			</div>
			<YieldsTable
				name={name}
				onNameChange={setName} // Pass the setName function to update name when importing
			/>
		</>
	)
}
