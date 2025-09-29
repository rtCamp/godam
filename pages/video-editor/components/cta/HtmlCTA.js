/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

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
			<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Custom HTML', 'godam' ) }</label>
			<Editor
				id="custom-css"
				className="code-editor"
				defaultLanguage="html"
				defaultValue={ layer.html }
				options={ {
					minimap: { enabled: false },
				} }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'html', value } ) )
				}
			/>
			<p className="text-xs text-gray-600 mt-2 italic">
				{ __( 'Adding JavaScript and CSS can be risky. Please be careful and ensure your code is secure and properly tested.', 'godam' ) }
			</p>
		</>
	);
};

export default HtmlCTA;
