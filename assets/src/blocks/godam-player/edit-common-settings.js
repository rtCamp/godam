/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';
import { ToggleControl, SelectControl } from '@wordpress/components';
import { useMemo, useCallback } from '@wordpress/element';

const options = [
	{ value: 'auto', label: __( 'Auto', 'godam' ) },
	{ value: 'metadata', label: __( 'Metadata', 'godam' ) },
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
	const { autoplay, controls, loop, muted, preload, showShareButton, engagements } =
	attributes;
	const showEngagementSetting = window?.godamSettings?.enableGlobalVideoEngagement ?? false;
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

	const getShowShareButtonHelp = useMemo( () => {
		if ( ! showShareButton ) {
			return __( 'Removes the share button from the video player.', 'godam' );
		}

		return null;
	}, [ showShareButton ] );

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
			engagements: toggleAttribute( 'engagements' ),
			showShareButton: toggleAttribute( 'showShareButton' ),
		};
	}, [ setAttributes ] );

	const onChangePreload = useCallback( ( value ) => {
		setAttributes( { preload: value } );
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
						help={ getShowShareButtonHelp }
					/>
				)
			}
			{ ! isInsideQueryLoop && (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Preload', 'godam' ) }
					value={ preload }
					onChange={ onChangePreload }
					options={ options }
					hideCancelButton
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
