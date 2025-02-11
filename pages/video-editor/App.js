/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * Internal dependencies
 */
import VideoEditor from './VideoEditor';
import './style.scss';
import '../../assets/build/blocks/godam-player/style-index.css';

/**
 * WordPress dependencies
 */
import AttachmentGrid from './AttachmentGrid.jsx';

const App = () => {
	const [ attachmentID, setAttachmentID ] = useState( null );

	useEffect( () => {
		// Check if the attachment ID is present in the URL
		const urlParams = new URLSearchParams( window.location.search );
		const id = urlParams.get( 'id' );

		// Check if valid attachment ID is present
		if ( id && ! isNaN( id ) ) {
			setAttachmentID( id );
		}
	}, [] );

	const handleAttachmentClick = ( id ) => {
		setAttachmentID( id );
	};

	if ( ! attachmentID ) {
		return (
			<AttachmentGrid handleAttachmentClick={ handleAttachmentClick } />
		);
	}

	return (
		<>
			<VideoEditor attachmentID={ attachmentID } />
		</>
	);
};

export default App;
