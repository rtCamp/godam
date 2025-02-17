/**
 * External dependencies
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useGetVideosMutation } from '../../redux/api/video';
import MediaItem from './MediaItem.jsx';

const MediaGrid = ( { search, page, handleAttachmentClick, setPage, attachments, setAttachments } ) => {
	const [ getVideos, { isLoading } ] = useGetVideosMutation();
	const [ hasMore, setHasMore ] = useState( true );
	const [ fetching, setFetching ] = useState( false );
	const observer = useRef();

	const lastItemRef = useCallback(
		( node ) => {
			if ( fetching ) {
				return;
			}

			if ( observer.current ) {
				observer.current.disconnect();
			}

			observer.current = new IntersectionObserver( ( entries ) => {
				if ( entries[ 0 ].isIntersecting && hasMore ) {
					setPage( ( prev ) => prev + 1 );
				}
			} );

			if ( node ) {
				observer.current.observe( node );
			}
		}, [ hasMore, fetching, setPage ],
	);

	/**
	 * Search item for the videos.
	 */
	useEffect( () => {
		setFetching( true );

		const fetch = async () => {
			const response = await getVideos( { search, page } );

			const data = response?.data?.data || [];

			const totalPages = Number( response?.data?.totalNumPage );

			if ( totalPages && page >= totalPages ) {
				setHasMore( false );
			}

			if ( data.length === 0 ) {
				setHasMore( false );
			}

			setAttachments( ( prev ) => [ ...prev, ...data ] );
			setFetching( false );
		};

		const debounce = setTimeout( fetch, 500 );
		return () => clearTimeout( debounce );
	}, [ getVideos, setAttachments, search, page ] );

	if ( ! fetching && attachments.length === 0 ) {
		return <p className="text-2xl">{ __( 'No videos found.', 'godam' ) }</p>;
	}

	return (
		<>
			<div className="godam-video-list-videos py-2">
				{ attachments.map( ( item, index ) => (
					<MediaItem
						key={ item.id }
						item={ item }
						handleAttachmentClick={ handleAttachmentClick }
						ref={ index === attachments.length - 1 ? lastItemRef : null }
					/>
				) ) }
			</div>

			{ ( isLoading || fetching ) && <p>{ __( 'Loading…', 'godam' ) }</p> }
		</>
	);
};

export default MediaGrid;
