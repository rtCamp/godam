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
	const { autoplay, controls, loop, muted, preload } =
		attributes;

	// Show a specific help for autoplay.
	const getAutoplayHelp = useMemo( () => {
		if ( ! autoplay && ! muted ) {
			return __( 'Autoplay only works when video is muted.', 'godam' );
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
				onChange={ toggleFactory.autoplay }
				checked={ !! autoplay }
				disabled={ ! muted }
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
				onChange={ ( e ) => {
					if ( ! e ) {
						// If not muted, disable the autoplay.
						toggleFactory.autoplay( false );
					}
					toggleFactory.muted( e );
				} }
				checked={ !! muted }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Playback controls', 'godam' ) }
				onChange={ toggleFactory.controls }
				checked={ !! controls }
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
