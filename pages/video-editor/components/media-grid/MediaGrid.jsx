/**
 * External dependencies
 */
import React, { useEffect, useRef, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useGetVideosMutation } from '../../redux/api/video';
import MediaItem from './MediaItem.jsx';

const MediaGrid = ( { search, page, handleAttachmentClick } ) => {
	const [ getVideos, { isLoading, isUninitialized } ] = useGetVideosMutation();
	const [ attachments, setAttachments ] = useState( [] );

	const isFirstRender = useRef( true );

	/**
	 * Make another request for the videos when the search term or page changes.
	 */
	useEffect( () => {
		if ( isFirstRender.current ) {
			return;
		}

		const debounce = setTimeout( () => {
			getVideos( { search, page } ).then( ( response ) => {
				setAttachments( response?.data?.data || [] );
			} );
		}, 500 );

		return () => clearTimeout( debounce );
	}, [ getVideos, search, page ] );

	/**
	 * Fetch the videos from the API using POST request.
	 */
	useEffect( () => {
		getVideos().then( ( response ) => {
			setAttachments( response?.data?.data || [] );
		} );

		isFirstRender.current = false;
	}, [ getVideos ] );

	if ( isLoading || isUninitialized ) {
		return <p>{ __( 'Loading…', 'godam' ) }</p>;
	}

	if ( ! isLoading && attachments.length === 0 ) {
		return <p className="text-2xl">{ __( 'No videos found.', 'godam' ) }</p>;
	}

	return (
		<div className="godam-video-list-videos">
			{ attachments.map( ( item ) => ( <MediaItem key={ item.id } item={ item } handleAttachmentClick={ handleAttachmentClick } /> ) ) }
		</div>
	);
};

export default MediaGrid;
