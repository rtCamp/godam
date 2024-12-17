/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { CheckboxControl, TextControl } from '@wordpress/components';
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
/**
 * Internal dependencies
 */
import { updateCtaLayer } from '../../redux/slice/videoSlice';

const TextCTA = () => {
	const [ textInput, setTextInput ] = useState( '' );
	const [ urlInput, setUrlInput ] = useState( '' );
	const [ allowSkip, setAllowSkip ] = useState( true );
	const cta = useSelector( ( state ) => state.videoReducer.cta );
	const dispatch = useDispatch();

	const handleUpdateCta = ( key, value ) => {
		console.log( textInput );
		dispatch(
			updateCtaLayer( {
				id: cta.id,
				type: 'text',
				[ key ]: value,
				html: '',
				duration: parseInt( 5, 10 ),
			} ),
		);
	};
	return (
		<>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="Text"
				value={ textInput }
				onChange={ ( value ) => {
					setTextInput( value );
					handleUpdateCta( 'text', value );
				} }
				placeholder="Your text"
			/>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="URL"
				value={ urlInput }
				onChange={ ( value ) => {
					setUrlInput( value );
					handleUpdateCta( 'link', value );
				} }
				placeholder="https://rtcamp.com"
			/>
			<CheckboxControl
				__nextHasNoMarginBottom
				label="Allow to Skip"
				checked={ allowSkip }
				onChange={ () => setAllowSkip( ! allowSkip ) }
			/>
		</>
	);
};

export default TextCTA;
