/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';

const NoticeContainer = ( { notice, onRemove } ) => {
	if ( ! notice.isVisible ) {
		return null;
	}

	return (
		<div className="status-notices-container">
			<Notice
				status={ notice.status }
				className="my-2"
				isDismissible
				onRemove={ onRemove }
			>
				{ notice.message }
			</Notice>
		</div>
	);
};

export default NoticeContainer;
