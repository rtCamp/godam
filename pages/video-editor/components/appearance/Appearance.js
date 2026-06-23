/**
 * External dependencies
 */
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, Tooltip } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { plus, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import '../../video-control.scss';
import { updateVideoConfig, setCurrentLayer } from '../../redux/slice/videoSlice';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import ThumbnailSelector from './ThumbnailSelector.jsx';
import { VeSection, VeToggle, VeCustomSelect, VeTextInput, VeColorList } from '../controls';

const DEFAULT_APPEARANCE_COLOR = '#2b333fb3';
const DEFAULT_HOVER_COLOR = '#fff';

/**
 * Player Settings tab — redesigned to the new flat-section layout.
 *
 * @param {Object} props              Props.
 * @param {number} props.attachmentID WordPress attachment id (for the thumbnail selector).
 * @return {JSX.Element} The settings panel.
 */
const Appearance = ( { attachmentID } ) => {
	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const controlBar = videoConfig.controlBar;

	const [ brandNotice, setBrandNotice ] = useState( { message: '', status: 'error', isVisible: false } );

	useEffect( () => {
		// Keep the captions button visibility in sync (it re-adds on load).
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		if ( controlBar.subsCapsButton && captionsButton ) {
			captionsButton.classList.remove( 'vjs-hidden' );
		}
		dispatch( setCurrentLayer( null ) );
	}, [ dispatch, controlBar.subsCapsButton ] );

	const updateControlBar = ( patch ) => {
		dispatch( updateVideoConfig( { controlBar: { ...controlBar, ...patch } } ) );
	};

	const handleVolumeToggle = () => {
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		updateControlBar( { volumePanel: ! controlBar.volumePanel } );
		if ( volumeSlider ) {
			volumeSlider.classList.toggle( 'hide', controlBar.volumePanel );
			volumeSlider.classList.toggle( 'show', ! controlBar.volumePanel );
		}
	};

	const handleCaptionsToggle = () => {
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		updateControlBar( { subsCapsButton: ! controlBar.subsCapsButton } );
		if ( captionsButton ) {
			captionsButton.classList.toggle( 'hide', controlBar.subsCapsButton );
			captionsButton.classList.toggle( 'show', ! controlBar.subsCapsButton );
		}
	};

	const handleSkipDuration = ( value ) => {
		const seconds = parseInt( value, 10 );
		if ( Number.isNaN( seconds ) || seconds < 1 ) {
			return;
		}
		updateControlBar( {
			skipButtons: { forward: seconds, backward: seconds },
		} );
	};

	const openBrandLogoPicker = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Custom Logo', 'godam' ),
			button: { text: __( 'Use this logo', 'godam' ) },
			library: { type: 'image' },
			multiple: false,
		} );

		fileFrame.on( 'select', () => {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			if ( attachment?.type !== 'image' ) {
				setBrandNotice( { message: __( 'Only image files are allowed', 'godam' ), status: 'error', isVisible: true } );
				return;
			}
			setBrandNotice( { ...brandNotice, isVisible: false } );
			updateControlBar( {
				customBrandImg: attachment.url,
				customBrandImgId: attachment.id,
				brandingIcon: true,
			} );
		} );

		fileFrame.open();
	};

	const removeBrandLogo = () => {
		updateControlBar( {
			customBrandImg: '',
			customBrandImgId: null,
			brandingIcon: false,
		} );
	};

	const handleColorChange = ( field, fallback ) => ( value ) => {
		updateControlBar( { [ field ]: value || fallback } );
	};

	const hasLogo = controlBar.customBrandImg?.length > 0;

	return (
		<div id="easydam-player-settings" className="godam-ve-settings">
			<div className="godam-ve-settings__head">
				<h2 className="godam-ve-settings__title">{ __( 'Settings', 'godam' ) }</h2>
			</div>

			<div className="godam-ve-config">

				<VeSection title={ __( 'Display Settings', 'godam' ) }>
					<VeToggle
						label={ __( 'Show volume slider', 'godam' ) }
						checked={ controlBar.volumePanel }
						onChange={ handleVolumeToggle }
					/>
					<VeToggle
						label={ __( 'Display captions', 'godam' ) }
						checked={ controlBar.subsCapsButton }
						onChange={ handleCaptionsToggle }
					/>
					<VeCustomSelect
						label={ __( 'Adjust Skip Duration', 'godam' ) }
						help={ __( 'Number of seconds the skip-forward / skip-backward buttons jump.', 'godam' ) }
						value={ controlBar.skipButtons?.forward?.toString() || '10' }
						onChange={ handleSkipDuration }
						options={ [
							{ label: __( '5 seconds', 'godam' ), value: '5' },
							{ label: __( '10 seconds', 'godam' ), value: '10' },
							{ label: __( '30 seconds', 'godam' ), value: '30' },
						] }
					/>
				</VeSection>

				<VeSection title={ __( 'Customisation Settings', 'godam' ) }>
					{ ! hasLogo ? (
						<Button
							className="godam-ve-media-select"
							variant="secondary"
							icon={ plus }
							onClick={ openBrandLogoPicker }
						>
							{ __( 'Add Custom logo', 'godam' ) }
						</Button>
					) : (
						<div className="godam-ve-media">
							<button
								type="button"
								className="godam-ve-media__main"
								onClick={ openBrandLogoPicker }
								aria-label={ __( 'Replace logo', 'godam' ) }
							>
								<img src={ controlBar.customBrandImg } alt={ __( 'Custom logo', 'godam' ) } className="godam-ve-media__thumb" />
								<span className="godam-ve-media__meta">
									<span className="godam-ve-media__name">{ __( 'Custom logo', 'godam' ) }</span>
									<span className="godam-ve-media__size">{ __( 'Click to replace', 'godam' ) }</span>
								</span>
							</button>
							<Tooltip text={ __( 'Remove logo', 'godam' ) } placement="top">
								<Button className="godam-ve-media__remove" icon={ trash } isDestructive onClick={ removeBrandLogo } />
							</Tooltip>
						</div>
					) }
					{ brandNotice.isVisible && (
						<Notice status={ brandNotice.status } onRemove={ () => setBrandNotice( { ...brandNotice, isVisible: false } ) }>
							{ brandNotice.message }
						</Notice>
					) }
				</VeSection>

				<VeSection title={ __( 'Player Theme', 'godam' ) }>
					<VeColorList>
						<ColorPickerButton
							className="godam-ve-color-row"
							value={ controlBar.appearanceColor ?? DEFAULT_APPEARANCE_COLOR }
							label={ __( 'Player Appearance', 'godam' ) }
							enableAlpha={ true }
							onChange={ handleColorChange( 'appearanceColor', DEFAULT_APPEARANCE_COLOR ) }
						/>
						<ColorPickerButton
							className="godam-ve-color-row"
							value={ controlBar.hoverColor ?? DEFAULT_HOVER_COLOR }
							label={ __( 'Icons hover colour', 'godam' ) }
							enableAlpha={ true }
							onChange={ handleColorChange( 'hoverColor', DEFAULT_HOVER_COLOR ) }
						/>
					</VeColorList>
				</VeSection>

				<VeSection title={ __( 'Ad Server', 'godam' ) }>
					<VeToggle
						label={ __( 'Use ad server\'s ad', 'godam' ) }
						help={ __( 'Enable this option to use ads from the ad server. This option will disable the ads layer', 'godam' ) }
						checked={ videoConfig.adServer === 'ad-server' }
						onChange={ ( checked ) => dispatch( updateVideoConfig( { adServer: checked ? 'ad-server' : 'self-hosted' } ) ) }
					/>
					{ videoConfig.adServer === 'ad-server' && (
						<VeTextInput
							label={ __( 'Ad Tag URL', 'godam' ) }
							type="url"
							value={ videoConfig.adTagURL }
							onChange={ ( value ) => dispatch( updateVideoConfig( { adTagURL: value } ) ) }
							placeholder="https://"
							help={
								<span>
									{ __( 'A VAST ad tag URL is used by a player to retrieve video and audio ads.', 'godam' ) }{ ' ' }
									<a href="https://support.google.com/admanager/answer/177207?hl=en" target="_blank" rel="noreferrer noopener">
										{ __( 'Learn more.', 'godam' ) }
									</a>
								</span>
							}
						/>
					) }
				</VeSection>

				<VeSection title={ __( 'Thumbnail', 'godam' ) }>
					<p className="godam-ve-field__help">
						{ __( 'Select a default thumbnail for this video. You can also override the default thumbnail for different video placements.', 'godam' ) }
					</p>
					<ThumbnailSelector attachmentID={ attachmentID } />
				</VeSection>

			</div>
		</div>
	);
};

export default Appearance;
