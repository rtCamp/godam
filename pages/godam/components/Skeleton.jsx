const Skeleton = () => {
	return (
		<>
			<div className="skeleton-header-broad">
				<div className="skeleton-button"></div>
				<div className="skeleton-header"></div>
				<div className="flex gap-6">
					<div className="skeleton-button"></div>
					<div className="skeleton-button"></div>
				</div>
			</div>

			<div className="wrap godam-skeleton-wrapper">
				<div className="w-full rounded-lg bg-white shadow-md border border-gray-200 max-w-200">
					<nav className="loading-skeleton flex flex-col gap-3 p-4">
						<div className="skeleton-container flex items-center gap-2">
							<div className="skeleton-circle w-5 h-5"></div>
						</div>
						<div className="skeleton-container flex items-center gap-2">
							<div className="skeleton-circle w-5 h-5"></div>
						</div>
						<div className="skeleton-container flex items-center gap-2">
							<div className="skeleton-circle w-5 h-5"></div>
						</div>
						<div className="skeleton-container flex items-center gap-2">
							<div className="skeleton-circle w-5 h-5"></div>
						</div>
					</nav>
				</div>

				<div id="main-content" className="w-full bg-white rounded-lg border flex flex-col gap-6 p-5">

					<div className="skeleton-container"></div>
					<div className="skeleton-container flex items-center gap-3"></div>
					<div className="skeleton-container flex flex-col gap-2"></div>
					<div className="skeleton-button w-24 h-10"></div>
				</div>
			</div>
		</>
	);
};

export default Skeleton;
