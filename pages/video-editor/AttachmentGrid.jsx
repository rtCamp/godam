/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * Internal dependencies
 */
import { useGetVideosMutation } from './redux/api/video';

const AttachmentGrid = ( { handleAttachmentClick } ) => {
	const [ getVideos, { isLoading } ] = useGetVideosMutation();
	const [ attachments, setAttachments ] = useState( [] );
	const [ search, setSearch ] = useState( '' );

	// Fetch videos on search change
	useEffect( () => {
		const videoTimeout = setTimeout( () => {
			getVideos( { search } ).then( ( response ) => {
				setAttachments( response?.data?.data || [] );
			} );
		}, 500 );

		return () => clearTimeout( videoTimeout );
	}, [ search, getVideos ] );

	return (
		<>
			<div className="flex gap-8 items-center px-4">
				<h1>Video Editor</h1>

				<input
					type="text"
					placeholder="Search for media"
					className="p-2 border border-gray-300 w-60 dark:border-gray-700 rounded-lg focus:outline-none focus:ring focus:ring-blue-500"
					onChange={ ( e ) => setSearch( e.target.value ) }
					value={ search }
				/>
			</div>

			<div className="p-4 bg-gray-100 dark:bg-gray-800">
				{ isLoading && (
					<p className="text-center text-gray-500 dark:text-gray-400">Loading videos...</p>
				) }

				{ ! isLoading && attachments.length === 0 && (
					<p className="text-center text-gray-500 dark:text-gray-400">No videos found.</p>
				) }

				{ ! isLoading && attachments.length > 0 && (
					<div className="flex flex-wrap gap-4">
						{ attachments.map( ( attachment ) => (
							<div
								key={ attachment.id }
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
						) ) }
					</div>
				) }
			</div>
		</>
	);
};

export default AttachmentGrid;
