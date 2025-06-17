/**
 * External dependencies
 */
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { plus } from '@wordpress/icons';
import { useState } from '@wordpress/element';
/**
 * Internal dependencies
 */
import AddChapter from './AddChapter';
import { addChapter } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';

const Chapters = ( { currentTime, duration, formatTimeForInput } ) => {
	const loading = useSelector( ( state ) => state.videoReducer.loading );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const dispatch = useDispatch();
	const [ isError, setIsError ] = useState( {} );

	// Sort the array (ascending order)
	const sortedChapters = [ ...chapters ].sort(
		( a, b ) => a.startTime - b.startTime,
	);

	useEffect( () => {
		const errors = {};

		for ( let i = 1; i < sortedChapters.length; i++ ) {
			const chapter = sortedChapters[ i ];
			if ( chapter.originalTime !== '' && parseFloat( chapter.startTime ) === parseFloat( sortedChapters[ i - 1 ].startTime ) ) {
				errors[ chapter.id ] = 'similar time';
			}
		}

		sortedChapters.forEach( ( chapter ) => {
			if ( chapter.startTime > duration ) {
				errors[ chapter.id ] = 'greater than duration';
			} else if ( chapter.startTime < 0 ) {
				errors[ chapter.id ] = 'less than 0';
			} else if ( chapter.originalTime === '' ) {
				errors[ chapter.id ] = 'empty time';
			}
		} );

		setIsError( errors );
	}, [ chapters, duration ] );

	return (
		<>
			{
				sortedChapters?.map( ( chapter ) => {
					return (
						<AddChapter chapterID={ chapter.id } key={ chapter?.id } isError={ isError } />
					);
				} )
			}
			{ ! loading && chapters.length === 0 && (
				<>
					<h3 className="text-2xl m-0 text-center">
						{ __( 'No chapters added', 'godam' ) }
					</h3>
				</>
			) }
			{ loading && (
				<div className="loading-skeleton">
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header"></div>
					</div>
				</div>
			) }
			{ ! loading && (
				<div className="mt-10 flex justify-center flex-col items-center">
					<Button
						className="godam-button w-fit"
						variant="primary"
						id="add-layer-btn"
						icon={ plus }
						iconPosition="left"
						onClick={ () => {
							const newID = uuidv4();
							dispatch(
								addChapter( {
									id: newID,
									text: '',
									originalTime: formatTimeForInput( currentTime ) || '0.0',
									startTime: currentTime || '0',
								} ),
							);
						} }
						disabled={
							chapters.find( ( l ) => l.startTime === currentTime || ( ! currentTime && parseFloat( l.startTime ) === 0 ) )
						}
					>
						{ __( 'Add chapter at ', 'godam' ) } { formatTimeForInput( currentTime ) || '00:00' }s
					</Button>
					{ chapters.find( ( l ) => l.startTime === currentTime || ( ! currentTime && parseFloat( l.startTime ) === 0 ) ) && (
						<p className="text-slate-500 text-center">
							{ __(
								'There is already a layer at this timestamp. Please choose a different timestamp.',
								'godam',
							) }
						</p>
					) }
					<div>
						<p>{ __( 'Chapter timestamp formatting adapts to the video length:', 'godam' ) }</p>
						<ul>
							<li>{ __( 'For videos under a minute, timestamps use seconds.milliseconds.', 'godam' ) }</li>
							<li>{ __( 'For videos between one minute and one hour, the format becomes minutes:seconds.milliseconds.', 'godam' ) }</li>
							<li>{ __( 'For videos over an hour, timestamps are shown as hours:minutes:seconds.milliseconds.', 'godam' ) }</li>
						</ul>
					</div>

				</div>
			) }
		</>
	);
};

export default Chapters;
