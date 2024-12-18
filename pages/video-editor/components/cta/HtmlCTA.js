/**
 * WordPress dependencies
 */
import { TextareaControl } from '@wordpress/components';
/**
 * External dependencies
 */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

const HtmlCTA = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	return (
		<>
			<TextareaControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="HTML"
				value={ layer.html }
				onChange={ ( value ) => {
					dispatch( updateLayerField( { id: layer.id, field: 'html', value } ) );
				} }
				placeholder="Your HTML"
			/>
		</>
	);
};

export default HtmlCTA;
