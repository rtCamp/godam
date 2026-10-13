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
import { useDispatch, useSelector } from 'react-redux';
import { __ } from '@wordpress/i18n';
import VideoEditorDataView from './components/video-dataview/VideoEditorDataView.jsx';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import ProductGuide from './onboarding/ProductGuide.jsx';
import { isActive as isGuideActive, dismiss as dismissGuide } from './onboarding/productGuide';
import { useGetResolvedAttachmentQuery, attachmentAPI } from './redux/api/attachment.js';
import { resetVideoState } from './redux/slice/videoSlice';
import { videosAPI } from './redux/api/video';
import { videoEditorAPI } from './redux/api/video-editor';
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

	// Track the latest dirty state + current video so the (once-registered)
	// popstate listener can read them without a stale closure.
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );
	const isChangedRef = useRef( isChanged );
	const attachmentIDRef = useRef( attachmentID );

	useEffect( () => {
		isChangedRef.current = isChanged;
	}, [ isChanged ] );

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
			videoEditorAPI,
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
			// SPA history navigation (browser back/forward) does not fire the
			// beforeunload guard, so confirm here before discarding unsaved layer
			// changes. On cancel, re-push the current video URL to stay put.
			if ( attachmentIDRef.current && isChangedRef.current ) {
				// eslint-disable-next-line no-alert
				const leave = window.confirm( __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' ) );

				if ( ! leave ) {
					const restoredUrl = new URL( window.location );
					restoredUrl.searchParams.set( 'id', attachmentIDRef.current );
					window.history.pushState( {}, '', restoredUrl );
					return;
				}
			}

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

	const handleAttachmentClick = useCallback( ( id ) => {
		resetStore();
		setAttachmentID( id );
		setRawID( id );
		const newUrl = new URL( window.location );
		newUrl.searchParams.set( 'id', id );
		window.history.pushState( {}, '', newUrl );
	}, [ resetStore ] );

	// Memoized so its reference is stable across App re-renders. App re-renders
	// whenever `isChanged` toggles (see the useSelector above), and this callback
	// is forwarded to <VideoEditor> where it sits in the dependency array of the
	// effect that calls `initializeStore`. An unstable reference made that effect
	// re-run on every edit, re-initializing the store from the saved meta and
	// silently reverting the user's add/update/delete of layers.
	const handleBackToAttachmentPicker = useCallback( () => {
		// Leaving the editor mid-tour would strip the editor-specific coachmark
		// targets, so end the guide cleanly.
		if ( isGuideActive() ) {
			dismissGuide();
		}
		resetStore();
		setAttachmentID( null );
		setRawID( null );
		const newUrl = new URL( window.location );
		newUrl.searchParams.delete( 'id' );
		window.history.replaceState( {}, '', newUrl );
	}, [ resetStore ] );

	return (
		<>
			{ ! attachmentID ? (
				<>
					<GodamHeader />
					<VideoEditorDataView onEdit={ handleAttachmentClick } />
				</>
			) : (
				<VideoEditor key={ attachmentID } attachmentID={ attachmentID } onBackToAttachmentPicker={ handleBackToAttachmentPicker } />
			) }
			{ /* Mounted once, above the list/editor switch, so navigating between
			     views doesn't remount it and re-trigger the welcome modal. */ }
			<ProductGuide attachmentID={ attachmentID } />
		</>
	);
};

export default App;
