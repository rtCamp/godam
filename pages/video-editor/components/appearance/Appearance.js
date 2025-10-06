/**
 * External dependencies
 */
import React, { useEffect } from 'react';

/**
 * Internal dependencies
 */
import '../../video-control.css';
/**
 * WordPress dependencies
 */
import {
	Button,
	CustomSelectControl,
	Notice,
	TextareaControl,
	ToggleControl,
	Icon,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelector } from 'react-redux';
import { updateVideoConfig, setCurrentLayer } from '../../redux/slice/videoSlice';
import GoDAM from '../../../../assets/src/images/GoDAM.png';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import { closeSmall } from '@wordpress/icons';

const Appearance = () => {
	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );

	/**
	 * State to manage the notice message and visibility.
	 */
	const [ customBrandNotice, setCustomBrandNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ customPlayNotice, setCustomPlayNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	/**
	 * To show a notice message for custom brand upload field.
	 *
	 * @param {string} message Text to display in the notice.
	 * @param {string} status  Status of the notice, can be 'success', 'error', etc.
	 */
	const showCustomBrandNotice = ( message, status = 'success' ) => {
		setCustomBrandNotice( { message, status, isVisible: true } );
	};

	/**
	 * To show a notice message for custom play button upload field.
	 *
	 * @param {string} message Text to display in the notice.
	 * @param {string} status  Status of the notice, can be 'success', 'error', etc.
	 */
	const showCustomPlayNotice = ( message, status = 'success' ) => {
		setCustomPlayNotice( { message, status, isVisible: true } );
	};

	useEffect( () => {
		//class gets re added upon component load, so we need to remove it.
		if ( videoConfig.controlBar.subsCapsButton ) {
			document
				.querySelector( '.vjs-subs-caps-button' )
				.classList.remove( 'vjs-hidden' );
		}
		dispatch( setCurrentLayer( null ) );
	}, [ dispatch, videoConfig.controlBar.subsCapsButton ] );

	function handleVolumeToggle() {
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					volumePanel: ! videoConfig.controlBar.volumePanel,
				},
			} ),
		);
		if ( volumeSlider.classList.contains( 'hide' ) ) {
			volumeSlider.classList.remove( 'hide' );
			volumeSlider.classList.add( 'show' );
		} else {
			volumeSlider.classList.add( 'hide' );
			volumeSlider.classList.remove( 'show' );
		}
	}

	function handleCaptionsToggle() {
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					subsCapsButton: ! videoConfig.controlBar.subsCapsButton,
				},
			} ),
		);

		if ( captionsButton.classList.contains( 'show' ) ) {
			captionsButton.classList.add( 'hide' );
			captionsButton.classList.remove( 'show' );
		} else {
			captionsButton.classList.remove( 'hide' );
			captionsButton.classList.add( 'show' );
		}
	}

	function handleBrandingToggle() {
		const brandingLogo = document.querySelector( '#branding-icon' );
		const controlBar = document.querySelector( '.vjs-control-bar' );

		setCustomBrandNotice( { ...customBrandNotice, isVisible: false } );

		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					brandingIcon: ! videoConfig.controlBar.brandingIcon,
				},
			} ),
		);

		if ( brandingLogo ) {
			if ( ! videoConfig.controlBar.brandingIcon ) { // added opposite condition due to delayed update of redux state.
				controlBar.appendChild( brandingLogo );
			} else {
				controlBar.removeChild( brandingLogo );
			}
		}
	}

	function handlePlayButtonPosition( e ) {
		const playButton = document.querySelector( '.vjs-big-play-button' );

		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					playButtonPosition: e.selectedItem.key,
					playButtonPositionName: e.selectedItem.name,
				},
			} ),
		);

		if ( playButton ) {
			const alignments = [
				'left-align',
				'center-align',
				'right-align',
				'top-align',
				'bottom-align',
			];
			playButton.classList.remove( ...alignments ); // Remove all alignment classes
			if ( alignments.includes( `${ e.selectedItem.key }-align` ) ) {
				playButton.classList.add( `${ e.selectedItem.key }-align` ); // Add the selected alignment class
			}
		}
	}

	let originalPlayButton = null;

	const openCustomBtnImg = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Custom Play Button Image', 'godam' ),
			button: {
				text: __( 'Use this Image', 'godam' ),
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'open', function() {
			const selection = fileFrame.state().get( 'selection' );

			if ( videoConfig.controlBar.customPlayBtnImgId ) {
				const attachment = wp.media.attachment( videoConfig.controlBar.customPlayBtnImgId );
				attachment.fetch();
				selection.add( attachment );
			}
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			/**
			 * This handles the case for the uploader tab of WordPress media library.
			 */
			if ( attachment?.type !== 'image' ) {
				showCustomPlayNotice( __( 'Only Image file is allowed', 'godam' ), 'error' );
				return;
			}

			dispatch(
				updateVideoConfig( {
					controlBar: {
						...videoConfig.controlBar,
						customPlayBtnImg: attachment.url,
						customPlayBtnImgId: attachment.id,
					},
				} ),
			);

			const playButtonElement = document.querySelector( '.vjs-big-play-button' );

			// Replace button with image tag
			if ( playButtonElement ) {
				if ( ! originalPlayButton ) {
					originalPlayButton = playButtonElement.cloneNode( true );
				}

				// Create new image element
				const imgElement = document.createElement( 'img' );
				imgElement.src = attachment.url;
				imgElement.alt = __( 'Custom Play Button', 'godam' );

				playButtonElement.classList.forEach( ( cls ) => {
					imgElement.classList.add( cls );
				} );

				imgElement.classList.add( 'custom-play-image' );

				imgElement.style.cursor = 'pointer';

				// Replace the original button with the new image
				playButtonElement.parentNode.replaceChild( imgElement, playButtonElement );
			}
		} );

		fileFrame.open();
	};

	const openBrandMediaPicker = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Brand Image', 'godam' ),
			button: {
				text: __( 'Use this brand image', 'godam' ),
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'open', function() {
			const selection = fileFrame.state().get( 'selection' );

			if ( videoConfig.controlBar.customBrandImgId ) {
				const attachment = wp.media.attachment( videoConfig.controlBar.customBrandImgId );
				attachment.fetch();
				selection.add( attachment );
			}
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			/**
			 * This handles the case for the uploader tab of WordPress media library.
			 */
			if ( attachment?.type !== 'image' ) {
				showCustomBrandNotice( __( 'Only Image file is allowed', 'godam' ), 'error' );
				return;
			}

			dispatch(
				updateVideoConfig( {
					controlBar: {
						...videoConfig.controlBar,
						customBrandImg: attachment.url,
						customBrandImgId: attachment.id,
					},
				} ),
			);

			const brandImg = document.querySelector( '#branding-icon' );

			if ( brandImg ) {
				brandImg.src = `${ attachment.url }`;
			}
		} );

		fileFrame.open();
	};

	const removeBrandImage = () => {
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					customBrandImg: '',
					customBrandImgId: null,
				},
			} ),
		);
		const brandImg = document.querySelector( '#branding-icon' );
		if ( brandImg ) {
			brandImg.src = GoDAM;
		}
	};

	const removeCustomPlayBtnImage = () => {
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					customPlayBtnImg: '',
					customPlayBtnImgId: null,
				},
			} ),
		);

		// Find the custom image element and restore original button
		const customImageElement = document.querySelector( '.custom-play-image' );

		if ( customImageElement && originalPlayButton ) {
		// Clone the original button to avoid issues with reusing DOM nodes
			const restoredButton = originalPlayButton.cloneNode( true );

			// Replace the image with the original button
			customImageElement.parentNode.replaceChild( restoredButton, customImageElement );
		} else {
		// Fallback: create a new default play button if original is not available
			const playButtonContainer = document.querySelector( '.video-js' );
			const existingCustomImage = document.querySelector( '.custom-play-image' );

			if ( playButtonContainer && existingCustomImage ) {
			// Create default Video.js play button
				const defaultButton = document.createElement( 'button' );
				defaultButton.className = 'vjs-big-play-button';
				defaultButton.type = 'button';
				defaultButton.setAttribute( 'aria-label', 'Play Video' );

				// Add the play icon span
				const iconSpan = document.createElement( 'span' );
				iconSpan.setAttribute( 'aria-hidden', 'true' );
				iconSpan.className = 'vjs-icon-placeholder';
				defaultButton.appendChild( iconSpan );

				// Replace the image with the default button
				existingCustomImage.parentNode.replaceChild( defaultButton, existingCustomImage );
			}
		}
	};

	function handleSkipTimeSettings( e ) {
		const selectedSkipVal = parseFloat( e.selectedItem.name );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					skipButtons: {
						forward: selectedSkipVal,
						backward: selectedSkipVal,
					},
				},
			} ),
		);
		const skipBackwardButton = document.querySelector(
			'[class^="vjs-skip-backward-"]',
		);
		const skipForwardButton = document.querySelector(
			'[class^="vjs-skip-forward-"]',
		);

		const backwardClasses = Array.from( skipBackwardButton.classList );
		const existingBackwardClass = backwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-backward-' ),
		);

		if ( existingBackwardClass ) {
			skipBackwardButton.classList.replace(
				existingBackwardClass,
				`vjs-skip-backward-${ selectedSkipVal }`,
			);
		}

		const forwardClasses = Array.from( skipForwardButton.classList );
		const existingForwardClass = forwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-forward-' ),
		);

		if ( existingForwardClass ) {
			skipForwardButton.classList.replace(
				existingForwardClass,
				`vjs-skip-forward-${ selectedSkipVal }`,
			);
		}
	}

	return (
		<div id="godam-player-settings" className="pb-20">
			<div className="accordion-item--content mt-4 flex flex-col gap-6">
				<div className="display-settings godam-form-group">
					<label
						htmlFor="custom-brand-logo"
						className="label-text"
					>
						{ __( 'Display Settings', 'godam' ) }
					</label>

					<div className="flex flex-col gap-3">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Show Volume Slider', 'godam' ) }
							checked={ videoConfig.controlBar.volumePanel }
							onChange={ handleVolumeToggle }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Display Captions', 'godam' ) }
							onChange={ handleCaptionsToggle }
							checked={ videoConfig.controlBar.subsCapsButton }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Show Branding', 'godam' ) }
							onChange={ handleBrandingToggle }
							checked={ videoConfig.controlBar.brandingIcon }
						/>
					</div>

				</div>

				{ videoConfig.controlBar.brandingIcon && (
					<div className="godam-form-group">
						<label
							htmlFor="custom-brand-logo"
							className="label-text"
						>
							{ __( 'Custom Brand Logo', 'godam' ) }
						</label>
						<Button
							onClick={ openBrandMediaPicker }
							variant="primary"
							className="mr-2 godam-button"
						>
							{ videoConfig.controlBar.customBrandImg?.length > 0 ? __( 'Replace', 'godam' ) : __( 'Upload', 'godam' ) }
						</Button>
						{ videoConfig.controlBar.customBrandImg?.length > 0 && (
							<Button
								onClick={ removeBrandImage }
								variant="secondary"
								isDestructive
								className="godam-button"
							>
								{ __( 'Remove', 'godam' ) }
							</Button>
						) }
						{ videoConfig.controlBar.customBrandImg?.length > 0 && (
							<div className="mt-2">
								<img
									src={ videoConfig.controlBar.customBrandImg }
									alt={ 'Selected custom brand' }
									className="max-w-[200px]"
								/>
							</div>
						) }
						{ customBrandNotice.isVisible && (
							<Notice
								className="my-4"
								status={ customBrandNotice.status }
								onRemove={ () => setCustomBrandNotice( { ...customBrandNotice, isVisible: false } ) }
							>
								{ customBrandNotice.message }
							</Notice>
						) }
					</div>
				) }
				<div className="form-group">
					<CustomSelectControl
						__next40pxDefaultSize
						className="godam-input"
						label={ __( 'Play Button Position', 'godam' ) }
						onChange={ handlePlayButtonPosition }
						options={ [
							{
								key: 'center',
								name: 'Center',
							},
							{
								key: 'left',
								name: 'Left',
							},
							{
								key: 'top',
								name: 'Top',
							},
							{
								key: 'bottom',
								name: 'Bottom',
							},
							{
								key: 'right',
								name: 'Right',
							},
						] }
						value={ {
							key: videoConfig.controlBar.playButtonPosition,
							name: videoConfig.controlBar.playButtonPositionName,
						} }
					/>
				</div>
				<div className="godam-form-group">
					<label
						htmlFor="custom-hover-color"
						className="label-text"
					>
						{ __( 'Custom Play Button', 'godam' ) }
					</label>
					<Button
						onClick={ openCustomBtnImg }
						variant="primary"
						className="mr-2 godam-button"
					>
						{ videoConfig.controlBar.customPlayBtnImg?.length > 0 ? __( 'Replace', 'godam' ) : __( 'Upload', 'godam' ) }
					</Button>
					{ videoConfig.controlBar.customPlayBtnImg?.length > 0 && (
						<Button
							onClick={ removeCustomPlayBtnImage }
							variant="secondary"
							className="godam-button"
							isDestructive
						>
							{ __( 'Remove', 'godam' ) }
						</Button>
					) }
					{ videoConfig.controlBar.customPlayBtnImg?.length > 0 && (
						<div className="mt-2">
							<img
								src={ videoConfig.controlBar.customPlayBtnImg }
								alt={ 'Selected custom play button' }
								className="max-w-[200px] mt-2"
							/>
						</div>
					) }
					{ customPlayNotice.isVisible && (
						<Notice
							className="my-4"
							status={ customPlayNotice.status }
							onRemove={ () => setCustomPlayNotice( { ...customPlayNotice, isVisible: false } ) }
						>
							{ customPlayNotice.message }
						</Notice>
					) }
				</div>
				<div className="form-group">
					<CustomSelectControl
						__next40pxDefaultSize
						className="godam-input"
						onChange={ handleSkipTimeSettings }
						options={ [
							{
								key: '5',
								name: '5',
							},
							{
								key: '10',
								name: '10',
							},
							{
								key: '30',
								name: '30',
							},
						] }
						label={ __( 'Adjust Skip Duration', 'godam' ) }
						value={ {
							key: videoConfig.controlBar.skipButtons.forward.toString(),
							name: videoConfig.controlBar.skipButtons.forward.toString(),
						} }
					/>
				</div>
				<div className="godam-form-group">
					<label
						htmlFor="appearance-color"
						className="label-text"
					>
						{ __( 'Player Theme', 'godam' ) }
					</label>
					<div className="flex items-center gap-2">
						<ColorPickerButton
							value={ videoConfig.controlBar.appearanceColor }
							label={ __( 'Player Appearance', 'godam' ) }
							className="mb-0"
							contentClassName="border-b-0"
							enableAlpha={ true }
							onChange={ ( value ) => {
								if ( ! value ) {
									value = '#2b333fb3';
								}
								dispatch(
									updateVideoConfig( {
										controlBar: {
											...videoConfig.controlBar,
											appearanceColor: value,
										},
									} ),
								);
							} }
						/>
						{ videoConfig.controlBar.appearanceColor && (
							<button
								type="button"
								className="text-xs text-red-500 underline hover:text-red-600 bg-transparent cursor-pointer"
								onClick={ () => dispatch(
									updateVideoConfig( {
										controlBar: {
											...videoConfig.controlBar,
											appearanceColor: '',
										},
									} ),
								) }
								aria-haspopup="true"
								aria-label={ __( 'Remove', 'godam' ) }
							>
								<Icon icon={ closeSmall } />
							</button>
						) }
					</div>
					<ColorPickerButton
						value={ videoConfig.controlBar.hoverColor }
						label={ __( 'Icons hover color', 'godam' ) }
						enableAlpha={ true }
						onChange={ ( value ) => {
							if ( ! value ) {
								value = '#2b333fb3';
							}
							dispatch(
								updateVideoConfig( {
									controlBar: {
										...videoConfig.controlBar,
										hoverColor: value,
									},
								} ),
							);
						} }
					/>
				</div>

				<div className="godam-form-group">
					<label
						htmlFor="custom-hover-color"
						className="label-text"
					>
						{ __( 'Select Ad Server', 'godam' ) }
					</label>
					<ToggleControl
						className="godam-toggle"
						label={ __( 'Use ad server\'s ads', 'godam' ) }
						help={ __( 'Enable this option to use ads from the ad server. This option will disable the ads layer', 'godam' ) }
						checked={ videoConfig.adServer === 'ad-server' }
						onChange={ ( checked ) => {
							dispatch(
								updateVideoConfig( {
									adServer: checked ? 'ad-server' : 'self-hosted',
								} ),
							);
						} }
					/>
					{
						videoConfig.adServer === 'ad-server' && (
							<TextareaControl
								className="godam-input"
								label={ __( 'adTag URL', 'godam' ) }
								help={ <>
									<div>
										{ __( 'A VAST ad tag URL is used by a player to retrieve video and audio ads ', 'godam' ) }
										<a href="https://support.google.com/admanager/answer/177207?hl=en" target="_blank" rel="noreferrer noopener" className="text-blue-500 underline">{ __( 'Learn more.', 'godam' ) }</a>
									</div>
								</>
								}
								value={ videoConfig.adTagURL }
								onChange={ ( val ) => {
									dispatch(
										updateVideoConfig( {
											adTagURL: val,
										} ),
									);
								} }
							/>
						)
					}
				</div>
			</div>
		</div>
	);
};

export default Appearance;
