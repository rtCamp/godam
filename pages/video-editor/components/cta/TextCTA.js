/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { CheckboxControl, TextControl } from '@wordpress/components';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

const TextCTA = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	return (
		<>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="Text"
				value={ layer.text }
				onChange={ ( value ) => {
					dispatch( updateLayerField( { id: layer.id, field: 'text', value } ) );
				} }
				placeholder="Your text"
			/>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="URL"
				value={ layer.link }
				onChange={ ( value ) => {
					dispatch( updateLayerField( { id: layer.id, field: 'link', value } ) );
				} }
				placeholder="https://rtcamp.com"
			/>
		</>
	);
};

export default TextCTA;
