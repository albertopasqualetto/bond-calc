import { useState, useRef, useEffect } from "react"
import YieldsTable from "./table/table"
import { Button } from "@/components/ui/button"
import { PenLine, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import "./print.css"

export default function App() {
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
				<span className="text-4xl font-extrabold tracking-tight lg:text-5xl">
					Financial Assets of
				</span>
				<div className="flex items-baseline">
					{!isEditing ? (
						<span className="text-4xl font-semibold tracking-tight first:mt-0 ml-2 inline-block">
							{name || "Owner"}
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
