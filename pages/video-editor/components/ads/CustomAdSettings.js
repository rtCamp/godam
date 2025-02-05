/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TextControl, ToggleControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

const CustomAdSettings = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';
	const dispatch = useDispatch();

	const OpenVideoSelector = () => {
		const fileFrame = wp.media( {
			title: 'Select Brand Image',
			button: {
				text: __( 'Edit video', 'godam' ),
			},
			library: {
				type: 'video', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			dispatch( updateLayerField( { id: layerID, field: 'ad_url', value: attachment.url } ) );
		} );

		fileFrame.open();
	};

	return (
		<div className="relative">

			{ adServer === 'ad-server' &&
			<Notice
				className="mb-4"
				status="warning"
				isDismissible={ false }
			>
				{ __( 'This ad will be overriden by Ad server\'s ads', 'godam' ) }
			</Notice>
			}
			<div className="flex flex-col items-start mb-4">
				<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Custom Ad', 'godam' ) }</label>
				<div className="flex gap-2">
					<Button
						__nextHasNoMarginBottom
						className="mb-2"
						variant="primary"
						onClick={ () => OpenVideoSelector() }
						disabled={ adServer === 'ad-server' }
					>{ layer?.ad_url ? __( 'Replace Ad video', 'godam' ) : __( 'Select Ad video', 'godam' ) }</Button>
					{
						layer?.ad_url &&
						<Button
							variant="secondary"
							isDestructive
							onClick={ () => dispatch( updateLayerField( { id: layerID, field: 'ad_url', value: '' } ) ) }
							disabled={ adServer === 'ad-server' }
						>{ __( 'Remove Ad video', 'godam' ) }</Button>

					}
				</div>
				{
					layer?.ad_url && (
						<div className={ `sidebar-video-container ${ adServer === 'ad-server' ? 'disabled-video' : '' }` }>
							<video
								src={ layer.ad_url }
								controls={ adServer !== 'ad-server' }
							/>
							{ adServer === 'ad-server' && <div className="video-overlay" /> }
						</div>
					)
				}
			</div>

			<ToggleControl
				__nextHasNoMarginBottom
				className="mb-4"
				label={ __( 'Skippable', 'godam' ) }
				checked={ layer?.skippable ?? false }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'skippable', value } ) )
				}
				help={ __( 'Allow user to skip ad', 'godam' ) }
				disabled={ adServer === 'ad-server' }
			/>
			{
				layer?.skippable &&
				<TextControl
					label={ __( 'Skip time', 'godam' ) }
					help={ __( 'Time in seconds after which the skip button will appear', 'godam' ) }
					value={ layer?.skip_offset }
					className="mb-4"
					onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'skip_offset', value } ) ) }
					type="number"
					min="0"
					disabled={ adServer === 'ad-server' }
				/>
			}

			<TextControl
				label={ __( 'Click link', 'godam' ) }
				placeholder="https://example"
				help={ __( 'Enter the URL to redirect when the ad is clicked', 'godam' ) }
				value={ layer?.click_link }
				className="mb-4"
				onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'click_link', value } ) ) }
				disabled={ adServer === 'ad-server' }
			/>

		</div>
	);
};

export default CustomAdSettings;
