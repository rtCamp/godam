/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

const CustomAdSettings = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	const OpenVideoSelector = () => {
		const fileFrame = wp.media( {
			title: 'Select Brand Image',
			button: {
				text: __( 'Edit video', 'transcoder' ),
			},
			library: {
				type: 'video', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			dispatch( updateLayerField( { id: layerID, field: 'adVideoUrl', value: attachment.url } ) );
		} );

		fileFrame.open();
	};

	return (
		<>
			<div className="flex flex-col items-start mb-4">
				<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Custom Ad', 'transcoder' ) }</label>
				<div className="flex gap-2">
					<Button
						className="mb-2"
						variant="primary"
						onClick={ () => OpenVideoSelector() }
					>{ layer?.adVideoUrl ? __( 'Replace Ad video', 'transcoder' ) : __( 'Select Ad video', 'transcoder' ) }</Button>
					{
						layer?.adVideoUrl &&
						<Button
							variant="secondary"
							isDestructive
							onClick={ () => dispatch( updateLayerField( { id: layerID, field: 'adVideoUrl', value: '' } ) ) }
						>{ __( 'Remove Ad video', 'transcoder' ) }</Button>

					}
				</div>
				{
					layer?.adVideoUrl &&
					<video src={ layer.adVideoUrl } controls />
				}
			</div>

			<ToggleControl
				className="mb-4"
				label={ __( 'Skippable', 'transcoder' ) }
				checked={ layer?.skippable ?? false }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'skippable', value } ) )
				}
				help={ __( 'Allow user to skip ad', 'transcoder' ) }
			/>
			{
				layer?.skippable &&
				<TextControl
					label={ __( 'Skip time', 'transcoder' ) }
					help={ __( 'Time in seconds after which the skip button will appear', 'transcoder' ) }
					value={ layer?.skipTime }
					className="mb-4"
					onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'skipTime', value } ) ) }
					type="number"
					min="0"
				/>
			}

		</>
	);
};

export default CustomAdSettings;
