/**
 * WordPress dependencies
 */
import { CheckboxControl, TextareaControl } from '@wordpress/components';
/**
 * External dependencies
 */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
/**
 * Internal dependencies
 */
import { updateCtaLayer } from '../../redux/slice/videoSlice';

const HtmlCTA = () => {
	const [ htmlInput, setHtmlInput ] = useState( '' );
	const [ allowSkip, setAllowSkip ] = useState( true );
	const cta = useSelector( ( state ) => state.videoReducer.cta );
	const dispatch = useDispatch();

	const handleUpdateCta = () => {
		dispatch(
			updateCtaLayer( {
				id: cta.id,
				type: 'html',
				text: '',
				link: '',
				html: htmlInput,
				duration: parseInt( 5, 10 ),
			} ),
		);
	};

	return (
		<>
			<TextareaControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="HTML"
				value={ htmlInput }
				onChange={ ( value ) => {
					setHtmlInput( value ); handleUpdateCta();
				} }
				placeholder="Your HTML"
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

export default HtmlCTA;
