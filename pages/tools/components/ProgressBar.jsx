// Alternative inline version (similar to your original)
const ProgressBar = ( { showInitialProgress, done, total } ) => {
	const calculateSafePercentage = ( done, total ) => {
		if ( ! done || ! total || total === 0 ) {
			return 0;
		}
		let percentage = ( done / total ) * 100;

		if ( showInitialProgress && percentage < 16 ) {
			percentage = 16; // Ensure at least 16% is shown initially.
		}

		return Math.min( Math.max( percentage, 0 ), 100 );
	};

	console.log( 'showInitialProgress', showInitialProgress, 'done', done, 'total', total );

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