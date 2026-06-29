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
import { VeSection } from '../controls';

const HtmlCTA = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	return (
		<VeSection title={ __( 'Custom HTML', 'godam' ) }>
			<div data-test-id="godam-cta-editor-html">
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
		</VeSection>
	);
};

export default HtmlCTA;
