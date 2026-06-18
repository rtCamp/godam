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
		<div data-test-id="godam-cta-editor-html">
			<span className="text-[11px] uppercase font-medium mb-2 block">{ __( 'Custom HTML', 'godam' ) }</span>
			<Editor
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
		</div>
	);
};

export default HtmlCTA;
