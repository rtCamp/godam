/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
		</>
	);
};

export default HtmlCTA;
