/**
 * External dependencies
 */
import React, { useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon, search } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import MediaGrid from './components/media-grid/MediaGrid.jsx';

const AttachmentPicker = ( { handleAttachmentClick } ) => {
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ attachments, setAttachments ] = useState( [] );

	return (
		<div className="h-full overflow-auto godam-video-list-wrapper px-10 bg-white">

			<div className="godam-video-list-header py-10">
				<h1 className="godam-video-list__title">
					{ __( 'Videos', 'godam' ) }
				</h1>

				<div className="godam-video-list__filters">
					<div className="godam-video-list__filters__search">
						<Icon icon={ search } />

						<input
							type="text"
							placeholder={ __( 'Search videos', 'godam' ) }
							onChange={ ( e ) => {
								setSearchTerm( e.target.value );
								setPage( 1 );
								setAttachments( [] );
							} }
						/>
					</div>
				</div>
			</div>

			<MediaGrid search={ searchTerm } page={ page } handleAttachmentClick={ handleAttachmentClick } setPage={ setPage } setAttachments={ setAttachments } attachments={ attachments } />
		</div>
	);
};

export default AttachmentPicker;
