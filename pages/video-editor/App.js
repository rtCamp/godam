/**
 * External dependencies
 */
import React, { useCallback, useEffect, useState } from 'react';

/**
 * Internal dependencies
 */
import VideoEditor from './VideoEditor';
import './style.scss';
import '../../assets/src/css/godam-player.scss';

/**
 * WordPress dependencies
 */
import { useDispatch } from 'react-redux';
import AttachmentPicker from './AttachmentPicker.jsx';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import { useGetResolvedAttachmentQuery, attachmentAPI } from './redux/api/attachment.js';
import { resetVideoState } from './redux/slice/videoSlice';
import { videosAPI } from './redux/api/video';
import { pollsAPI } from './redux/api/polls';

const App = () => {
	const dispatch = useDispatch();
	const [ attachmentID, setAttachmentID ] = useState( null );
	const [ rawID, setRawID ] = useState( null );
	const {
		data: resolvedAttachment,
		isSuccess,
	} = useGetResolvedAttachmentQuery( rawID, {
		skip: ! rawID || ! isNaN( rawID ), // skip if it's already a number
	} );

	useEffect( () => {
		if ( isSuccess && resolvedAttachment?.id ) {
			setAttachmentID( resolvedAttachment.id );
		}
	}, [ isSuccess, resolvedAttachment ] );

	/**
	 * Reset all Redux store state to prevent stale data from a previous video.
	 */
	const resetStore = useCallback( () => {
		dispatch( resetVideoState() );
		dispatch( videosAPI.util.resetApiState() );
		dispatch( pollsAPI.util.resetApiState() );
		dispatch( attachmentAPI.util.resetApiState() );
	}, [ dispatch ] );

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
		if ( id ) {
			setRawID( id );

			// If ID is already a number, use it directly
			if ( ! isNaN( id ) ) {
				setAttachmentID( id );
			}
		}

		// Handle back/forward navigation
		const handlePopState = () => {
			resetStore();

			const newParams = new URLSearchParams( window.location.search );
			const newId = newParams.get( 'id' );

			if ( newId && ! isNaN( newId ) ) {
				setRawID( newId );
				setAttachmentID( newId );
			} else {
				setRawID( null );
				setAttachmentID( null );
			}
		};

		window.addEventListener( 'popstate', handlePopState );
		return () => window.removeEventListener( 'popstate', handlePopState );
	}, [ resetStore ] );

	const handleAttachmentClick = ( id ) => {
		resetStore();
		setAttachmentID( id );
		setRawID( id );
		const newUrl = new URL( window.location );
		newUrl.searchParams.set( 'id', id );
		window.history.pushState( {}, '', newUrl );
	};

	const handleBackToAttachmentPicker = () => {
		resetStore();
		setAttachmentID( null );
		setRawID( null );
		const newUrl = new URL( window.location );
		newUrl.searchParams.delete( 'id' );
		window.history.replaceState( {}, '', newUrl );
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
		<VideoEditor key={ attachmentID } attachmentID={ attachmentID } onBackToAttachmentPicker={ handleBackToAttachmentPicker } />
	);
};

export default App;
