/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	SelectControl,
	Panel,
	PanelBody,
	TextControl,
	Tooltip,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { closeSmall, cautionFilled } from '@wordpress/icons';
/**
 * Internal dependencies
 */
import { updateChapterField, addChapter, removeChapter } from '../../redux/slice/videoSlice';

const AddChapter = ( { chapterID, duration, isError, formatTimeForInput } ) => {
	const chapter = useSelector( ( state ) =>
		state.videoReducer.chapters.find( ( _chapter ) => _chapter.id === chapterID ),
	);
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );

	const dispatch = useDispatch();
	// const [ isError, setIsError ] = React.useState( false );

	const handleChange = ( value, field ) => {
		// dispatch(
		// 	updateChapterField( {
		// 		id: chapterID,
		// 		field: 'text',
		// 		value,
		// 	} ),
		// );
		// console.log( chapterID, 'chapterID' );
		if ( chapterID ) {
			// if ( 'originalTime' === field ) {
			// 	const isSimilar = chapters.find( ( _chapter ) => _chapter.id !== chapterID && _chapter.originalTime === value );
			// 	console.log( isSimilar );
			// 	if ( value > duration ) {
			// 		setIsError( 'greater than duration' );
			// 	} else if ( value < 0 ) {
			// 		setIsError( 'less than 0' );
			// 	} else if ( isSimilar ) {
			// 		setIsError( 'similar time' );
			// 	} else {
			// 		setIsError( false );
			// 	}
			// }
			dispatch(
				updateChapterField( {
					id: chapterID,
					field,
					value,
				} ),
			);
		}
	};

	// console.log(isError, 'isError');

	const generateTooltipText = () => {
		switch ( isError[ chapterID ] ) {
			case 'greater than duration':
				return __( 'Time is greater than video duration', 'godam' );
			case 'less than 0':
				return __( 'Time cannot be less than 0', 'godam' );
			case 'similar time':
				return __( 'Time is similar to another chapter', 'godam' );
			case 'empty time':
				return __( 'Time cannot be empty', 'godam' );
			default:
				return __( 'Error in chapter time', 'godam' );
		}
	};

	const parseTimeToSeconds = ( input ) => {
		if ( ! input ) {
			return 0;
		}

		// If it's already a number (plain seconds), return it
		if ( /^\d+(\.\d+)?$/.test( input ) ) {
			return parseFloat( input );
		}

		// Match time string like hh:mm:ss.ms or mm:ss
		const parts = input.split( ':' ).map( Number );
		if ( parts.some( isNaN ) ) {
			return 0;
		}

		let seconds = 0;

		if ( parts.length === 3 ) {
			// hh:mm:ss
			seconds += parts[ 0 ] * 3600;
			seconds += parts[ 1 ] * 60;
			seconds += parts[ 2 ];
		} else if ( parts.length === 2 ) {
			// mm:ss
			seconds += parts[ 0 ] * 60;
			seconds += parts[ 1 ];
		} else if ( parts.length === 1 ) {
			// ss
			seconds += parts[ 0 ];
		}

		return parseFloat( seconds.toFixed( 2 ) );
	};

	return chapterID && (
		<div className="flex">
			<div className="flex items-center justify-between pt-4 gap-3">
				{ isError[ chapterID ]
					? <Tooltip text={ generateTooltipText() } className="chapter-error-tooltip">
						<Button icon={ cautionFilled } height={ 20 } width={ 20 } className="p-0" />
					</Tooltip>
					: <div className="w-[56px] pr-4"></div>
				}
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					value={ chapter?.originalTime }

					onChange={ ( value ) => {
						handleChange( value, 'originalTime' );
						const parsedValue = parseTimeToSeconds( value );
						handleChange( parsedValue.toString(), 'startTime' );
					} }
					type="text"
					className={ isError[ chapterID ] ? 'godam-error' : '' }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					value={ chapter?.text || '' }
					onChange={ ( value ) => handleChange( value, 'text' ) }
				/>
				<Button icon={ closeSmall } isDestructive onClick={ () => {
					dispatch( removeChapter( { id: chapterID } ) );
				} } />
			</div>
		</div>
	);
};

export default AddChapter;
