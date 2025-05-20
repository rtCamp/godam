/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * Internal dependencies
 */
import VideoEditor from './VideoEditor';
import './style.scss';
import '../../assets/build/css/godam-player.css';

/**
 * WordPress dependencies
 */
import AttachmentPicker from './AttachmentPicker.jsx';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';

const App = () => {
	const [ attachmentID, setAttachmentID ] = useState( null );

	/**
	 * Handle the back/forward navigation
	 *
	 * When navigating back from the video editor to the attachment picker, the attachment ID is removed from the URL.
	 */
	useEffect( () => {
		// Check if the attachment ID is present in the URL
		const urlParams = new URLSearchParams( window.location.search );
		const id = urlParams.get( 'id' );

		// Check if valid attachment ID is present
		if ( id && ! isNaN( id ) ) {
			setAttachmentID( id );
		}

		// Handle back/forward navigation
		const handlePopState = () => {
			const newParams = new URLSearchParams( window.location.search );
			const newId = newParams.get( 'id' );
			setAttachmentID( newId && ! isNaN( newId ) ? newId : null );
		};

		window.addEventListener( 'popstate', handlePopState );
		return () => window.removeEventListener( 'popstate', handlePopState );
	}, [] );

	const handleAttachmentClick = ( id ) => {
		setAttachmentID( id );
		const newUrl = new URL( window.location );
		newUrl.searchParams.set( 'id', id );
		window.history.pushState( {}, '', newUrl );
	};

	if ( ! attachmentID ) {
		return (
			<>
				<GodamHeader />
				<AttachmentPicker handleAttachmentClick={ handleAttachmentClick } />
			</>
		);
	}

	return (
		<VideoEditor attachmentID={ attachmentID } />
	);
};

export default App;
