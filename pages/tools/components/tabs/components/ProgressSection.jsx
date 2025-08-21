/**
 * Internal dependencies
 */
import ProgressBar from '../../ProgressBar.jsx';

const ProgressSection = ( { retranscoding, aborted, done, mediaCount, attachments, logs } ) => {
	if ( ! ( retranscoding || aborted || done ) ) {
		return null;
	}

	return (
		<div className="mb-4">
			<ProgressBar total={ attachments?.length } done={ mediaCount } />
			<pre className="w-full h-[120px] max-h-[120px] overflow-y-auto bg-gray-100 p-3 rounded">
				{ logs.map( ( log, index ) => (
					<div key={ index } className="text-sm text-gray-700">
						• { log }
					</div>
				) ) }
			</pre>
		</div>
	);
};

export default ProgressSection;
