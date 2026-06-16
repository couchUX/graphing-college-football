import { Combobox, Listbox } from "@headlessui/react";
import { Check, ChevronDown, Play } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
	fetchGamesForTeam,
	fetchTeams,
	type Team,
	type TeamGame,
} from "../services/api";
import { colorPalette } from "../utils/colorPalette";
import { getTeamColors } from "../utils/teamColors";

interface SeasonSelectorProps {
	onFetchData: (params: {
		year: number;
		team: string;
		selectedGameIds: number[];
	}) => void;
	isLoading: boolean;
	loadingProgress: { current: number; total: number };
	selectedTeamColor: string;
	setSelectedTeamColor: (value: string) => void;
}

const SeasonSelector: React.FC<SeasonSelectorProps> = ({
	onFetchData,
	isLoading,
	loadingProgress,
	selectedTeamColor,
	setSelectedTeamColor,
}) => {
	const [year, setYear] = useState<number>(2025);
	const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
	const [teamQuery, setTeamQuery] = useState<string>("");
	const [showTeamColorPicker, setShowTeamColorPicker] =
		useState<boolean>(false);
	const [showGameSelector, setShowGameSelector] = useState<boolean>(false);
	const [teams, setTeams] = useState<Team[]>([]);
	const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
	const [availableGames, setAvailableGames] = useState<TeamGame[]>([]);
	const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
	const [loadingGames, setLoadingGames] = useState<boolean>(false);

	// Refs for click outside functionality
	const teamColorPickerRef = useRef<HTMLDivElement>(null);
	const gameSelectorRef = useRef<HTMLDivElement>(null);

	const handleFetchData = () => {
		if (selectedTeam && selectedGameIds.length > 0) {
			onFetchData({
				year,
				team: selectedTeam.school,
				selectedGameIds,
			});
		}
	};

	// Handle clicks outside dropdowns
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				teamColorPickerRef.current &&
				!teamColorPickerRef.current.contains(event.target as Node)
			) {
				setShowTeamColorPicker(false);
			}
			if (
				gameSelectorRef.current &&
				!gameSelectorRef.current.contains(event.target as Node)
			) {
				setShowGameSelector(false);
			}
		};

		if (showTeamColorPicker || showGameSelector) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [showTeamColorPicker, showGameSelector]);

	// Track if we should restore from URL
	const [urlGamesToRestore, setUrlGamesToRestore] = useState<string | null>(
		null,
	);
	const [isLoadingFromURL, setIsLoadingFromURL] = useState<boolean>(false);
	const [shouldAutoFetch, setShouldAutoFetch] = useState<boolean>(false);
	const [hasRestoredFromURL, setHasRestoredFromURL] = useState<boolean>(false);

	// Load games when team or year changes
	useEffect(() => {
		const loadGames = async () => {
			if (!selectedTeam) {
				setAvailableGames([]);
				setSelectedGameIds([]);
				setHasRestoredFromURL(false); // Reset when team is cleared
				return;
			}

			// Reset hasRestoredFromURL when manually changing team/year (not during URL load)
			if (!isLoadingFromURL && hasRestoredFromURL) {
				setHasRestoredFromURL(false);
			}

			setLoadingGames(true);
			try {
				const games = await fetchGamesForTeam({
					year,
					team: selectedTeam.school,
				});

				// Filter out games that haven't been played yet (completed = true)
				const completedGames = games.filter((g) => g.completed);

				// Sort chronologically
				const sortedGames = completedGames.sort((a, b) => {
					if (a.seasonType !== b.seasonType) {
						return a.seasonType === "regular" ? -1 : 1;
					}
					return a.week - b.week;
				});

				setAvailableGames(sortedGames);

				// Check if we need to restore game selection from URL
				if (urlGamesToRestore !== null) {
					let selectedIds: number[];

					if (urlGamesToRestore === "all") {
						// Select all games
						selectedIds = sortedGames.map((g) => g.id);
					} else {
						// Parse indices and select those games (support both hyphen and comma for backwards compatibility)
						const separator = urlGamesToRestore.includes('-') ? '-' : ',';
						const indices = urlGamesToRestore
							.split(separator)
							.map((i) => parseInt(i))
							.filter((i) => !isNaN(i));
						selectedIds = indices
							.map((i) => sortedGames[i]?.id)
							.filter((id) => id !== undefined);
						if (selectedIds.length === 0) {
							selectedIds = sortedGames.map((g) => g.id);
						}
					}

					setSelectedGameIds(selectedIds);
					setUrlGamesToRestore(null); // Clear the restore flag
					setHasRestoredFromURL(true); // Mark that we've restored

					// Auto-fetch if we loaded from URL
					if (isLoadingFromURL && selectedIds.length > 0) {
						setShouldAutoFetch(true);
					}
				} else if (!isLoadingFromURL && !hasRestoredFromURL) {
					// Only reset to all games if we're not loading from URL AND haven't already restored
					setSelectedGameIds(sortedGames.map((g) => g.id));
				}
				// else: We're either loading from URL or have already restored - don't change selection
			} catch (error) {
				console.error("Error loading games:", error);
				setAvailableGames([]);
				setSelectedGameIds([]);
			} finally {
				setLoadingGames(false);
			}
		};

		loadGames();
	}, [selectedTeam, year, urlGamesToRestore, isLoadingFromURL]);

	// Load teams on mount and check URL parameters
	useEffect(() => {
		const loadTeams = async () => {
			setLoadingTeams(true);
			try {
				const teamsData = await fetchTeams();
				const sortedTeams = teamsData.sort((a, b) =>
					a.school.localeCompare(b.school),
				);
				setTeams(sortedTeams);

				// After teams load, check for URL parameters
				const urlParams = new URLSearchParams(window.location.search);
				const urlYear = urlParams.get("year");
				const urlTeam = urlParams.get("team");
				const urlGames = urlParams.get("games");
				const urlTeamColor = urlParams.get("teamColor");

				// Check if we have URL parameters to load from
				const hasUrlParams = urlYear && urlTeam;

				if (hasUrlParams) {
					setIsLoadingFromURL(true);
				}

				// Apply URL parameters if present
				if (urlYear) {
					const parsedYear = parseInt(urlYear);
					if (!isNaN(parsedYear)) {
						setYear(parsedYear);
					}
				}

				if (urlTeam) {
					const team = sortedTeams.find(
						(t) => t.school.toLowerCase() === urlTeam.toLowerCase(),
					);
					if (team) {
						setSelectedTeam(team);
					}
				}

				// Store games parameter to restore after games load
				if (urlGames) {
					setUrlGamesToRestore(urlGames);
				} else if (hasUrlParams) {
					// If we have URL params but no games param, default to 'all'
					setUrlGamesToRestore("all");
				}

				if (urlTeamColor) {
					setSelectedTeamColor(urlTeamColor);
				}
			} catch (error) {
				console.error("Error loading teams:", error);
			} finally {
				setLoadingTeams(false);
			}
		};

		loadTeams();
	}, [setSelectedTeamColor]);

	// Auto-fetch data when URL parameters are loaded
	useEffect(() => {
		if (
			shouldAutoFetch &&
			selectedTeam &&
			selectedGameIds.length > 0 &&
			!loadingGames &&
			!isLoading
		) {
			// Trigger the fetch with a small delay to ensure UI is ready
			const timeoutId = setTimeout(() => {
				onFetchData({
					year,
					team: selectedTeam.school,
					selectedGameIds,
				});
				setShouldAutoFetch(false);
				// Clear the loading flag after a brief delay to ensure fetch has started
				setTimeout(() => setIsLoadingFromURL(false), 200);
			}, 100);

			return () => clearTimeout(timeoutId);
		}
	}, [
		shouldAutoFetch,
		selectedTeam,
		selectedGameIds,
		loadingGames,
		isLoading,
		year,
		onFetchData,
	]);

	// Filter teams based on query
	const filteredTeams =
		teamQuery === ""
			? teams.slice(0, 20) // Show first 20 teams when no query
			: teams
					.filter((team) =>
						team.school.toLowerCase().includes(teamQuery.toLowerCase()),
					)
					.slice(0, 10); // Show top 10 matches

	const years = [
		2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014,
	];

	// Get postseason game label (matching Games page logic)
	const getPostseasonLabel = (game: TeamGame, allGames: TeamGame[]) => {
		if (!game.notes) {
			// If no notes, use chronological numbering for multiple postseason games
			const postseasonGames = allGames
				.filter((g) => g.seasonType === "postseason")
				.sort(
					(a, b) =>
						new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
				);

			if (postseasonGames.length > 1) {
				const gameIndex = postseasonGames.findIndex((g) => g.id === game.id);
				return `Postseason ${gameIndex + 1}`;
			}
			return `Postseason ${game.week}`;
		}

		const notes = game.notes.toUpperCase();

		// Championship game patterns (most specific first)
		if (
			notes.includes("NATIONAL CHAMPIONSHIP") ||
			notes.includes("CFP NATIONAL CHAMPIONSHIP")
		) {
			return "National Championship";
		}
		if (notes.includes("SEMIFINAL")) return "CFP Semifinal";
		if (notes.includes("SEC CHAMPIONSHIP")) return "SEC Championship";
		if (notes.includes("BIG TEN CHAMPIONSHIP")) return "Big Ten Championship";
		if (notes.includes("ACC CHAMPIONSHIP")) return "ACC Championship";
		if (notes.includes("BIG 12 CHAMPIONSHIP")) return "Big 12 Championship";
		if (notes.includes("PAC-12 CHAMPIONSHIP")) return "Pac-12 Championship";

		// Major bowl games
		if (notes.includes("ROSE BOWL")) return "Rose Bowl";
		if (notes.includes("SUGAR BOWL")) return "Sugar Bowl";
		if (notes.includes("ORANGE BOWL")) return "Orange Bowl";
		if (notes.includes("PEACH BOWL")) return "Peach Bowl";
		if (notes.includes("COTTON BOWL")) return "Cotton Bowl";
		if (notes.includes("FIESTA BOWL")) return "Fiesta Bowl";

		// Other major bowls
		if (notes.includes("CITRUS BOWL")) return "Citrus Bowl";
		if (notes.includes("OUTBACK BOWL")) return "Outback Bowl";
		if (notes.includes("GATOR BOWL")) return "Gator Bowl";
		if (notes.includes("LIBERTY BOWL")) return "Liberty Bowl";
		if (notes.includes("HOLIDAY BOWL")) return "Holiday Bowl";
		if (notes.includes("ALAMO BOWL")) return "Alamo Bowl";

		// General playoff detection (fallback)
		if (notes.includes("PLAYOFF") || notes.includes("CFP")) {
			const postseasonGames = allGames
				.filter((g) => g.seasonType === "postseason")
				.sort(
					(a, b) =>
						new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
				);

			if (postseasonGames.length > 1) {
				const gameIndex = postseasonGames.findIndex((g) => g.id === game.id);
				return gameIndex === 0 ? "CFP Semifinal" : "National Championship";
			}
		}

		// Generic bowl game - try to extract bowl name
		if (notes.includes("BOWL")) {
			const bowlMatch = notes.match(/(\w+(?:\s+\w+)*)\s+BOWL/);
			if (bowlMatch) {
				return `${bowlMatch[1].toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())} Bowl`;
			}
		}

		// Final fallback: use chronological numbering
		const postseasonGames = allGames
			.filter((g) => g.seasonType === "postseason")
			.sort(
				(a, b) =>
					new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
			);

		if (postseasonGames.length > 1) {
			const gameIndex = postseasonGames.findIndex((g) => g.id === game.id);
			return `Postseason ${gameIndex + 1}`;
		}

		return `Postseason ${game.week}`;
	};

	// Update URL with current selections
	const updateURL = () => {
		// Start from the current query so other sub-views' params (view, aTeam,
		// bTeam, etc.) are preserved while editing the Season trends view.
		const params = new URLSearchParams(window.location.search);

		params.set("year", year.toString());

		if (selectedTeam) {
			params.set("team", selectedTeam.school);
		} else {
			params.delete("team");
		}

		// Use indices instead of game IDs for compact URLs
		// Only add 'games' parameter if not all games are selected (default is all)
		params.delete("games");
		if (selectedGameIds.length > 0 && availableGames.length > 0) {
			const allGameIds = availableGames.map((g) => g.id);
			const selectedIndices = selectedGameIds
				.map((id) => allGameIds.indexOf(id))
				.filter((index) => index !== -1)
				.sort((a, b) => a - b);

			// Only include games parameter when specific games are selected (not all)
			if (selectedIndices.length !== availableGames.length) {
				params.set("games", selectedIndices.join("-"));
			}
		}

		if (selectedTeamColor !== "default") {
			params.set("teamColor", selectedTeamColor);
		} else {
			params.delete("teamColor");
		}

		const newURL = params.toString()
			? `${window.location.pathname}?${params.toString()}`
			: window.location.pathname;
		window.history.replaceState({}, "", newURL);
	};

	// Update URL when selections change
	useEffect(() => {
		if (teams.length > 0 && availableGames.length > 0 && !isLoadingFromURL) {
			// Only update URL after teams and games have loaded AND we're not loading from URL
			// This prevents overwriting URL params during initial page load
			updateURL();
		}
	}, [
		year,
		selectedTeam,
		selectedGameIds,
		selectedTeamColor,
		teams.length,
		availableGames.length,
		isLoadingFromURL,
	]);

	return (
		<div className="flex flex-wrap items-end gap-4">
			{/* Year and Team Row */}
			<div className="w-full sm:contents">
				<div className="flex gap-2 w-full sm:gap-4 sm:flex-1">
					{/* Year Dropdown */}
					<div className="flex-shrink-0 sm:w-auto">
						<label className="block text-sm font-medium text-neutral-700 mb-2">
							Year
						</label>
						<Listbox value={year} onChange={setYear}>
							<div className="relative">
								<Listbox.Button className="relative w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 pr-10 text-left shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-default">
									<span className="block truncate">{year}</span>
									<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
										<ChevronDown
											className="h-4 w-4 text-neutral-400"
											aria-hidden="true"
										/>
									</span>
								</Listbox.Button>
								<Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
									{years.map((yearOption) => (
										<Listbox.Option
											key={yearOption}
											className={({ active }) =>
												`relative cursor-default select-none py-2 pl-3 pr-9 ${
													active
														? "bg-blue-100 text-blue-900"
														: "text-neutral-900"
												}`
											}
											value={yearOption}
										>
											{({ selected }) => (
												<>
													<span
														className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
													>
														{yearOption}
													</span>
													{selected ? (
														<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
															<Check className="h-4 w-4" aria-hidden="true" />
														</span>
													) : null}
												</>
											)}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>

					{/* Team Type-ahead */}
					<div className="flex-1 min-w-0">
						<label className="block text-sm font-medium text-neutral-700 mb-2">
							Team
						</label>
						<Combobox value={selectedTeam} onChange={setSelectedTeam}>
							<div className="relative">
								<Combobox.Input
									className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 pr-16 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
									displayValue={(team: Team | null) => team?.school || ""}
									onChange={(event) => setTeamQuery(event.target.value)}
									placeholder="e.g., Alabama"
								/>
								{/* Color Picker inside input */}
								{selectedTeam && (
									<div className="absolute inset-y-0 right-10 flex items-center">
										<div
											className="w-5 h-5 rounded border border-neutral-200 cursor-pointer hover:scale-110 transition-transform"
											style={{
												backgroundColor: (() => {
													if (selectedTeamColor === "default") {
														const teamColors = getTeamColors(
															selectedTeam.school,
														);
														return teamColors.success
															.replace(/rgba\(([^)]+)\)/, "rgb($1)")
															.replace(", 0.8", "");
													}
													const customColor = colorPalette.find(
														(c) => c.id === selectedTeamColor,
													);
													return customColor ? customColor.primary : "#6B7280";
												})(),
											}}
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setShowTeamColorPicker(!showTeamColorPicker);
											}}
										/>
									</div>
								)}
								<Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
									<ChevronDown
										className="h-4 w-4 text-neutral-400"
										aria-hidden="true"
									/>
								</Combobox.Button>
								<Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
									{loadingTeams ? (
										<div className="px-4 py-2 text-sm text-neutral-500">
											Loading teams...
										</div>
									) : filteredTeams.length === 0 && teamQuery !== "" ? (
										<div className="px-4 py-2 text-sm text-neutral-500">
											No teams found.
										</div>
									) : (
										filteredTeams.map((team) => (
											<Combobox.Option
												key={team.id}
												className={({ active }) =>
													`relative cursor-default select-none py-2 pl-3 pr-9 ${
														active
															? "bg-blue-100 text-blue-900"
															: "text-neutral-900"
													}`
												}
												value={team}
											>
												{({ selected }) => (
													<>
														<span
															className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
														>
															{team.school}
														</span>
														{selected ? (
															<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
																<Check className="h-4 w-4" aria-hidden="true" />
															</span>
														) : null}
													</>
												)}
											</Combobox.Option>
										))
									)}
								</Combobox.Options>

								{/* Team Color Picker Dropdown */}
								{showTeamColorPicker && selectedTeam && (
									<div
										ref={teamColorPickerRef}
										className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 p-2"
									>
										<div className="grid grid-cols-5 gap-1 w-40">
											{/* Default option */}
											<button
												type="button"
												onClick={() => {
													setSelectedTeamColor("default");
													setShowTeamColorPicker(false);
												}}
												className={`w-7 h-7 rounded border-2 transition-all ${
													selectedTeamColor === "default"
														? "border-neutral-900 scale-110"
														: "border-neutral-200 hover:border-neutral-400"
												}`}
												style={{
													backgroundColor: (() => {
														const teamColors = getTeamColors(
															selectedTeam.school,
														);
														return teamColors.success
															.replace(/rgba\(([^)]+)\)/, "rgb($1)")
															.replace(", 0.8", "");
													})(),
												}}
												title="Default team colors"
											>
												{selectedTeamColor === "default" && (
													<div className="absolute inset-0 flex items-center justify-center">
														<div className="w-2 h-2 bg-white rounded-full border border-neutral-900"></div>
													</div>
												)}
											</button>

											{/* Color palette options */}
											{colorPalette.map((color) => (
												<button
													key={color.id}
													type="button"
													onClick={() => {
														setSelectedTeamColor(color.id);
														setShowTeamColorPicker(false);
													}}
													className={`w-7 h-7 rounded border-2 transition-all ${
														selectedTeamColor === color.id
															? "border-neutral-900 scale-110"
															: "border-neutral-200 hover:border-neutral-400"
													}`}
													style={{ backgroundColor: color.primary }}
													title={`Custom color: ${color.id}`}
												/>
											))}
										</div>
									</div>
								)}
							</div>
						</Combobox>
					</div>
				</div>
			</div>

			{/* Game Selector - Only show when team is selected */}
			{selectedTeam && (
				<div className="flex-1 min-w-0">
					<label className="block text-sm font-medium text-neutral-700 mb-2">
						Games
					</label>
					<div className="relative" ref={gameSelectorRef}>
						<button
							type="button"
							onClick={() => setShowGameSelector(!showGameSelector)}
							disabled={!selectedTeam || loadingGames}
							className="relative w-full bg-white border border-neutral-300 rounded-lg px-4 py-3 pr-10 text-left shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-neutral-100 disabled:cursor-not-allowed"
						>
							<span className="block truncate">
								{loadingGames
									? "Loading games..."
									: selectedGameIds.length === 0
										? "No games selected"
										: selectedGameIds.length === availableGames.length
											? "All games"
											: `${selectedGameIds.length} game${selectedGameIds.length === 1 ? "" : "s"}`}
							</span>
							<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
								<ChevronDown
									className="h-4 w-4 text-neutral-400"
									aria-hidden="true"
								/>
							</span>
						</button>

						{/* Game Selector Dropdown */}
						{showGameSelector && availableGames.length > 0 && (
							<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
								{/* Select All / Deselect All */}
								<div className="sticky top-0 bg-neutral-50 border-b border-neutral-200 px-4 py-2">
									<button
										type="button"
										onClick={() => {
											if (selectedGameIds.length === availableGames.length) {
												setSelectedGameIds([]);
											} else {
												setSelectedGameIds(availableGames.map((g) => g.id));
											}
										}}
										className="text-sm text-blue-600 hover:text-blue-700 font-medium"
									>
										{selectedGameIds.length === availableGames.length
											? "Deselect All"
											: "Select All"}
									</button>
								</div>

								{/* Game Checkboxes */}
								<div className="py-1">
									{availableGames.map((game) => {
										const isSelected = selectedGameIds.includes(game.id);
										const prefix =
											game.homeTeam === selectedTeam?.school ? "vs" : "@";
										const opponent =
											game.homeTeam === selectedTeam?.school
												? game.awayTeam
												: game.homeTeam;

										// Format label based on game type
										const label =
											game.seasonType === "regular"
												? `Week ${game.week}: ${prefix} ${opponent}`
												: `${getPostseasonLabel(game, availableGames)}: ${prefix} ${opponent}`;

										return (
											<label
												key={game.id}
												className="flex items-center px-4 py-2 hover:bg-neutral-50 cursor-pointer"
											>
												<input
													type="checkbox"
													checked={isSelected}
													onChange={(e) => {
														if (e.target.checked) {
															setSelectedGameIds([...selectedGameIds, game.id]);
														} else {
															setSelectedGameIds(
																selectedGameIds.filter((id) => id !== game.id),
															);
														}
													}}
													className="h-4 w-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
												/>
												<span className="ml-3 text-sm text-neutral-900">
													{label}
												</span>
											</label>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Fetch Button */}
			<div className="w-full sm:flex-shrink-0 sm:w-auto">
				<button
					onClick={handleFetchData}
					disabled={!selectedTeam || isLoading || selectedGameIds.length === 0}
					className="w-full sm:w-auto flex items-center justify-center sm:justify-start space-x-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
				>
					{isLoading && loadingProgress.total > 0 ? (
						<span>
							Loading ({loadingProgress.current}/{loadingProgress.total})
						</span>
					) : isLoading ? (
						<span>Loading...</span>
					) : (
						<>
							<span>Fetch Season Data</span>
							<Play className="h-5 w-5" />
						</>
					)}
				</button>
			</div>
		</div>
	);
};

export default SeasonSelector;
