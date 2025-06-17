/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	TextControl,
	Tooltip,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { closeSmall, cautionFilled } from '@wordpress/icons';
/**
 * Internal dependencies
 */
import { updateChapterField, removeChapter } from '../../redux/slice/videoSlice';

const AddChapter = ( { chapterID, isError } ) => {
	const chapter = useSelector( ( state ) =>
		state.videoReducer.chapters.find( ( _chapter ) => _chapter.id === chapterID ),
	);

	const dispatch = useDispatch();

	const handleChange = ( value, field ) => {
		if ( chapterID ) {
			dispatch(
				updateChapterField( {
					id: chapterID,
					field,
					value,
				} ),
			);
		}
	};

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
			<div className="flex items-end justify-between">
				<div>
					{ isError[ chapterID ]
						? <Tooltip text={ generateTooltipText() } className="chapter-error-tooltip">
							<Button icon={ cautionFilled } height={ 20 } width={ 20 } className="p-0" />
						</Tooltip>
						: <div className="w-[36px] pr-4"></div>
					}
				</div>
				<div className="flex items-center justify-between pt-4 gap-3">
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
		</div>
	);
};

export default AddChapter;
