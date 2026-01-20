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
import { Icon, media } from '@wordpress/icons';

const MediaGrid = ( { search, page, handleAttachmentClick, setPage, attachments, setAttachments } ) => {
	const [ getVideos, { isLoading } ] = useGetVideosMutation();
	const [ hasMore, setHasMore ] = useState( true );
	const [ fetching, setFetching ] = useState( false );
	const observer = useRef();
	const requestIdRef = useRef( 0 );

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
		const currentRequestId = ++requestIdRef.current;

		setFetching( true );

		const fetch = async () => {
			const response = await getVideos( { search, page } );

			// Ignore stale responses.
			if ( requestIdRef.current !== currentRequestId ) {
				return;
			}

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

	useEffect( () => {
		const body = document.querySelector( 'body' );

		// Return early if admin sidebar is already open.
		if ( ! body || ! body.classList.contains( 'folded' ) ) {
			return;
		}

		// Open the admin sidebar.
		body.classList.remove( 'folded' );
	}, [] );

	if ( ! fetching && attachments.length === 0 ) {
		return (
			<div className="flex justify-end items-center flex-col mt-8">
				<Icon
					style={ {
						fill: '#9ca3af',
					} }
					icon={ media }
					size={ 140 }
				/>
				<h2 className="text-gray-400">
					{ __( 'No video found', 'godam' ) }
				</h2>
				<p className="text-sm text-gray-500 m-0 text-center">
					{ __( 'Upload videos from WordPress ', 'godam' ) }
					<a
						href={ `${ window?.videoData?.adminUrl }upload.php` }
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 underline"
					>
						{ __( 'media library', 'godam' ) }
					</a>
					{ __( ' to use them in Godam.', 'godam' ) }
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="godam-video-list-videos">
				{ attachments.map( ( item, index ) => (
					<MediaItem
						key={ item.id }
						item={ item }
						handleAttachmentClick={ handleAttachmentClick }
						ref={ index === attachments.length - 1 ? lastItemRef : null }
					/>
				) ) }
			</div>

			{ ( isLoading || fetching ) &&
				<div className="flex justify-end items-center flex-col">
					<p>{ __( 'Loading…', 'godam' ) }</p>
				</div>
			}
		</>
	);
};

export default MediaGrid;
