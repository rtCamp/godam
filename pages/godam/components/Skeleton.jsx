const Skeleton = () => {
	return (
		<div id="main-content" className="w-full p-5 bg-white">
			<div className="loading-skeleton flex flex-col gap-4">
				<div className="skeleton-container skeleton-container-short">
					<div className="skeleton-header w-1/2"></div>
				</div>
				<div className="skeleton-container">
					<div className="skeleton-line w-3/4"></div>
					<div className="skeleton-line short w-1/2"></div>
				</div>
				<div className="flex gap-2">
					<div className="skeleton-button w-32 h-10"></div>
					<div className="skeleton-button w-40 h-10"></div>
				</div>
			</div>
		</div>
	);
};

export default Skeleton;
