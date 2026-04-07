/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';
import { ToggleControl, SelectControl } from '@wordpress/components';
import { useMemo, useCallback } from '@wordpress/element';

const options = [
	{ value: 'auto', label: __( 'Auto', 'godam' ) },
	{ value: 'metadata', label: __( 'Metadata', 'godam' ) },
	{ value: 'thumbnail', label: __( 'Preload Only Video Thumbnail', 'godam' ) },
	{ value: 'none', label: _x( 'None', 'Preload value', 'godam' ) },
];

/**
 * Video settings component.
 *
 * This component is used to render common settings like autoplay, loop for a video block.
 *
 * @param {Object}   props                           Component props.
 * @param {Function} props.setAttributes             Function to set block attributes.
 * @param {Object}   props.attributes                Block attributes.
 * @param {boolean}  [props.isInsideQueryLoop=false] Whether the video is inside a query loop.
 *
 * @return {WPElement} The video settings component.
 */
const VideoSettings = ( { setAttributes, attributes, isInsideQueryLoop = false } ) => {
	const { autoplay, controls, loop, muted, preload, preloadPoster, showShareButton } =
	attributes;
	const showShareButtonSetting = window?.godamSettings?.enableGlobalVideoShare ?? false;

	// Show a specific help for autoplay setting.
	const getAutoplayHelp = useMemo( () => {
		if ( autoplay && muted ) {
			return __( 'Autoplay may cause usability issues for some users.', 'godam' );
		}

		return null;
	}, [ autoplay, muted ] );

	// Show a specific help for muted setting.
	const getMutedHelp = useMemo( () => {
		if ( autoplay && muted ) {
			return __( 'Muted because of Autoplay.', 'godam' );
		}

		return null;
	}, [ autoplay, muted ] );

	const toggleFactory = useMemo( () => {
		const toggleAttribute = ( attribute ) => {
			return ( newValue ) => {
				setAttributes( { [ attribute ]: newValue } );
			};
		};

		return {
			autoplay: toggleAttribute( 'autoplay' ),
			loop: toggleAttribute( 'loop' ),
			muted: toggleAttribute( 'muted' ),
			controls: toggleAttribute( 'controls' ),
			showShareButton: toggleAttribute( 'showShareButton' ),
		};
	}, [ setAttributes ] );

	const selectedPreloadValue = useMemo( () => {
		// Only report 'thumbnail' when the legacy preloadPoster flag is set
		// AND preload is already 'none', so existing content with preloadPoster=true
		// but a non-'none' preload value is not misrepresented in the UI.
		if ( preloadPoster && ( ! preload || 'none' === preload ) ) {
			return 'thumbnail';
		}

		return preload || 'auto';
	}, [ preload, preloadPoster ] );

	const onChangePreload = useCallback( ( value ) => {
		if ( 'thumbnail' === value ) {
			// Keep video preload off while preloading only poster image.
			setAttributes( { preload: 'none', preloadPoster: true } );

			return;
		}

		setAttributes( { preload: value, preloadPoster: false } );
	}, [ setAttributes ] );

	return (
		<>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Autoplay', 'godam' ) }
				onChange={ ( e ) => {
					/**
					 * When autoplay is enabled, mute the video.
					 * This behaviour follows core/video block.
					 */
					toggleFactory.muted( e );
					toggleFactory.autoplay( e );
				} }
				checked={ !! autoplay }
				help={ getAutoplayHelp }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Loop', 'godam' ) }
				onChange={ toggleFactory.loop }
				checked={ !! loop }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Muted', 'godam' ) }
				onChange={ toggleFactory.muted }
				disabled={ autoplay }
				checked={ !! muted }
				help={ getMutedHelp }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Playback controls', 'godam' ) }
				onChange={ toggleFactory.controls }
				checked={ !! controls }
			/>
			{
				showShareButtonSetting && (
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Share Button', 'godam' ) }
						onChange={ toggleFactory.showShareButton }
						checked={ !! showShareButton }
						help={ __( 'Adds a share button on the video player for transcoded videos', 'godam' ) }
					/>
				)
			}
			{ ! isInsideQueryLoop && (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Preload', 'godam' ) }
					value={ selectedPreloadValue }
					onChange={ onChangePreload }
					options={ options }
					hideCancelButton
					help={ __( 'Choose how the video should preload.', 'godam' ) }
				/>
			) }
		</>
	);
};

export default VideoSettings;
