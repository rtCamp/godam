/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { ToggleControl, SelectControl } from '@wordpress/components';
import { useMemo, useCallback } from '@wordpress/element';

const options = [
	{ value: 'balanced', label: __( 'Balanced', 'godam' ) },
	{ value: 'priority', label: __( 'Priority', 'godam' ) },
];

const performanceHelpText = {
	balanced: __( 'Recommended for most videos. Loads thumbnails as visitors scroll and prepares the video just before they reach it. Best for overall page performance.', 'godam' ),
	priority: __( 'For hero videos above the fold. Loads the thumbnail immediately and prepares the video for the fastest possible first play. Use sparingly - one or two per page.', 'godam' ),
};

const resolveLegacyPerformanceMode = ( preload, preloadPoster ) => {
	const normalizedPreload = typeof preload === 'string' ? preload.toLowerCase() : '';

	if ( preloadPoster ) {
		return 'priority';
	}

	if ( normalizedPreload === 'preload only video thumbnail' ) {
		return 'priority';
	}

	return 'balanced';
};

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
	const { autoplay, controls, loop, muted, preload, preloadPoster, performanceMode, showShareButton, engagements } =
	attributes;
	const showShareButtonSetting = window?.godamSettings?.enableGlobalVideoShare ?? false;
	const engagementFeatureEnabled = window?.godamSettings?.engagementFeatureEnabled ?? false;
	const showEngagementSetting = engagementFeatureEnabled && ( window?.godamSettings?.enableGlobalVideoEngagement ?? false );

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
			engagements: toggleAttribute( 'engagements' ),
		};
	}, [ setAttributes ] );

	const selectedPerformanceMode = useMemo(
		() => performanceMode || resolveLegacyPerformanceMode( preload, preloadPoster ),
		[ performanceMode, preload, preloadPoster ],
	);

	const onChangePerformanceMode = useCallback( ( value ) => {
		setAttributes( {
			performanceMode: value,
			preload: value === 'priority' ? 'metadata' : 'none',
			preloadPoster: false,
		} );
	}, [ setAttributes ] );

	return (
		<>
			<div data-test-id="godam-video-control-autoplay">
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
			</div>
			<div data-test-id="godam-video-control-loop">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Loop', 'godam' ) }
					onChange={ toggleFactory.loop }
					checked={ !! loop }
				/>
			</div>
			<div data-test-id="godam-video-control-muted">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Muted', 'godam' ) }
					onChange={ toggleFactory.muted }
					disabled={ autoplay }
					checked={ !! muted }
					help={ getMutedHelp }
				/>
			</div>
			<div data-test-id="godam-video-control-controls">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Playback controls', 'godam' ) }
					onChange={ toggleFactory.controls }
					checked={ !! controls }
				/>
			</div>
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
					label={ __( 'Performance', 'godam' ) }
					data-test-id="godam-video-control-performance"
					value={ selectedPerformanceMode }
					onChange={ onChangePerformanceMode }
					options={ options }
					hideCancelButton
					help={ performanceHelpText[ selectedPerformanceMode ] }
				/>
			) }
			{
				showEngagementSetting && (
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Enable Likes & Comments', 'godam' ) }
						onChange={ toggleFactory.engagements }
						checked={ !! engagements }
						help={ __( 'Engagement will only be visible for transcoded videos', 'godam' ) }
					/>
				)
			}
		</>
	);
};

export default VideoSettings;
