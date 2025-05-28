/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TextControl, ToggleControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from 'react';

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
	const [ inputValue, setInputValue ] = useState( layer?.click_link || '' );
	const [ isValid, setIsValid ] = useState( true );
	const dispatch = useDispatch();

	const OpenVideoSelector = () => {
		const fileFrame = wp.media( {
			title: __( 'Select / Upload Ad video', 'godam' ),
			button: {
				text: __( 'Add video', 'godam' ),
			},
			library: {
				type: 'video', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			dispatch(
				updateLayerField( {
					id: layerID,
					field: 'ad_url',
					value: attachment.url,
				} ),
			);
		} );

		fileFrame.open();
	};

	// URL validation function
	const isValidURL = ( url ) => {
		try {
			new URL( url );
			return true;
		} catch {
			return false;
		}
	};

	const handleChange = ( value ) => {
		setInputValue( value );

		if ( value === '' ) {
			// Allow empty input
			setIsValid( true );
			// Optionally update field if you want to clear it on empty
			dispatch(
				updateLayerField( { id: layer.id, field: 'click_link', value: '' } ),
			);
			return;
		}

		const valid = isValidURL( value );
		setIsValid( valid );

		if ( valid ) {
			dispatch(
				updateLayerField( {
					id: layer.id,
					field: 'click_link',
					value,
				} ),
			);
		}
	};

	useEffect( () => {
		setInputValue( layer?.click_link || '' );
	}, [ layer?.click_link ] );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;

	// For now we are enabling all the features
	const isValidAPIKey = true;

	return (
		<div className="relative">

			{
				( adServer === 'ad-server' && isValidAPIKey ) &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This ad will be overriden by Ad server\'s ads', 'godam' ) }
				</Notice>
			}
			{
				( ! isValidAPIKey ) &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}
			<div className="flex flex-col items-start">
				<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Custom Ad', 'godam' ) }</label>
				<div className="flex gap-2">
					<Button
						__nextHasNoMarginBottom
						className="mb-2"
						variant="primary"
						onClick={ () => OpenVideoSelector() }
						disabled={ adServer === 'ad-server' || ! isValidAPIKey }
					>{ layer?.ad_url ? __( 'Replace Ad video', 'godam' ) : __( 'Select Ad video', 'godam' ) }</Button>
					{
						layer?.ad_url &&
						<Button
							variant="secondary"
							isDestructive
							onClick={ () => dispatch( updateLayerField( { id: layerID, field: 'ad_url', value: '' } ) ) }
							disabled={ adServer === 'ad-server' || ! isValidAPIKey }
						>{ __( 'Remove Ad video', 'godam' ) }</Button>

					}
				</div>
				{
					layer?.ad_url && (
						<div className={ `sidebar-video-container ${ adServer === 'ad-server' || ! isValidAPIKey ? 'disabled-video' : '' }` }>
							<video
								src={ layer.ad_url }
								controls={ adServer !== 'ad-server' }
							/>
							{ ( adServer === 'ad-server' || ! isValidAPIKey ) && <div className="video-overlay" /> }
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
				disabled={ adServer === 'ad-server' || ! isValidAPIKey }
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
					disabled={ adServer === 'ad-server' || ! isValidAPIKey }
				/>
			}

			<TextControl
				label={ __( 'Click link', 'godam' ) }
				placeholder="https://example"
				help={ __( 'Enter the URL to redirect when the ad is clicked', 'godam' ) }
				value={ inputValue }
				className="mb-4"
				onChange={ handleChange }
				disabled={ adServer === 'ad-server' || ! isValidAPIKey }
				isInvalid={ ! isValid }
				type="url"
			/>
			{ ! isValid && (
				<p className="text-red-500 -mt-3 mx-0 mb-0">
					{ __( 'Please enter a valid URL (https://…)', 'godam' ) }
				</p>
			) }
		</div>
	);
};

export default CustomAdSettings;
