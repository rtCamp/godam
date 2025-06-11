/**
 * External dependencies
 */
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Notice } from '@wordpress/components';
import { plus, preformatted, customLink, arrowRight, video, customPostType, thumbsUp } from '@wordpress/icons';
import { useState } from '@wordpress/element';
/**
 * Internal dependencies
 */
import AddChapter from './AddChapter';
import { setCurrentChapter, addChapter } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';

const Chapters = ( { currentTime, onSelectLayer, duration, formatTimeForInput } ) => {
	const loading = useSelector( ( state ) => state.videoReducer.loading );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const [ currentChapterID, setCurrentChapterID ] = useState( null );
	const [ isLayerListScreen, setIsLayerListScreen ] = useState( true );
	const dispatch = useDispatch();
	const [ isError, setIsError ] = useState( {} );

	// Sort the array (ascending order)
	const sortedChapters = [ ...chapters ].sort(
		( a, b ) => a.startTime - b.startTime,
	);
	// const isLayerListScreen = se
	// console.log( chapters, 'chapters' );
	// console.log( 'sortedChapters', sortedChapters );
	// console.log( chapter, 'state' );

	useEffect( () => {
		const errors = {};

		console.log( 'chapter use effect executed', chapters );

		for ( let i = 0; i < chapters.length; i++ ) {
			const chapter = chapters[ i ];
			if ( i !== 0 && chapter.originalTime !== '' && parseFloat( chapter.startTime ) === parseFloat( chapters[ i - 1 ].startTime ) ) {
				errors[ chapter.id ] = 'similar time';
			}
		}

		chapters.forEach( ( chapter ) => {
			console.log( chapter.originalTime, 'originalTime' );
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
						// <Tooltip
						// 	key={ chapter.id }
						// 	className="w-full flex justify-between items-center px-2 py-3 border rounded-md mb-2 hover:bg-gray-50 cursor-pointer"
						// 	text={ toolTipMessage }
						// 	placement="right"
						// >
						// <div className="border rounded-lg mb-2" key={ chapter.id }>
						// 	<Button
						// 		className={ `w-full flex justify-between items-center px-2 py-3 border-1 rounded-lg h-auto hover:bg-gray-50 cursor-pointer border-[#e5e7eb]` }
						// 		onClick={ () => {
						// 			dispatch( setCurrentChapter( chapter ) );
						// 			onSelectLayer( chapter.originalTime );
						// 			setCurrentChapterID( chapter?.id );
						// 			setIsLayerListScreen( false );
						// 		} }
						// 	>
						// 		<div className="flex items-center gap-2">
						// 			{ /* { icon && <img src={ icon } alt={ layer.type } className="w-6 h-6" /> }
						// 				{ ! icon && <Icon icon={ layerTypes.find( ( l ) => l.type === layer.type )?.icon } /> } */ }
						// 			<p className="m-0 text-base">Chapter at <b>{ chapter.originalTime }s</b></p>
						// 		</div>
						// 		<div>
						// 			<Icon icon={ arrowRight } />
						// 		</div>
						// 	</Button>
					// </div>
						<AddChapter chapterID={ chapter.id } key={ chapter?.id } duration={ duration } isError={ isError } formatTimeForInput={ formatTimeForInput } />
						// </Tooltip>
					);
				} )
			}
			{ ! loading && chapters.length === 0 && (
				<>
					<h3 className="text-2xl m-0 text-center">
						{ __( 'No chapters added', 'godam' ) }
					</h3>
					{ /* <p className="text-center mb-10 text-gray-400">{ __( 'Play video to add chapter.', 'godam' ) }</p> */ }
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
							setCurrentChapterID( newID );
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
