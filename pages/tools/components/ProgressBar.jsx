// Alternative inline version (similar to your original)
const ProgressBar = ( { showInitialProgress, done, total } ) => {
	const calculateSafePercentage = ( currentDone, currentTotal ) => {
		// If totals are not available yet but we're in an initial processing state,
		// show a small fill to indicate activity immediately.
		if ( ( ! currentTotal || currentTotal === 0 ) && showInitialProgress ) {
			return 16;
		}

		if ( ! currentDone || ! currentTotal || currentTotal === 0 ) {
			return 0;
		}
		let percentage = ( currentDone / currentTotal ) * 100;

		if ( showInitialProgress && percentage < 16 ) {
			percentage = 16; // Ensure at least 16% is shown initially.
		}

		return Math.min( Math.max( percentage, 0 ), 100 );
	};

	return (
		<div>
			<div className="flex justify-end">
				{ Math.round( calculateSafePercentage( done, total ) ) }%
			</div>
			<div className="godam-progress-bar">
				<div
					className="godam-progress-bar--fill"
					style={ {
						width: `${ calculateSafePercentage( done, total ) }%`,
					} }
				/>
			</div>
		</div>
	);
};

export default ProgressBar;
