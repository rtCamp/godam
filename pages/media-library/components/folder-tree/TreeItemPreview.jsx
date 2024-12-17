/**
 * External dependencies
 */
import { useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { Icon, file } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { utilities } from '../../data/utilities';

const TreeItemPreview = ( { item, index } ) => {
	const itemCount = useMemo( () => utilities.countChildren( item ), [ item ] );

	return (
		<>
			<div
				className="w-fit py-2 px-2 bg-gray-200 relative"
			>
				<button
					className="text-left flex items-center justify-between pr-6"
					data-index={ index }
				>
					<div className="flex items-center gap-2">
						<Icon icon={ file } />
						<span className="text-sm text-gray-700">{ item.name }</span>
					</div>
				</button>

				<div className="absolute top-0 right-0 bg-gray-500 text-white text-xs px-2 py-1 rounded-bl">
					{ itemCount }
				</div>
			</div>
		</>
	);
};

export default TreeItemPreview;
