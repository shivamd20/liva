interface CreateBoardCardProps {
	onClick?: () => void;
}

export default function CreateBoardCard({ onClick }: CreateBoardCardProps) {
	return (
		<button
			className="group relative w-full aspect-[16/10] rounded-2xl border-2 border-dashed border-border/60 hover:border-accent/50 bg-foreground/[0.02] hover:bg-accent/[0.04] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background overflow-hidden h-full cursor-pointer"
			aria-label="Create new board"
			onClick={onClick}
		>
			{/* Gradient hover effect */}
			<div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

			{/* Content */}
			<div className="relative z-10 h-full flex flex-col items-center justify-center gap-4 p-6">
				{/* Plus icon */}
				<div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] group-hover:bg-accent/10 border border-border/50 group-hover:border-accent/30 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						className="text-muted-foreground group-hover:text-accent transition-colors duration-300"
					>
						<path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					</svg>
				</div>

				{/* Text */}
				<div className="text-center">
					<p className="text-base font-semibold text-foreground mb-1">Create new board</p>
					<p className="text-sm text-muted-foreground">Start a fresh canvas in seconds</p>
				</div>
			</div>

			{/* Decorative corner elements */}
			<div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-border/30 group-hover:border-accent/40 rounded-tl-sm transition-colors duration-300" />
			<div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-border/30 group-hover:border-accent/40 rounded-tr-sm transition-colors duration-300" />
			<div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-border/30 group-hover:border-accent/40 rounded-bl-sm transition-colors duration-300" />
			<div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-border/30 group-hover:border-accent/40 rounded-br-sm transition-colors duration-300" />
		</button>
	);
}
