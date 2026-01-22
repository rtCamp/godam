/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TextControl, ToggleControl, Notice, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState } from 'react';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { replace, trash } from '@wordpress/icons';

const CustomAdSettings = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';
	const [ isValid, setIsValid ] = useState( true );
	const dispatch = useDispatch();

	/**
	 * Convert duration from minute:seconds format to total seconds
	 * @param {string} duration - Duration in format "MM:SS" or "H:MM:SS"
	 * @return {number} Total seconds
	 */
	const convertDurationToSeconds = ( duration ) => {
		if ( ! duration || typeof duration !== 'string' ) {
			return 0;
		}

		const parts = duration.split( ':' ).map( ( part ) => parseInt( part, 10 ) );

		if ( parts.length === 2 ) {
			// Format is MM:SS
			const [ minutes, seconds ] = parts;
			return ( minutes * 60 ) + seconds;
		} else if ( parts.length === 3 ) {
			// Format is H:MM:SS
			const [ hours, minutes, seconds ] = parts;
			return ( hours * 3600 ) + ( minutes * 60 ) + seconds;
		}

		return 0;
	};

	/**
	 * Get video duration by loading the video element
	 * @param {string} videoUrl - URL of the video
	 * @return {Promise<number>} Video duration in seconds
	 */
	const getVideoDuration = ( videoUrl ) => {
		return new Promise( ( resolve ) => {
			const video = document.createElement( 'video' );
			video.preload = 'metadata';

			video.onloadedmetadata = function() {
				window.URL.revokeObjectURL( video.src );
				const duration = Math.floor( video.duration );
				resolve( duration );
			};

			video.onerror = function() {
				resolve( 0 );
			};

			video.src = videoUrl;
		} );
	};

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

		fileFrame.on( 'select', async function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			// Extract video duration from attachment metadata
			const videoDuration = attachment?.fileLength || attachment?.meta?.length_formatted || 0;

			// Convert duration to seconds if it's in minute:seconds format
			let durationInSeconds = typeof videoDuration === 'string'
				? convertDurationToSeconds( videoDuration )
				: videoDuration;

			// Update ad URL
			dispatch(
				updateLayerField( {
					id: layerID,
					field: 'ad_url',
					value: attachment.url,
				} ),
			);

			// If duration is not available from metadata, calculate it from video element
			if ( ! durationInSeconds || durationInSeconds === 0 ) {
				durationInSeconds = await getVideoDuration( attachment.url );
			}

			// Update ad duration if available
			if ( durationInSeconds ) {
				dispatch(
					updateLayerField( {
						id: layerID,
						field: 'ad_duration',
						value: durationInSeconds,
					} ),
				);
			}
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

			<TextControl
				label={ __( 'Click link', 'godam' ) }
				placeholder="https://example"
				help={ __( 'Enter the URL to redirect when the ad is clicked', 'godam' ) }
				value={ layer?.click_link }
				className="mb-4 godam-input"
				onChange={ handleChange }
				disabled={ adServer === 'ad-server' || ! isValidAPIKey }
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
