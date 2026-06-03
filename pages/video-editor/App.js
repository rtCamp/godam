/**
 * External dependencies
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

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
import { gravityFormsAPI } from './redux/api/gravity-forms';
import { contactForm7Api } from './redux/api/cf7-forms';
import { wpFormsApi } from './redux/api/wpforms';
import { jetpackFormsApi } from './redux/api/jetpack-forms';
import { sureformsApi } from './redux/api/sureforms';
import { forminatorFormsApi } from './redux/api/forminator-forms';
import { fluentFormsApi } from './redux/api/fluent-forms';
import { everestFormsApi } from './redux/api/everest-forms';
import { ninjaFormsApi } from './redux/api/ninja-forms';
import { metformApi } from './redux/api/metform';

const App = () => {
	const dispatch = useDispatch();
	const [ attachmentID, setAttachmentID ] = useState( null );
	const [ rawID, setRawID ] = useState( null );

	// Track the current attachment id in a ref so the popstate handler can
	// compare against it without re-subscribing the listener on every change.
	const attachmentIDRef = useRef( attachmentID );
	useEffect( () => {
		attachmentIDRef.current = attachmentID;
	}, [ attachmentID ] );

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
		// Array of all API slices that need to be reset
		const apiSlices = [
			videosAPI,
			pollsAPI,
			attachmentAPI,
			gravityFormsAPI,
			contactForm7Api,
			wpFormsApi,
			jetpackFormsApi,
			sureformsApi,
			forminatorFormsApi,
			fluentFormsApi,
			everestFormsApi,
			ninjaFormsApi,
			metformApi,
		];

		dispatch( resetVideoState() );
		apiSlices.forEach( ( api ) => {
			dispatch( api.util.resetApiState() );
		} );
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
			const newParams = new URLSearchParams( window.location.search );
			const newId = newParams.get( 'id' );
			const normalizedId = newId && ! isNaN( newId ) ? newId : null;

			// A popstate that does NOT change the current attachment must be a
			// no-op. resetStore() clears the RTK Query cache; when the id is
			// unchanged, <VideoEditor key={ attachmentID } /> does not remount
			// and the already-mounted useGetAttachmentMetaQuery hook does not
			// refetch, which would leave the editor permanently stuck on its
			// loading skeleton. Only reset + reinitialise when the attachment
			// actually changes (back to the picker, or to a different video).
			if ( String( normalizedId ) === String( attachmentIDRef.current ) ) {
				return;
			}

			resetStore();
			setRawID( normalizedId );
			setAttachmentID( normalizedId );
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
