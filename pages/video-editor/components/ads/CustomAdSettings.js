/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TextControl, ToggleControl, Notice, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import React, { useState, useEffect } from 'react';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { isValidURL } from '../../utils';
import { replace, trash } from '@wordpress/icons';

const CustomAdSettings = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';
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

	// Validate URL on component load
	useEffect( () => {
		if ( layer?.click_link && ! isValidURL( layer.click_link ) ) {
			setIsValid( false );
		}
	}, [] );

	const handleChange = ( value ) => {
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'click_link',
				value,
			} ),
		);

		const valid = isValidURL( value );
		setIsValid( valid );
	};

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.validApiKey;

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
			<div className="flex flex-col items-start mb-4">
				<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mt-2 godam-input-label">{ __( 'Custom Ad', 'godam' ) }</label>
				<div className="flex gap-2">
					{ ! layer?.ad_url && ( <Button
						__nextHasNoMarginBottom
						className="mb-2 godam-button"
						variant="primary"
						onClick={ () => OpenVideoSelector() }
						disabled={ adServer === 'ad-server' || ! isValidAPIKey }
					>{ __( 'Select Ad video', 'godam' ) }</Button> ) }
				</div>
				{ layer?.ad_url && (
					<div className="flex mt-3">
						<div className={ `sidebar-video-container rounded-xl overflow-scroll ${ adServer === 'ad-server' || ! isValidAPIKey ? 'disabled-video' : '' }` }>
							<video
								src={ layer.ad_url }
								controls={ adServer !== 'ad-server' }
							/>
							{ ( adServer === 'ad-server' || ! isValidAPIKey ) && <div className="video-overlay" /> }
						</div>
						<div className="ml-[6px] flex flex-col">
							<Tooltip text={ __( 'Replace Ad Video', 'godam' ) } placement="right">
								<Button className="!text-brand-neutral-900" icon={ replace } onClick={ OpenVideoSelector } />
							</Tooltip>
							<Tooltip text={ __( 'Remove Ad Video', 'godam' ) } placement="right">
								<Button className="mt-1" icon={ trash } isDestructive onClick={ () => dispatch( updateLayerField( { id: layerID, field: 'ad_url', value: '' } ) ) } />
							</Tooltip>
						</div>
					</div>
				) }
			</div>

			<ToggleControl
				__nextHasNoMarginBottom
				className="mb-4 godam-toggle"
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
					className="mb-4 godam-input"
					onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'skip_offset', value } ) ) }
					type="number"
					min="0"
					disabled={ adServer === 'ad-server' || ! isValidAPIKey }
				/>
			}

			<div className="mb-4">
				<TextControl
					label={ __( 'Click link', 'godam' ) }
					placeholder="https://example"
					help={ __( 'Enter the URL to redirect when the ad is clicked', 'godam' ) }
					value={ layer?.click_link }
					className="godam-input"
					onChange={ handleChange }
					disabled={ adServer === 'ad-server' || ! isValidAPIKey }
					type="url"
				/>
				{ ! isValid && (
					<div className="text-yellow-600 text-sm -mt-2 flex items-center gap-1">
						{ __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) }
					</div>
				) }
			</div>
		</div>
	);
};

export default CustomAdSettings;
