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
import './css/tree-item-preview.scss';

const TreeItemPreview = ( { item, index } ) => {
	const itemCount = useMemo( () => utilities.countChildren( item ), [ item ] );

	return (
		<>
			<div
				className="tree-item-preview"
			>
				<button
					className="tree-item-preview__button"
					data-index={ index }
				>
					<div className="tree-item-preview__content">
						<Icon icon={ file } />
						<span className="tree-item-preview__text">{ item.name }</span>
					</div>
				</button>

				<div className="tree-item-preview__badge">
					{ itemCount }
				</div>
			</div>
		</>
	);
};

export default TreeItemPreview;
