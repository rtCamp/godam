/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const CF7 = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const cf7Forms = useSelector( ( state ) => state.videoReducer.cf7Forms );

	const restURL = window.godamRestRoute.url || '';

	const [ formHTML, setFormHTML ] = useState( '' );

	const forms = cf7Forms.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'cf7_id', value: formID } ) );
	};

	useEffect( () => {
		// Fetch the CF7 Form HTML.
		const fetchCF7Form = ( formId, theme ) => {
			axios.get( window.pathJoin( [ restURL, '/godam/v1/cf7-form' ] ), {
				params: { id: formId, theme },
			} ).then( ( response ) => {
				setFormHTML( response.data );
			} ).catch( () => {
				setFormHTML( '<p>Error loading form. Please try again later.</p>' );
			} );
		};

		if ( layer.cf7_id ) {
			fetchCF7Form( layer.cf7_id, layer.theme );
		}
	}, [
		layer.cf7_id,
		layer.theme,
		restURL,
	] );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	return (
		<>
			{
				forms.length > 0 &&
					<FormSelector disabled={ ! isValidAPIKey } className="gravity-form-selector mb-4" formID={ layer.cf7_id } forms={ forms } handleChange={ changeFormID } />
			}

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} } className="easydam-layer">
						<div className="form-container" dangerouslySetInnerHTML={ { __html: formHTML } } />
					</div>
					{ layer.allow_skip &&
					<Button
						className="skip-button"
						variant="primary"
						icon={ chevronRight }
						iconSize="18"
						iconPosition="right"
					>
						{ __( 'Skip', 'godam' ) }
					</Button>
					}
				</>
			</LayerControl>
		</>
	);
};

export default CF7;
