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

const VideoSettings = ( { setAttributes, attributes } ) => {
	const { autoplay, controls, loop, muted, preload, showShareButton } =
	attributes;

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
			showShareButton: toggleAttribute( 'showShareButton' ),
		};
	}, [] );

	const onChangePreload = useCallback( ( value ) => {
		setAttributes( { preload: value } );
	}, [] );

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
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Share Button', 'godam' ) }
				onChange={ toggleFactory.showShareButton }
				checked={ !! showShareButton }
				help={ getShowShareButtonHelp }
			/>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Preload', 'godam' ) }
				value={ preload }
				onChange={ onChangePreload }
				options={ options }
				hideCancelButton
			/>
		</>
	);
};

export default VideoSettings;
