/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { plus, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { isValidURL } from '../../utils';
import { VeSection, VeTextInput, VeToggle } from '../controls';

/**
 * Format a whole-second duration as m:ss.
 *
 * @param {number} totalSeconds Duration in seconds.
 * @return {string} Formatted duration.
 */
const formatDuration = ( totalSeconds ) => {
	const secs = Math.max( 0, Math.floor( Number( totalSeconds ) || 0 ) );
	const mins = Math.floor( secs / 60 );
	const rem = secs % 60;
	return `${ mins }:${ rem < 10 ? '0' : '' }${ rem }`;
};

const CustomAdSettings = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';
	const isAdServer = adServer === 'ad-server';
	const dispatch = useDispatch();

	// Click link is valid unless it is non-empty and not a URL (mirrors the
	// inline validation on the CTA button link / hotspot link).
	const linkInvalid = Boolean( layer?.click_link ) && ! isValidURL( layer.click_link );

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

			// Extract video duration from attachment metadata.
			// - attachment.fileLength: numeric duration in seconds provided directly on some media attachments.
			// - attachment.meta.length_formatted: human-readable duration string (e.g., "1:23") stored in attachment meta.
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

	const handleLinkChange = ( value ) => {
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'click_link',
				value,
			} ),
		);
	};

	// Friendly file name + duration shown on the media card.
	const adFileName = layer?.ad_url
		? decodeURIComponent( layer.ad_url.split( '/' ).pop().split( '?' )[ 0 ] ) || __( 'Ad video', 'godam' )
		: '';
	const adDurationLabel = layer?.ad_duration ? formatDuration( layer.ad_duration ) : '';

	return (
		<>
			{ isAdServer && (
				<VeSection>
					<Notice status="warning" isDismissible={ false }>
						{ __( 'This ad will be overridden by the Ad server\'s ads.', 'godam' ) }
					</Notice>
				</VeSection>
			) }

			{ /* Ad video: select, then click the card to replace or trash to remove. */ }
			<VeSection title={ __( 'Ad Video', 'godam' ) }>
				{ ! layer?.ad_url && (
					<>
						<Button
							className="godam-ve-media-select"
							variant="secondary"
							icon={ plus }
							onClick={ OpenVideoSelector }
							disabled={ isAdServer }
							data-test-id="godam-ad-button-select-video"
						>
							{ __( 'Select Ad Video', 'godam' ) }
						</Button>
						<p className="godam-ve-media-hint">
							{ __( 'Upload or choose a self-hosted video (MP4 recommended).', 'godam' ) }
						</p>
					</>
				) }

				{ layer?.ad_url && (
					<div className="godam-ve-media">
						<Tooltip text={ __( 'Click to replace video', 'godam' ) } placement="top">
							<button
								type="button"
								className="godam-ve-media__main"
								onClick={ OpenVideoSelector }
								aria-label={ __( 'Replace ad video', 'godam' ) }
								disabled={ isAdServer }
								data-test-id="godam-ad-button-replace-video"
							>
								<video
									src={ layer.ad_url }
									className="godam-ve-media__thumb"
									muted
									preload="metadata"
								/>
								<span className="godam-ve-media__meta">
									<span className="godam-ve-media__name">{ adFileName }</span>
									{ adDurationLabel && (
										<span className="godam-ve-media__size">{ adDurationLabel }</span>
									) }
								</span>
							</button>
						</Tooltip>
						<Tooltip text={ __( 'Remove video', 'godam' ) } placement="top">
							<Button
								className="godam-ve-media__remove"
								icon={ trash }
								isDestructive
								onClick={ () => dispatch( updateLayerField( { id: layerID, field: 'ad_url', value: '' } ) ) }
								disabled={ isAdServer }
								data-test-id="godam-ad-button-remove-video"
							/>
						</Tooltip>
					</div>
				) }
			</VeSection>

			{ /* Playback: skip behaviour. */ }
			<VeSection title={ __( 'Playback', 'godam' ) }>
				<div data-test-id="godam-ad-control-skippable">
					<VeToggle
						label={ __( 'Skippable', 'godam' ) }
						help={ __( 'Allow viewers to skip the ad', 'godam' ) }
						checked={ layer?.skippable ?? false }
						onChange={ ( value ) =>
							dispatch( updateLayerField( { id: layer.id, field: 'skippable', value } ) )
						}
						disabled={ isAdServer }
					/>
				</div>

				{ layer?.skippable && (
					<VeTextInput
						label={ __( 'Skip after (seconds)', 'godam' ) }
						help={ __( 'Time in seconds before the skip button appears', 'godam' ) }
						type="number"
						min="0"
						value={ layer?.skip_offset ?? '' }
						onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'skip_offset', value } ) ) }
						disabled={ isAdServer }
						data-test-id="godam-ad-control-skip-time"
					/>
				) }
			</VeSection>

			{ /* Click-through link with inline URL validation. */ }
			<VeSection title={ __( 'Click-through', 'godam' ) }>
				<VeTextInput
					label={ __( 'Click link', 'godam' ) }
					type="url"
					placeholder="https://example.com"
					help={ __( 'URL to open when the ad is clicked', 'godam' ) }
					error={ linkInvalid ? __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) : '' }
					value={ layer?.click_link ?? '' }
					onChange={ handleLinkChange }
					disabled={ isAdServer }
					data-test-id="godam-ad-control-link"
				/>
			</VeSection>
		</>
	);
};

export default CustomAdSettings;
