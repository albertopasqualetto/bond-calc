import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					minSize: 20_000,
					groups: [
						{
							name: "react-vendor",
							test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
							priority: 30,
						},
						{
							name: "table-vendor",
							test: /node_modules[\\/]@tanstack[\\/]/,
							priority: 25,
						},
						{
							name: "i18n-vendor",
							test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
							priority: 20,
						},
						{
							name: "ui-vendor",
							test: /node_modules[\\/](@base-ui|lucide-react|react-day-picker|date-fns)[\\/]/,
							priority: 15,
						},
						{
							name: "vendor",
							test: /node_modules/,
							priority: 10,
						},
					],
				},
			},
		},
	},
	// define: {
	//   'process.env': process.env  // TODO: check if this works after build
	// },
	base: "/bond-calc/",
	preview: {
		port: 8080,
		strictPort: true,
	},
	server: {
		port: 8080,
		strictPort: true,
		host: true,
		origin: "http://0.0.0.0:8080",
	},
});
