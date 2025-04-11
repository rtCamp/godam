/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button, SelectControl } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const templateOptions = [
	{
		value: 'orbital',
		label: 'Orbital',
	},
	{
		value: 'gravity',
		label: 'Gravity',
	},
];

const GravityForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const gforms = useSelector( ( state ) => state.videoReducer.gforms );

	const forms = gforms.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const [ formHTML, setFormHTML ] = useState( '' );

	const restURL = window.godamRestRoute.url || '';

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	useEffect( () => {
		// Fetch the Gravity Form HTML
		const fetchGravityForm = ( formId, theme ) => {
			axios.get( window.pathJoin( [ restURL, '/godam/v1/gform' ] ), {
				params: { id: formId, theme },
			} ).then( ( response ) => {
				setFormHTML( response.data );
			} ).catch( () => {
				// Handle error without using console
				setFormHTML( '<p>Error loading form. Please try again later.</p>' );
			} );
		};

		if ( layer.gf_id ) {
			fetchGravityForm( layer.gf_id, layer.theme );
		}
	}, [
		layer.gf_id,
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
					<FormSelector disabled={ ! isValidAPIKey } className="gravity-form-selector mb-4" formID={ layer.gf_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
				disabled={ ! isValidAPIKey }
			/>

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

export default GravityForm;
