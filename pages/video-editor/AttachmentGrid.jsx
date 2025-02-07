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
import { useGetVideosMutation } from './redux/api/video';

const AttachmentGrid = ( { handleAttachmentClick } ) => {
	const [ getVideos, { isLoading } ] = useGetVideosMutation();
	const [ attachments, setAttachments ] = useState( [] );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ hasMore, setHasMore ] = useState( true );
	const observer = useRef();

	/**
	 * fetch the videos when the component mounts and when values are changed.
	 */
	useEffect( () => {
		if ( attachments.length > 0 && attachments.length !== 40 ) {
			return;
		}

		const videoTimeout = setTimeout( () => {
			getVideos( { search, page } ).then( ( response ) => {
				const newVideos = response?.data?.data || [];
				setAttachments( ( prev ) => ( page === 1 ? newVideos : [ ...prev, ...newVideos ] ) );
				setHasMore( newVideos.length > 0 );
			} );
		}, 500 );

		return () => clearTimeout( videoTimeout );
	}, [ search, page, getVideos, attachments ] );

	/**
	 * Intersection observer to load more videos when user scrolls to the bottom
	 */
	const lastVideoRef = useCallback(
		( node ) => {
			if ( isLoading || ! hasMore ) {
				return;
			}

			if ( observer.current ) {
				observer.current.disconnect();
			}

			observer.current = new IntersectionObserver( ( entries ) => {
				if ( entries[ 0 ].isIntersecting ) {
					setPage( ( prevPage ) => prevPage + 1 );
				}
			} );

			if ( node ) {
				observer.current.observe( node );
			}
		},
		[ isLoading, hasMore ],
	);

	return (
		<>
			<header>
				<div className="bg-white border-b -ml-[32px] pl-[32px] flex gap-4">
					<div className="pl-4 pr-9 flex items-center justify-between">
						<h1 className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-center">
							{ __( 'Video Editor', 'godam' ) }
						</h1>
					</div>

					<div className="flex items-center">
						<input
							type="text"
							placeholder="Search for media"
							className="bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md h-10 min-w-64 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
							onChange={ ( e ) => {
								setSearch( e.target.value );
								setPage( 1 );
								setAttachments( [] );
							} }
							value={ search }
						/>
					</div>
				</div>
			</header>

			<div className="p-4 bg-gray-100 dark:bg-gray-800">
				{ isLoading && attachments.length === 0 && page === 1 && (
					<p className="text-center text-gray-500 text-2xl dark:text-gray-400">Loading videos...</p>
				) }

				{ ! isLoading && attachments.length === 0 && (
					<p className="text-center text-gray-500 text-2xl dark:text-gray-400">No videos found.</p>
				) }

				{ attachments.length > 0 && (
					<div className="flex flex-wrap gap-4">
						{ attachments.map( ( attachment, index ) => {
							const isLastItem = index === attachments.length - 1;
							return (
								<div
									key={ attachment.id }
									ref={ isLastItem ? lastVideoRef : null }
									role="button"
									tabIndex="0"
									aria-label={ `Open ${ attachment.title }` }
									className="relative p-4 w-40 h-40 md:w-32 md:h-32 flex justify-center align-center bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-300 dark:border-gray-700 overflow-hidden group cursor-pointer"
									onClick={ () => handleAttachmentClick( attachment.id ) }
									onKeyDown={ ( e ) => {
										if ( e.key === 'Enter' || e.key === ' ' ) {
											handleAttachmentClick( attachment.id );
										}
									} }
								>
									<img
										src={ attachment.image.src }
										alt={ attachment.title }
										className="object-cover transition-transform duration-300 group-hover:scale-105"
									/>
									<div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-center">
										<p className="text-xs m-0 font-semibold break-words">{ attachment.title }</p>
									</div>
								</div>
							);
						} ) }
					</div>
				) }

				{ isLoading && page > 1 && (
					<p className="text-center text-gray-500 dark:text-gray-400 mt-4">Loading more videos...</p>
				) }
			</div>
		</>
	);
};

export default AttachmentGrid;
